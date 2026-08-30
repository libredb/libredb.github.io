---
title: Connecting to OpenSearch when the security plugin is on
status: published
author:
  name: LibreDB
  picture: ''
slug: opensearch-security-plugin-tls
description: A default distribution serves HTTPS with a self-signed certificate on the same port, and no custom CA can be supplied on this transport.
coverImage: ''
tags:
  - value: engineering
    label: Engineering
  - value: databases
    label: Databases
  - value: security
    label: Security
publishedAt: 2026-04-19T09:00:00.000Z
---

When you connect to OpenSearch over HTTPS and the security plugin is on, the
certificate is what stops you, not the credentials. The username and password go
through as an HTTP Basic header the moment you fill them in. The handshake in
front of them either verifies against the platform's certificate store or it
fails, and there is no field on the form that changes that answer.

## What a default distribution serves, and where

The distribution ships the security plugin enabled. A node started that way
serves HTTPS, presents a certificate it generated for itself, and requires an
admin password. That is the state of a cluster nobody has configured yet.

The connection form has four fields: host, port, user, password. Host is
required - `validate()` throws "OpenSearch requires a host". Port defaults to
`9200`. User and password are sent as HTTP Basic only when a user is set, which
is what the security plugin wants. There is no database field, and it is ignored
if you set one: an index has no namespace above it, and this product's own SQL
agrees - `SHOW TABLES LIKE %` answers `TABLE_SCHEM` null. There is no connection
string either, so there is no URL to paste a scheme into.

Behind those four fields there is no driver at all. Statements go to
`POST /_plugins/_sql`, the SQL plugin that ships bundled with the distribution.
Schema and monitoring come from the REST APIs instead - `GET /_cat/indices`,
`GET /<index>/_mapping`, `_cluster/health`, `_cluster/stats`. Every one of those
is the runtime's own `fetch`, with no connection pool, no sniffing and no retry
underneath it. One statement is one request to one host. Connecting proves the
cluster with a single `SELECT 1`, which needs no index and so also succeeds
against a cluster holding nothing yet.

## Why the port does not change under TLS

`9200` is the default for both schemes. A TLS deployment serves HTTPS on that
same number. The [engine grid](/databases) names this engine's transport `http`
and its port `9200` for exactly that reason: there is one port, and the scheme in
front of it is a separate question.

Setting the connection's `ssl` mode to anything other than `disable` switches the
transport from `http` to `https`. It changes the scheme and it changes nothing
else. It does not shift the port, because there is no second well-known number to
shift to. Inventing one would mean sending a Basic header carrying an admin
password to a port nothing is listening on.

If you have seen `9201` attached to OpenSearch somewhere, it came from a
container fixture. The studio repo's compose file publishes the node on host port
`9201` because the Elasticsearch service in the same file already claims `9200`.
That is a collision on one machine, not a fact about the product. A real node is
on `9200`, TLS or not.

## The security plugin certificate problem this transport cannot solve

`fetch` verifies the chain against the platform's certificate store, and it
cannot be told otherwise. Carrying a custom CA, presenting a client certificate
or relaxing verification all require an undici `Agent` as the dispatcher, and
undici is not a dependency here.

So the three fields you would reach for do nothing:

| Field | What it would do elsewhere | What happens here |
| --- | --- | --- |
| `ssl.caCert` | pin against a pasted CA | not honoured |
| `ssl.clientCert` | present a client certificate | not honoured |
| `ssl.rejectUnauthorized` | accept an unverified chain | not honoured |

**Custom CA certificates, client certificates and relaxed verification are not
honoured on this transport. A default distribution's self-signed certificate
therefore fails verification, and such a cluster needs a publicly trusted
certificate, a terminating proxy in front of it, or the security plugin
disabled.** There is no fourth option and no toggle that produces one.

One consequence worth stating flatly: of the four non-`disable` TLS modes,
`verify-system` is the only one whose name describes what this transport actually
does. `require` here does not mean "encrypt without checking" the way it does on
the driver-based engines, because nothing in this code path can skip a check, and
`verify-ca` and `verify-full` cannot pin against a pasted CA. Nothing in the code
branches on which mode you picked. That is the kind of boundary the
[security page](/security) exists to publish.

## Three deployment shapes that work

**A publicly trusted certificate on the cluster.** The node presents a
certificate the machine running the container already trusts, from a CA in the
platform store. Nothing has to be pasted anywhere because nothing needs to be
told about it.

**A terminating proxy in front of the cluster.** The proxy holds the trusted
certificate and speaks to the cluster behind it on whatever terms the two of them
have arranged, including a self-signed certificate the proxy is configured to
accept. The connection points at the proxy's host and port, and the proxy is
where the certificate problem gets solved by software that has the knobs for it.

**The security plugin disabled, on a private network.** This is what the
container fixture does:

```yaml
services:
  opensearch:
    image: opensearchproject/opensearch:3.8.0
    environment:
      discovery.type: single-node
      DISABLE_SECURITY_PLUGIN: 'true'
      OPENSEARCH_JAVA_OPTS: '-Xms512m -Xmx512m'
```

The plugin is installed rather than licensed, so it is switched off by name.
Measured against a node in that state, a bogus `Basic` header is ignored
outright - HTTP 200 - which is why credentials are genuinely optional there. It
is also why this is the shape with a condition attached: a cluster with the
plugin off has no authentication and no transport encryption, so it belongs on a
private network beside the tool that reads it, and nowhere else.

Whichever shape you land in, an authentication failure is legible when it
happens. `401` and `403` are the one category this provider classifies on the
HTTP status rather than on the response body, because HTTP itself fixes their
meaning and no 401 body could be captured from a cluster running with the plugin
disabled.

## System indices your cluster shows that a naming rule misses

Once you are connected, the sidebar raises a second question the security plugin
also touches. Measured on a stock 3.8.0 node with two hand-made probe indices,
`_cat/indices` listed four:

```text
.plugins-ml-config              engine bookkeeping, dot-prefixed
probe_orders                    yours
probe_shapes                    yours
top_queries-2026.08.18-74305    engine bookkeeping, no leading dot
```

On an empty cluster, two of every three indices are the engine's own. The
familiar leading-dot convention catches the first and misses the last, so the
transport carries a second rule for the date-suffixed query-insights shape,
`/^top_queries-\d{4}\.\d{2}\.\d{2}-\d+$/`. That makes hiding them a judgement
rather than a rule, which is why it is exposed as a flag the caller decides about
and not a filter applied on the wire. Hidden is the default; an operator
debugging ML inference wants `.plugins-ml-config` in the tree and a developer
writing a query does not.

If you do turn them on, note that `top_queries-2026.08.18-74305` carries hyphens
and dots, so it is a name SQL needs quoted - and on this product the identifier
quote is a backtick:

```sql
SELECT * FROM `top_queries-2026.08.18-74305` LIMIT 10
```

Double quotes will not do it. They are a string literal in this grammar, so
`SELECT "customer" FROM probe_orders` answers HTTP 200 with the literal word
`customer` in every row, and a predicate written that way compares two literals
and returns zero rows with no error at all.

The security plugin shows up here too, in a quieter way. It grants index
privileges per index, so a role that can list twenty indices and describe
nineteen of them is an ordinary configuration rather than a fault. A mapping read
refused for authorisation costs that one index its column list and leaves the
other nineteen intact. The tree degrades by one entry instead of going blank,
which is the only reading of that situation that matches what the cluster
actually told us.

Everything measured above was verified against OpenSearch 3.8.0, image
`opensearchproject/opensearch:3.8.0`, on 2026-08-19.
