---
title: Connecting to Couchbase Capella and the bucket you type in
status: published
author:
  name: LibreDB
  picture: ''
slug: couchbase-capella-connection
description: A managed endpoint carries neither a port nor a bucket path, so the scheme supplies the port and the TLS mode while the bucket is typed by hand and nothing is invented for it.
coverImage: ''
tags:
  - value: engineering
    label: Engineering
  - value: databases
    label: Databases
publishedAt: 2026-02-17T09:00:00.000Z
---

Paste a Couchbase Capella connection string into the dialog to connect and one
field stays empty. The form does not fill it, does not guess at it, and will not
let the connection be saved until you type something into it. That field is the
bucket, and the empty box is the correct behaviour rather than a gap in the
parser.

The string Capella hands you looks like this:

```text
couchbases://cb.abc123.cloud.couchbase.com
```

There is a scheme and a host. There is no port and no path. Everything the form
shows after the paste was derived from those two things, and everything it does
not show was not derivable.

## What a Couchbase Capella connection string sets, and what it does not

The paste is decomposed into discrete fields before the provider ever sees it
(`connection-string-parser.ts:138`). Three inputs come out of the URL above:

| Input | host | port | database (bucket) |
| --- | --- | --- | --- |
| `couchbase://localhost:8091/travel` | `localhost` | `8091` | `travel` |
| `couchbase://user:pw@node1,node2/travel` | `node1`, first host wins | `8091` | `travel` |
| `couchbases://cb.abc123.cloud.couchbase.com` | the host | `18091` | none, not invented |

The scheme does two jobs. It selects the management port - `8091` for
`couchbase://`, `18091` for `couchbases://` - and it arrives as an SSL mode:
`require` for `couchbases://`, `disable` for `couchbase://`. The second half of
that is load-bearing, because the transport picks `https` over `http` from
`config.ssl` alone and never re-reads the pasted string. Without the mode being
set from the scheme, a `couchbases://` paste posted plain HTTP to port 18091,
which is a connection failure that looks like a network problem and is not one.

`require` and not a verifying mode, for the same reason it is `require` on
PostgreSQL and MySQL here: a self-hosted Couchbase node ships a self-signed
certificate, and a default that refused it would be a default nobody could use on
their own cluster. Capella is the case where you should change it. Its
certificate is signed by a public root, so `verify-system` verifies against the
trust store the runtime already has, with no PEM to go looking for. That is one
dropdown change.

What the scheme does not set is the query endpoint. It cannot: the URL has no
information about it.

## Why the pasted port is deliberately ignored

A connection carries one `port`, and Couchbase needs two endpoints - a management
one and a query one. Only the management port is stored. The query endpoint is
discovered at runtime from `GET /pools/default/nodeServices`, reading
`nodesExt[].services.n1ql`, or `n1qlSSL` under TLS, and preferring
`alternateAddresses.external` where the cluster publishes one. That preference is
exactly what makes NAT, Docker port mapping and Capella work, because in all
three the address the cluster knows about itself is not the address you reach it
on. With no `n1ql` entry anywhere, the transport falls back to 8093 or 18093.

Which is why a port in the pasted URL is thrown away rather than used. A
`couchbase://` URL copied out of an application config carries the KV port - the
binary protocol's port, 11210 - not the management port. Storing it would put it
in the management field, and every management call would go to a service that
does not speak REST. The URL's hostname is lifted out for the transport, the
scheme sets the port and the SSL mode, and discovery handles the rest
(`couchbase/index.ts:368`).

A Capella hostname given without an explicit port is also an SRV record, so it is
resolved through `_couchbases._tcp.<host>` first; a DNS failure or an empty answer
falls back to a plain A record, which is what every self-hosted cluster needs.

## The bucket that has to be typed

The connection's `database` field carries the bucket. That is the one field on
this engine that surprises people, so the form stops calling it a database: for
`type === 'couchbase'` the label reads **Bucket** (`ConnectionModal.tsx:139`). A
connection without one is rejected before it is attempted, with the message
naming the field it means:

