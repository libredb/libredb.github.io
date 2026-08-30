---
title: You configure the management port, the query port is discovered
status: published
author:
  name: LibreDB
  picture: ''
slug: couchbase-bucket-and-discovered-query-port
description: Only the management port is stored, and the query endpoint comes from the cluster's own node services, preferring the external address it advertises.
coverImage: ''
tags:
  - value: engineering
    label: Engineering
  - value: databases
    label: Databases
publishedAt: 2026-01-01T09:00:00.000Z
---

A Couchbase cluster needs two endpoints: management and query. A connection record
carries one port, so the second endpoint has to come from somewhere.

There is no second port field here. The management port is the one you type; the
query endpoint is read from the cluster on the first statement. That is why a node
reached through Docker port mapping or NAT connects without a field describing the
mapping.

## The fields a Couchbase connection actually needs

Four things, and one of them is not what its name says.

| Field | Required | What it carries |
| --- | --- | --- |
| `host` | yes, or a connection string | A cluster node hostname |
| `port` | no | The **management** port. Defaults to 8091, or 18091 with TLS |
| `user` / `password` | no | Sent as HTTP Basic on every request |
| `database` | **yes** | The **bucket** name |

`port` is management only. The documented default is 8091, or 18091 when SSL is on.
Nothing on the form asks for 8093, because nothing on the form could reliably know
it.

`database` is the field that surprises people, so the form says so:
`ConnectionModal` renders the label "Bucket" when the connection type is
`couchbase`. The stored key is still `database`, because every provider shares one
connection shape, but what goes in it is a bucket name.

There is no driver underneath any of this. The provider speaks the documented
Query Service REST endpoint (`/query/service`) and the management API
(`/pools/default...`) using `fetch` for plaintext and the built-in `node:https`
for TLS. The official SDK was measured and rejected: 64.6 MB unpacked across 3765
files, with a postinstall step that downloads a prebuilt binary or compiles from
source. Studio ships as a Docker image, a Snap, an AppImage, a Flatpak, deb/rpm
packages and an npm package, and every one of those would have inherited the
native module.

## Why the bucket field is required

A cluster is not a query target. The hierarchy is cluster, bucket, scope,
collection, and the schema explorer renders a flat list of collections. The bucket
is what pins that list to something finite.

So a connection without one is refused rather than guessed at, with this message:

```text
Couchbase requires a bucket (use the "database" field)
```

Below the bucket, the flattening follows the rule PostgreSQL already established
for schema and table. The default scope is implicit, everything else is qualified:

```text
_default / hotel        ->  hotel
inventory / hotel       ->  inventory.hotel
```

Collections come from `system:keyspaces` LEFT JOIN `system:scopes`. The join is
LEFT for a specific reason: `system:scopes` does not list `_default` on Server
8.0.2, so an inner join silently drops every collection in the default scope.

Capella is where this bites. A Capella endpoint carries neither a port nor a
bucket path, so a pasted `couchbases://cb.<id>.cloud.couchbase.com` arrives with
the host and the SSL mode set and the bucket blank. It stays blank until you type
one; nothing is invented for it.

## How the query port is discovered

The first statement on a connection triggers `GET /pools/default/nodeServices`.
The transport reads `nodesExt[].services.n1ql`, or `n1qlSSL` when TLS is on, and
that is the port every subsequent SQL++ statement goes to. If no node advertises
an `n1ql` entry at all, it falls back to 8093, or 18093 under TLS.

Two details in that discovery matter more than the lookup itself.

**It is cached as a promise, not as a value.** Concurrent first queries share one
round trip rather than each issuing their own.

**A failed discovery is not cached.** One unreachable moment during startup would
otherwise poison every later query on that connection.

Connect itself is one call before any of this: `GET /pools/default`, the cheapest
request that proves reachability and credentials together. Disconnect clears the
cached discovery; there are no sockets to close, because each statement is one
stateless HTTP request.

