---
title: 'TLS to ClickHouse, and why a self-signed node fails'
status: published
author:
  name: LibreDB
  picture: ''
slug: clickhouse-tls-platform-trust-store
description: An https URL sets TLS and moves the default port, but only the platform trust store applies, so a custom CA has nowhere to go on this transport.
coverImage: ''
tags:
  - value: engineering
    label: Engineering
  - value: databases
    label: Databases
  - value: security
    label: Security
publishedAt: 2026-07-26T09:00:00.000Z
---

A managed node connects on the first try. The self-hosted one next to it, same
version, same credentials, refuses. A ClickHouse https connection is verified
against exactly one trust store, the platform's own, and the certificate on that
node is not in it. No field in the connection form changes that.

## What an https URL decides for you

The ClickHouse provider carries no driver. Every statement is the body of a
`POST /` and the answer comes back through the runtime's own `fetch`. The default
port is `8123`, and `8443` when TLS is on. The native protocol port `9000` is never
used; this provider does not speak it.

Connection strings are supported: `clickhouse://`, plain `http://`, and `https://`.
The scheme is not decoration. An `https://` URL sets `ssl.mode = "require"` and
switches the default port from `8123` to `8443`, so two fields you did not type are
decided by one character you did.

| Input | host | port | database |
| --- | --- | --- | --- |
| `clickhouse://localhost:8123/demo` | `localhost` | `8123` | `demo` |
| `http://reader:s3cret@ch.internal:9123/analytics` | `ch.internal` | `9123` | `analytics` |
| `https://abc.clickhouse.cloud/default` | `abc.clickhouse.cloud` | `8443` | `default` |

That inference has to happen, and it is worth saying why. A pasted URL is
decomposed into discrete fields - host, port, user, password, database - before the
provider sees it, and no `connectionString` is stored on the connection. Those
fields alone cannot express TLS. Without the scheme carrying its intent forward, the
connection would go out as plaintext HTTP to the TLS port and fail with a bare
`fetch failed`.

The inference runs in exactly one direction. `SQLBaseProvider` offers a
`shouldEnableSSL()` helper that guesses TLS from substrings in the hostname -
`cloud`, `aws`, and so on. The ClickHouse provider inherits it and never calls it,
deliberately: a self-hosted node whose hostname merely contains one of those words
would be silently switched to TLS it does not serve. TLS here comes from the
connection's own `ssl` config or from an `https://` scheme, never from a guess.

## A ClickHouse https connection certificate is checked against one trust store

Any `ssl.mode` but `disable` switches the transport from `http` to `https` and the
default port from `8123` to `8443`. That is the entire branch. There is no separate
CA or client-certificate plumbing on this path, because the transport uses global
`fetch`, whose TLS trust follows the platform's default certificate store.

Four non-`disable` modes exist in the connection form, and on this transport they
all produce the same handshake:

| Mode | What it means here |
| --- | --- |
| `verify-system` | The mode that actually describes this transport |
| `require` | Not "encrypt without checking"; nothing here can skip a check |
| `verify-ca` | Cannot pin against a pasted CA, because there is nowhere to put one |
| `verify-full` | Same |

`verify-system` is the honest name for what happens: `fetch` always verifies the
chain against the platform's certificate store and cannot be told otherwise.
Nothing in the code branches on which of the four is selected. On the driver-based
providers `require` does mean encrypt without checking; here nothing in the
transport can skip the check, so the distinction has no wire to travel down.

## Custom CA, client certificate, relaxed verification

**Custom CA certificates, client certificates and relaxed verification are not
honoured on this transport.** `ssl.caCert`, `ssl.clientCert` and
`ssl.rejectUnauthorized` are fields other providers read and this one ignores. A node
behind a self-signed certificate fails verification, while a publicly trusted
certificate works.

The mechanism is not a policy decision dressed up as one. Global `fetch` cannot
carry a custom CA or relax verification without an undici `Agent` as its
`dispatcher`, and undici is not a dependency of this project. The three fields exist
in the shared connection model because other providers reach their servers through
`node:https`, where a CA and a client key have somewhere to go. This provider does
not use that path. Honouring them means giving ClickHouse the `node:https` route the
driver-based providers already have, which is a follow-up rather than a limitation
of the scheme.

So the failure is a boundary, not a misconfiguration. Nothing you type into the
connection form will make a self-signed node verify, and the app does not offer a
checkbox that pretends otherwise - the same rule that governs every control on
[the engine pages](/databases), where what an engine deliberately cannot do is
published beside what it can.

## What that leaves for a self-signed deployment

Three outcomes, and they are easy to tell apart before you try:

- **ClickHouse Cloud, or any node whose certificate chains to a publicly trusted
  root.** Works. Paste the `https://` URL, get `8443`, done.
- **A node behind a certificate signed by your own internal CA.** Fails
  verification, even though that CA is trusted everywhere else in your
  organisation, because the check reads the platform store and nothing you supply.
- **A node behind a self-signed certificate.** Fails verification, for the same
  reason and with less ambiguity.

The second case is the one that surprises people, because an internal CA feels like
a solved problem elsewhere in the stack. It is solved by installing that CA in the
platform's own trust store - the container's, not the app's - which is a deployment
step rather than an application setting, and one this project does not perform on
your behalf.

## Deployment shapes that work today

**A publicly trusted certificate on the node.** Terminate TLS with a certificate
whose chain the platform store already contains, serve the HTTP interface on `8443`,
and connect with an `https://` URL. ClickHouse Cloud is already this shape, which is
why a Cloud connection needs nothing beyond the URL.

**A proxy that terminates TLS in front of the HTTP interface.** Put a reverse proxy
holding a trusted certificate in front of the node and let it forward to `8123` on
the private network behind it. The trust question moves to the proxy, where a
certificate can be managed with the same tooling as every other public endpoint you
run, and the hop the app makes is the one it is equipped to verify.

There is a third shape that is not a workaround but is worth naming, because it is
the deployment this product is built around: the app runs beside the database, on
the same private network, and the link between them never leaves it. TLS on that hop
is a decision about your own network rather than an unavoidable requirement, and the
[security page](/security) sets out what is protected where when it is made either
way.

For a local instance the question does not arise at all. The pinned compose service
publishes only the plaintext port:

```sh
docker compose -f database-compose.yml up clickhouse
# then connect to localhost:8123, user libredb, database demo
```

Port `9000` is deliberately not exposed there either, for the same reason it is not
in the connection form: there is no native-protocol transport in this codebase to
connect with it.
