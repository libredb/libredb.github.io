---
title: Redis over TLS, and what the rediss scheme does not decide
status: published
author:
  name: LibreDB
  picture: ''
slug: redis-tls-rediss-verification
description: A pasted rediss URL selects encryption without verification, because nothing in a URL says whose certificate to trust; verification stays an explicit choice.
coverImage: ''
tags:
  - value: engineering
    label: Engineering
  - value: databases
    label: Databases
  - value: security
    label: Security
publishedAt: 2026-08-06T09:00:00.000Z
---

A pasted URL looks like it settles two things: who you authenticate as, and how
the transport is protected. It settles the first. The username in the userinfo
half becomes the Redis 6 ACL user the driver authenticates as. The extra `s` in
`rediss://` turns encryption on and stops there - it does not decide whose
certificate the client should accept, and the connection dialog will not pretend
otherwise.

The failure this prevents is quiet. You paste `rediss://` at a managed endpoint,
the connection goes green, and you write down that the transport is verified. It
is encrypted. Nothing checked a chain.

## What the parser takes out of a Redis URL

The Redis provider does not accept a connection string. `getCapabilities()`
reports `supportsConnectionString: false`, and `RedisProvider` reads discrete
fields only: host, port defaulting to 6379, user, password and a logical database
index. The raw string never reaches it.

The paste still works, because the decomposition happens a layer above.
`parseGenericURL` in `src/lib/connection-string-parser.ts` recognises both
`redis://` and `rediss://`, splits the userinfo into `user` and `password`, and
fills the host, port and database boxes on the form. What you get back is a filled
dialog, not a stored URL.

That layout is why the scheme has to be translated rather than carried. Since the
string is dropped, the only way `rediss` can mean anything downstream is as a
field, so the parser returns an `sslMode` alongside the rest: `require` for
`rediss://`, `disable` for `redis://`. Both arms are set explicitly. A paste
overwrites the form rather than merging into it, so pasting a plaintext URL over
a previous edit clears a `require` that was left behind rather than silently
keeping it.

Measured through the parser and the provider together on 2026-08-23, against
`redis:latest --port 0 --tls-port 6390` holding a self-signed certificate:

```text
rediss://localhost:6390 -> sslMode require | connected, PING = [{"result":"PONG"}] | 14ms
redis://localhost:6390  -> sslMode disable | FAILED: Failed to connect to Redis: Connection is closed.
```

Both arms are the evidence. A wired path and a documented shape look identical
until the negative case fails for the right reason.

## Encryption from the scheme, verification from you

`require` maps to `{ rejectUnauthorized: false }`. TLS is negotiated, the traffic
is encrypted, and the certificate the server presents is not checked against
anything.

That is a deliberate reading of what the scheme says. `rediss://` says "TLS" and
stops there. It names no certificate authority, no expected host name and no
trust store. Meanwhile the ordinary self-hosted deployment - a node started with
`--tls-port` and a self-signed certificate - is exactly what a verifying mode
refuses. Had the scheme been mapped to `verify-full`, the most common Redis over
TLS setup in existence would fail on paste, and the failure would arrive as a
certificate error at a moment when the person pasting believes they are still
filling in a form.

So the rule is stated rather than inferred: **a `rediss://` URL selects `require`,
not a verifying mode.** The paste encrypts and never claims to have checked a
chain. Verification is a separate decision you make in the SSL panel, and the URL
alone never turns it on.

Worth being precise about the scope. This is a claim about a URL *scheme*. A
boolean TLS parameter in a query string follows a different rule: `?ssl=true`
describes what a specific driver does rather than announcing a transport, so it
is mapped onto the mode that matches the driver's own behaviour, which is
`verify-system`. Whether the scheme should be brought in line with that rule is
an open question on the backlog rather than a settled one.

## How the four TLS modes map onto one driver option

`buildTLSOptions()` turns `connection.ssl` into the single `tls` object ioredis
hands to Node's `tls.connect`, so the material travels under Node's own names -
the same mapping the PostgreSQL, MySQL and Couchbase adapters use.

