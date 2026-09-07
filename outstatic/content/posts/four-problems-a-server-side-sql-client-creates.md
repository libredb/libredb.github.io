---
title: 'Moving the SQL client off the laptop: four problems nobody warns you about'
status: published
author:
  name: LibreDB
  picture: ''
slug: four-problems-a-server-side-sql-client-creates
description: A database client on a server next to the data removes two unwritten requirements and creates four new ones, because the client is now a multi-tenant network service holding every connection your team owns.
coverImage: ''
tags:
  - value: engineering
    label: Engineering
  - value: security
    label: Security
publishedAt: 2026-09-08T09:00:00.000Z
---

A desktop database client makes two demands that nobody writes down. Every developer laptop has to be able to reach the production network, and every developer laptop has to hold a copy of every credential. Both are load-bearing, and both are the reason a database client is usually the last tool a team gets around to putting behind SSO.

Moving the client to a server next to the data removes both demands. The credential stops living on sixty laptops and starts living in one place. The network path stops being a VPN grant per person and starts being a deployment topology. [The tool goes to the data](/blog/the-tool-goes-to-the-data) is the argument for making that trade; this is the invoice.

It is not free, because it creates four new problems that a desktop client never had. The client is now a multi-tenant network service holding every connection your team owns. We hit all four building LibreDB Studio. What follows is the specific shape each one took, including the two we got wrong first.

## 1. The trust boundary moves inside your own process

On a laptop, the operating-system user is the authorization boundary. Server-side, one process holds every connection, and something in that process has to decide who is asking.

The obvious answer is an authentication edge: middleware that runs before every route, verifies a session cookie, and redirects the rest. We have that. The part worth stating out loud is that it is not the boundary. `src/proxy.ts` already redirects unauthenticated requests, but middleware is an optimisation, not an authorization boundary: a matcher gap (the matcher exempts any path containing a dot) or a framework-level bypass would expose every route that relies on it alone.

Every route that reaches a database or a model provider verifies its own caller again, through one shared guard. The edge exists to make the common case cheap, not to be trusted.

That distinction pays off the moment something legitimate cannot present a session. Our agent runtime has a callback that asks the server to pick a long-running query session back up. Its caller is a durable transport, not a person, so it has no cookie by construction. The tempting fix is to add its path to the public-route list. That fix is wrong for a structural reason: **a path exemption is path-shaped**, so anything that can reach the port gets in.

Instead the caller presents a credential the server minted itself: valid for sixty seconds, naming exactly one run, granting nothing beyond continuing that run, and signed with a key *derived from* the JWT secret rather than with the JWT secret itself, so it is not a session and cannot be upgraded into one. The middleware admits that path only when the credential verifies, and the route verifies it a second time anyway.

## 2. CSRF becomes real, and your reverse proxy silently breaks the fix

A desktop client has no cookies and no ambient authority. A browser-based one has both, so state-changing requests need a second layer beyond the session cookie. We compare the request's `Origin` against the deployment's own host.

Two decisions in that check are worth copying, because both are about false positives rather than about attackers.

**The comparison is host-only and ignores the scheme.** A TLS-terminating proxy that forwards plain HTTP without setting `x-forwarded-proto` makes the browser send `Origin: https://db.example.com` while the app computes `http://db.example.com`. Comparing schemes there locks the operator out of their own login form. What you give up is an `http://` page on the same host posting to the `https://` app, which requires an active network attacker who has already broken transport. That is a smaller threat than the deployment class it protects.

**A request carrying neither `Origin` nor `Referer` is accepted, but only when its content type is `application/json`.** This looks like an off switch smuggled in under another name. It is not, for two independent reasons. An HTML `<form>` can only submit as `x-www-form-urlencoded`, `multipart/form-data` or `text/plain`, because `enctype` has no fourth value, so the classic CSRF vector is structurally incapable of producing that shape. And a cross-site `fetch()` *can* set that content type, but `application/json` is not CORS-safelisted, so setting it forces a preflight, and a deployment that answers no request anywhere with an `Access-Control-Allow-*` header never affirmatively answers one. What is left is curl and server-to-server callers, which are not CSRF: CSRF is specifically an unwitting browser carrying credentials it did not choose to send.

Now the failure we shipped first. The middleware matcher excluded `api/db/health` so that load-balancer probes would skip the whole pipeline. That path also backs a `POST /api/db/health`, a session-gated detailed check against a specific connection. Excluding the path excluded the method, so the one route named after health was the one route with no origin check. Path-shaped exemptions are method-blind, which is the same lesson as problem 1 in a different costume.

The other thing this layer taught us is that a lockout has to diagnose itself. A proxy that rewrites `Host` without setting `x-forwarded-host` produces a mismatch on *every* state-changing request, including login, and the operator sees a working page that silently refuses every action. So the 403 body names the fix: set `ALLOWED_ORIGINS` to the deployment's public origin. An error that explains its own cause is worth more here than a shorter one.

## 3. Rejection logging becomes a denial-of-service surface

Every branch above writes a log line and an audit event. On the internet, that means an unauthenticated scanner can fill a container log volume by making requests it knows will fail, and push real events out of the fixed-size ring the admin UI reads.

So denials are metered. The rejection itself is never rate limited, only its record.

The part that surprised us is that **bounding how many lines get written does not bound how large each line is**. The log line contains the request path and the observed host, both attacker controlled and both arbitrarily long. A per-request cap on count with no cap on size is the same attack at a different scale, so every field is truncated as well as metered.

There is a keying subtlety too. For the "authenticated user hit an admin route" denial, metering by IP address is wrong: holding a token bounds how many *identities* reach that branch, not how many requests each one makes, and one session can poll in a loop. That bucket is keyed on the username, so rotating `X-Forwarded-For` buys no extra lines.

## 4. State has to move too, and it is the part that stays honest

The browser was the store. Connections, tabs and query history all lived in `localStorage`, which is the right default for one developer and useless the moment two people share a deployment. Server mode is one environment variable: reads still come from `localStorage` as a write-through cache, and mutations get pushed to a per-user scoped server store, with connection credentials encrypted at rest.

What the encryption buys is a stolen database file or a dump. It is not a vault: anyone who can read the server's environment can read the key. And the browser copy of your credentials is still plaintext, because encrypting it would require a master password and a recovery flow, which changes what the product is. That single admission is why the cross-site scripting controls are the highest-leverage rows in [our security posture](/security) and not a checkbox.

## What this does not buy you

Relocating the client narrows the blast radius. It does not produce an authorization model you did not write. Studio ships two roles, and a `user` can still connect to any host and port and run any statement: target allowlists and per-provider command capabilities are a coherent direction and are not implemented. Saying so in the docs, next to the controls that *are* implemented, turned out to matter more than any individual control.

The posture page listing all of this is checked against the repository on every build. A row that names a file that does not exist, or a test that does not run, fails CI. It cannot verify that a linked test is *true*, which is the residual we carry knowingly, and which is also written down.

None of this is specific to us. If you are moving any credential-holding client onto a shared host, the four problems arrive with it: the boundary lands inside your process, ambient browser authority becomes a real vector, your own error paths become a resource to exhaust, and your state stops being one person's. LibreDB Studio is MIT licensed and [deploys as a package, an image or a chart](/deploy), so you can read exactly how we answered each one.