```text
Couchbase requires a bucket (use the "database" field)
```

A managed endpoint carries neither a port nor a bucket path, so the bucket must
be entered by hand and nothing is invented for it, and one connection still
covers exactly one bucket. Picking the first
bucket the cluster lists would be a guess that works until the day someone has
two, and multi-bucket browsing from one connection is out of scope:
`getSchemaList()` and every monitoring read are scoped to `config.database`. If
you work across three buckets, you make three connections.

What the connection does have below the bucket is two more levels. Cluster,
bucket, scope and collection is four levels against a schema explorer that draws
a flat list, so scope and collection are flattened the way PostgreSQL flattens
schema and table: the default scope is implicit and everything else is
qualified. `hotel` in the default scope, `inventory.hotel` outside it. The
collection list comes from `system:keyspaces` LEFT JOIN `system:scopes` - LEFT,
because `system:scopes` does not list `_default` on Server 8.0.2, and an inner
join would silently drop every collection in the default scope.

## Identifier quoting is a boundary, not a style

Once the bucket is set, every generated statement concatenates it into a keyspace
path. SQL++ has no bind parameter for an identifier, so there is no placeholder
to hide behind; the path is assembled as text. `quoteIdentifier()` therefore
doubles any backtick embedded in a name (`keyspace.ts:31`), so an identifier
cannot terminate its own quoting and have the remainder of itself parsed as
SQL++. That is a security property, not a formatting habit, which is why the
quoting lives in one pure module rather than at each call site.

There is a second, more mundane reason the backticks are always there. `bucket`
and `scope` are reserved words in SQL++, and an unquoted projection over
`system:keyspaces` fails with error 3000 - verified on Server 8.0.2. The catalog
read that lists your collections is itself a statement that needs the quoting.

The same rule shapes what the collection-open query looks like. `SELECT * FROM
hotel` nests the document under the keyspace name and omits the key entirely, so
generated queries alias the keyspace and project the key explicitly:

```sql
SELECT META(d).id AS __id, d.* FROM `travel`.`inventory`.`hotel` AS d LIMIT 50;
```

## Confirming the connection reached the query service

Connecting proves less than it looks like it proves. `connect()` issues one
`GET /pools/default` - the cheapest call that needs no RBAC role beyond cluster
read - which establishes that the host is reachable and the credentials are
accepted. It says nothing about the query service, because the query endpoint has
not been discovered yet at that point.

So run one statement. Opening any collection from the explorer does it, or type
the statement above by hand. A row coming back is proof that discovery resolved a
query node, that TLS negotiated if you are on `couchbases://`, and that the
credentials carry SELECT on the keyspace - three separate things that a green
connection dot does not cover.

Read the result carefully rather than the status code. The Query Service returns
syntax and semantic errors inside an HTTP 200 response, with `status: "errors"`
in the payload, so the transport inspects the body before the HTTP code
(`http-transport.ts:249`). Skipping that check reports a failed statement as
"0 rows", which is the most expensive kind of wrong answer an editor can give.

That first row will not be stale. Every statement is sent with
`scan_consistency: "request_plus"`, so you see your own writes. Verified against
Couchbase Server 8.0.2 Community Edition: immediately after an `INSERT`, a
`SELECT` returned zero rows while `COUNT(*)` already returned three, and the same
`SELECT` returned three rows seconds later. The default costs latency on a
write-heavy cluster, because the query waits for the index to catch up, and
callers opt out per statement with `{ scanConsistency: 'not_bounded' }`.

Capella is the cloud vendor this provider is documented against. Its management
APIs - allowed-IP administration, cluster provisioning - are not covered here,
and neither are Analytics, Full-Text Search or Eventing. The transport and the
default port for this engine are on the [engine list](/databases), and the
container that has to sit close enough to the cluster to reach it at all is the
subject of [getting started](/get-started).