| `ssl.mode` | `tls` option |
|---|---|
| absent / `disable` | not present at all |
| `require` | `{ rejectUnauthorized: false }` |
| `verify-system` | `{ rejectUnauthorized: true }`, no `ca` |
| `verify-ca` / `verify-full` | `{ rejectUnauthorized: true }` |

Three details in that table are load-bearing.

**Absent means absent.** ioredis negotiates TLS whenever `tls` is set, an empty
object included, so `disable` cannot be expressed as `tls: {}`. The key is omitted
entirely.

**`verify-system` needs no PEM.** It checks the chain against the trust store the
runtime already carries, which is what a managed endpoint whose certificate a
public root signed actually needs. Pasting a CA file is the exception, not the
starting point.

**`verify-ca` and `verify-full` build the same object.** ioredis exposes no
separate host-name check, so there is no second thing to switch on. Two names, one
behaviour, and saying so is cheaper than letting someone infer a hostname
assertion that is not there.

`caCert`, `clientCert` and `clientKey` become `ca`, `cert` and `key` when set,
each independently, because a server can demand mutual TLS while presenting a
self-signed certificate itself. An explicit `ssl.rejectUnauthorized` always wins
over the mode.

## Where the username in a pasted URL ends up

The Username field is the Redis 6 ACL user. `connect()` sends it as ioredis's
`username`, and sends nothing at all when it is empty - a plain `requirepass`
server has no ACL user to name, and ioredis authenticates as `default` only when
`username` is absent. A pasted `redis://analytics:pw@host:6379/0` fills the same
field, and the scheme makes no difference to which field it fills.

Measured on 2026-08-26 against `redis:latest`, with `default` left
`on nopass ~* &* +@all` and a second user defined `on >probepw ~* +@all -info`:

```text
{host, port, password}            -> ACL WHOAMI = default | INFO succeeds
{host, port, username, password}  -> ACL WHOAMI = probe   | INFO refused: NOPERM
```

The second arm is the interesting one, and it costs something. ioredis's own ready
check calls `INFO`; on `NOPERM` it logs "Skipping the ready check" and connects
anyway, which is the behaviour a least-privilege user needs. But `getHealth()`,
`getOverview()` and `getPerformanceMetrics()` all read `INFO`, so for a user
without `+info` they raise the server's own `NOPERM` sentence instead of answering
with zeros that would look like measurements. `POST /api/db/test-connection`
reports that as a degraded amber result: the connection is real, the health read
is not. Grant `+info`, or expect those panels to stay empty for that user. The
`SLOWLOG` and `CLIENT LIST` reads degrade to an empty list instead, so a
restricted ACL does not break the dashboard outright.

One migration note, because it is the kind of thing that reads as a bug later.
`connectionFields` decides what a save writes, and it omitted `user` for Redis
until the settlement round of 2026-08-27. A connection saved before then never
captured the ACL user at all, so it still authenticates as `default`, and there is
nothing to migrate - no migration restores a credential that was never stored.
Open it, type the user name, and it persists from that point on.

## Hosted Redis services, and what has actually been probed

Redis Cloud, Amazon ElastiCache, Azure Cache for Redis and Upstash are names
people run Redis on, and they are the reason the two fields above have to work.
They are not evidence that any of them was connected to.

The provider's committed tests replace ioredis with an in-process mock before the
provider is imported. That suite does cover every `ssl.mode` branch and both ACL
username assertions - present for a named user, absent for an empty string and for
an unset field - asserted against the options object the `Redis` constructor
actually received. It is a real check of the mapping and it is not a hosted
endpoint. `docs/providers/README.md` records ElastiCache and Upstash under "no
instance was reachable", deliberately absent rather than assumed to work.

None of those four services is a tested target. Neither is Cluster or Sentinel:
only a single standalone node is supported. What is published is the mapping from
scheme to mode to driver option, measured against a local TLS-only node, and the
rule that a `rediss://` paste selects `require` rather than a verifying mode. The
boundaries this product publishes about itself are collected on
[the security page](/security).

If you need the chain checked, pick the mode. The URL will not pick it for you,
and it should not.