The same rule is why a pasted connection string's port is thrown away. A
`couchbase://` URL copied out of an application config carries the KV port, not
the management port. Storing it would point management traffic at 11210. The
scheme is read - it sets the SSL mode, `require` for `couchbases://` and `disable`
for `couchbase://` - and the port is not.

## External addresses, NAT and port mapping

Discovery would be a mild convenience if a node only ever advertised the address
you already reached it on. A node can publish `alternateAddresses.external`
alongside its internal one, and the transport prefers it. That single preference
is what makes three common deployments work with no extra field:

- **Docker port mapping.** The node knows itself by a container-internal address;
  you reach it on a mapped host port. The external alternate address is the one
  routable from where the request originates.
- **NAT.** Same shape, at a different layer.
- **Capella.** The managed endpoint you are given is not the node's internal
  address either. Capella hosts without an explicit port are resolved through the
  SRV record `_couchbases._tcp.<host>` first; a DNS failure or an empty answer
  falls back to treating the host as a plain A record, which is what every
  self-hosted cluster needs anyway.

The local fixture shows how little has to be open. The repository's
`database-compose.yml` runs `couchbase:community-8.0.2` and needs 8091 for
management REST and 8093 for the query service, because the provider speaks HTTP
and never the binary KV protocol on 11210. Reproducing it by hand is documented:

```sh
docker run --rm -d --name cb -p 8091-8096:8091-8096 couchbase:community

# Community Edition rejects the Magma storage backend that couchbase-cli
# defaults to, and a single node cannot satisfy a replica.
docker exec cb couchbase-cli cluster-init -c 127.0.0.1 \
  --cluster-username Administrator --cluster-password password123 \
  --services data,index,query --cluster-ramsize 512 --cluster-index-ramsize 256
docker exec cb couchbase-cli bucket-create -c 127.0.0.1 \
  -u Administrator -p password123 --bucket travel \
  --bucket-type couchbase --bucket-ramsize 256 \
  --storage-backend couchstore --bucket-replica 0
```

Then point a connection at `127.0.0.1:8091` with bucket `travel`. The
[get started guide](/get-started) covers the container side in general;
`--storage-backend couchstore` and `--bucket-replica 0` are the Couchbase-specific
part, and both are required.

## What one connection covers, and what it does not

One bucket per connection. Multi-bucket browsing from a single connection is out of
scope, and every schema and monitoring read is scoped to that bucket. Two buckets
means two connections. There is no bucket switcher, and adding one would mean a
schema tree whose contents no longer match what the monitoring panels are
measuring.

Within the bucket, opening a collection generates a statement that projects the
key explicitly, because `SELECT * FROM hotel` nests the document under the
keyspace name and omits the key entirely:

```sql
SELECT META(d).id AS __id, d.* FROM `travel`.`inventory`.`hotel` AS d LIMIT 50;
```

Every statement is sent with `scan_consistency: "request_plus"`, so you see your
own writes. The measurement behind that default, taken against Couchbase Server
8.0.2: immediately after an `INSERT`, a `SELECT` returned zero rows while
`COUNT(*)` already returned three, and the same `SELECT` returned three rows
seconds later. The trade is stated - `request_plus` waits for the index to catch
up, which costs latency on a write-heavy cluster - and callers opt out per
statement with `{ scanConsistency: 'not_bounded' }`.

Two more boundaries belong on the same page as the connection form. Inline row
editing is not offered: the obstacle is not `UPDATE`, which SQL++ has, but the key
projection alias `__id`, which the shared editor's primary-key heuristic would
turn into `WHERE __id = '<key>'` - a predicate no document satisfies, so the edit
would match zero documents and still report success. And Agent AUTO mode ends
`engine-unsupported` here, because the read-only profile it runs under is
database-native and only PostgreSQL, SQLite and DuckDB implement it. Agent PLAN
mode opens on this connection like any other: it runs no statement of yours,
writes nothing, and hands every statement it drafts to you to run. On Couchbase
its grounding infers field names from a sample of your own documents rather than
reading a catalog, because there is no catalog to read.
