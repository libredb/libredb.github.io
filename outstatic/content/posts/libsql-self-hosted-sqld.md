---
title: Connecting to a self-hosted libSQL server
status: published
author:
  name: LibreDB
  picture: ''
slug: libsql-self-hosted-sqld
description: A server started without authentication takes no token at all, and sending an empty one is rejected rather than treated as an anonymous connection.
coverImage: ''
tags:
  - value: engineering
    label: Engineering
  - value: databases
    label: Databases
publishedAt: 2026-03-20T09:00:00.000Z
---

Most of a self-hosted libSQL sqld connection is a question of what to leave out.
There is one integration for this engine, one type id, and it reaches both a
container you started yourself and a managed Turso Cloud database, because the
two speak the same protocol and embed the same SQLite - 3.47.0 measured on both.
What separates them in the connection dialog is a host, a TLS switch and a
credential. Locally, two of those three are the absence of something.

## The server, and the HTTP port it publishes

The provider talks to `sqld` over Hrana, an HTTP protocol whose whole surface is
`POST /v2/pipeline`: a list of requests goes up as JSON, a list of results comes
back. There is no driver package involved: the statement is a JSON body, the answer
arrives through the runtime's own `fetch`, and the whole transport is about 330
lines including the comments that record the wire.

The compose service the provider was probed against starts one primary node:

```yaml
libsql:
  image: ghcr.io/tursodatabase/libsql-server:v0.24.33
  container_name: libredb-libsql
  environment:
    SQLD_NODE: primary
  ports:
    - '18080:8080'
```

```sh
docker compose -f database-compose.yml up -d libsql
```

`sqld` serves the Hrana HTTP API on container port 8080, which is also the
engine's default. The published port is the one that matters to you, and here it
is 18080. Check the mapping rather than assuming 8080: 8080 is the port inside
the container, and the compose service maps it to 18080 on the host.

## Host and port, with transport security switched off

There is a connection string form for this engine, and it does not help in the
local case:

```
libsql://<database>-<org>.turso.io?authToken=<jwt>
```

That is what `turso db show --url` prints, and `libsql://` implies TLS on 443.
There is no plaintext spelling of the scheme. `http://` is already claimed by
ClickHouse in the connection string parser, and two engines cannot own one
scheme, so a self-hosted server on plain HTTP is reached through the fields
instead.

| Field | Local value |
| --- | --- |
| Host | `127.0.0.1` |
| Port | `18080` |
| SSL | `disable` |
| Auth Token | left empty |

Two inputs you may be looking for are not rendered at all. There is no Username,
because libSQL has no user names. There is no Database, because the database is
the host: on Turso Cloud it is the hostname, on `sqld` it is a namespace. The
form gates those boxes on the same field list the provider writes, so a box
appears exactly where a value is read. It used to draw both regardless, and the
save discarded whatever had been typed into them.

The credential field is labelled Auth Token rather than Password for the same
reason. It carries a JWT and is sent as `Authorization: Bearer`.

## Why an empty token is refused

A `sqld` started without authentication takes no token at all. That is not the
same as accepting a blank one: sending an empty token is a 400 rather than an
anonymous connection, so a connection with nothing in the token field sends no
`Authorization` header at all.

Three failures, three envelopes, measured against both deployments:

| Situation | Status | Body |
| --- | --- | --- |
| No token to a private database | 401 | `{"error":"Unauthorized: ... empty JWT token"}` |
| Malformed token | 400 | `{"error":"JWT error: InvalidToken"}` |
| Statement rejected | 200 | `{"results":[{"type":"error","error":{...}}]}` |

The auth envelope's `error` is a bare string, where the statement path returns a
`{ message, code }` object, so the error reader handles both shapes. 400 sits in
the provider's authentication set alongside 401 and 403 deliberately: keying only
on 401 would report a malformed token as a connection failure, and send you to
look at the network when the problem is in the field.

When the server does require a token, the token is something you mint outside the
product:

```sh
turso db tokens create <database>              # full access
turso db tokens create <database> --read-only  # a read-only credential
```

The read-only form is the engine-side answer to a gap. `PRAGMA query_only = true`
is refused by the server on both deployments, so this provider implements no
read-only query path of its own. Agent AUTO mode - the run that uses tools -
therefore ends `engine-unsupported` on libSQL, because that profile needs the
read-only path and exists on PostgreSQL, SQLite and DuckDB only. Agent PLAN mode
opens on every connection here as it does everywhere: toolless, executing
nothing, drafting a statement for a person to run. The read-only token is a
credential you create, not a statement the provider can issue.

## One statement, one request, and what that costs

Hrana is stateless. Each statement is one HTTP request, so there is no pool, no
connection ceiling to report, and no active connection count. `maxConnections`
reads 0, which is this codebase's encoding for "no limit published", and the
active sessions list is empty because no session object exists to describe.

Against a server across a network that would be expensive, since SQLite
introspection is per table: a row count, a `pragma_table_info`, a
`pragma_index_list` and a `pragma_foreign_key_list` each time. Hrana takes a list
of requests, so those go up together. A whole schema read is three round trips
regardless of how many tables the database holds, plus one more for sizes.

Each statement in that batch keeps its own outcome:

```
requests: [SELECT 1 AS a] [SELECT * FROM nope] [SELECT 3 AS c]
results:  ok               error                ok
```

A failing statement does not abort the pipeline, and the provider decides per
reading what an absent result means. One table's column read can fail while every
other table in the tree stays intact. That is why quoting matters in the column
statement: `notnull` is a SQLite keyword, and projecting it bare is a parse error
that empties the column list of every table while leaving the tree standing.
The pinned text is `SELECT cid, name, type, "notnull", dflt_value, pk FROM
pragma_table_info(...)`, and only a live server ever said so.

`dbstat` answers on both deployments, so table and index bytes are measured
rather than absent - 4096 bytes of table and 4096 of index for a three-row table,
53248 for a two-thousand-row one. Where `dbstat` is absent the byte fields are
omitted rather than zeroed, because 0 B reads as an empty table, and that is a
claim.

The version panel names what the deployment publishes. Self-hosted, `GET
/version` answers and the panel reads `sqld 0.24.33 (f8fb14f3 2026-08-11) (SQLite
3.47.0)`. On Turso Cloud that route does not exist, so it reads `SQLite 3.47.0`.
Neither reads Unknown, because in both cases the engine answered something.

## When a failed statement still arrives as a success

**A failed statement answers with HTTP 200.** `response.ok` says the pipeline was
accepted; it never says the statement ran. The failure is inside the result list:

```
POST /v2/pipeline  {"requests":[{"type":"execute","stmt":{"sql":"SELECT * FROM no_such_table"}}, ...]}
HTTP/1.1 200 OK
{"results":[{"type":"error","error":{"message":"SQLite error: no such table: no_such_table","code":"SQLITE_UNKNOWN"}}, ...]}
```

Every failure is read out of `results[]`, and the transport carries `status: 200`
on a statement error on purpose, because the transport did succeed.

**And no transaction controls are offered.** libSQL has transactions. This
provider closes its Hrana stream in the same request as the statement, so it holds
no session to run one in, and `supportsTransactions` is false. The controls stay
hidden rather than shown and then failed - the same position the SQLite provider
takes, for the same reason. Hrana's `baton` is the feature that would carry a
session, and using it is ours to do, not the engine's to fix.

Two related withholdings follow from the server rather than from us. Maintenance
offers reindex and integrity check only; `VACUUM`, `ANALYZE`, `PRAGMA optimize`
and `PRAGMA wal_checkpoint` are refused by the server's statement allowlist on
both deployments, so the provider refuses them where you clicked instead of
relaying a server error for a statement you never typed. And monitoring reads
only what the deployment publishes: no uptime, no cache hit ratio, no slow query
list, because libSQL keeps no statistics about finished statements.

The published capability line for this engine and the sixteen others is on the
[databases page](/databases), and LibreDB Studio itself is one `docker run` away
in [get started](/get-started).
