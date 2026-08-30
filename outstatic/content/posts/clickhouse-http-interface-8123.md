---
title: Connecting to ClickHouse over the HTTP interface
status: published
author:
  name: LibreDB
  picture: ''
slug: clickhouse-http-interface-8123
description: Port 8123 is the whole transport, the native port is never used, and a permission denial arrives as a 500, so failures are read by exception code.
coverImage: ''
tags:
  - value: engineering
    label: Engineering
  - value: databases
    label: Databases
publishedAt: 2026-02-06T09:00:00.000Z
---

A restricted user connects, the schema tree fills in normally, and then the
monitoring panel comes back empty with an HTTP 500 in the network tab. Nothing
crashed. The server was answering a missing `SELECT` grant, and on this engine
that answer is a 500. If you connect to ClickHouse over the HTTP interface on
8123 and read failures by status code, you will diagnose a permission problem as
an outage every time.

That is not an isolated quirk. It falls out of one decision made at the bottom of
the ClickHouse provider, and the same decision determines what you publish from a
container and what you never open on a security group.

## One HTTP endpoint on 8123, no driver, no pool

The ClickHouse provider carries no driver of any kind. Every statement is the
body of a `POST /` on the documented HTTP interface, answered through the
runtime's own `fetch`. The default port is `8123`, or `8443` when TLS is on.

There is no connection pool either. Each statement is one stateless HTTP request.
`connect()` proves the server, the credentials and the pinned database together
with a single `SELECT 1` - the cheapest statement that exercises all three - and
`disconnect()` has nothing to release, because there is no pool and no session to
close.

The evidence that this is enough is the catalog list. Schema introspection is
three parallel reads: `system.tables` for name, `total_rows`, `total_bytes`,
`sorting_key` and `primary_key`; `system.columns` for name, type,
`is_in_primary_key` and the default kind and expression, ordered by declaration
position; and `system.data_skipping_indices` for the nearest thing ClickHouse has
to a secondary index object. Monitoring reads `version()`, `uptime()`,
`system.metrics`, `system.server_settings`, `system.parts` and `system.disks` for
overview and storage, `system.events` and `system.asynchronous_metrics` for the
mark-cache ratio and memory, `system.query_log` filtered to
`type = 'QueryFinish'` for slow queries, and `system.processes` for active
sessions. Every one of those is a `system.*` table reachable by ordinary SQL over
the same endpoint, so a second HTTP surface next to `query()` would buy nothing.

Foreign keys are the one thing the catalogs cannot answer, and the list is always
empty. ClickHouse has no foreign-key concept anywhere - no engine, no table
setting, no DDL declares one - so the [engine pages](/databases) state it
directly: ER diagrams here show structure without discovered relations.

## What to publish from a container, and what not to

The native protocol port `9000` is never used. This provider does not speak it,
and it is out of scope entirely - the native wire format and the server-side
settings only exposed through it are not reachable from here.

That is a boundary with an operational payoff. The local compose service in the
studio repo publishes only `8123`, and port 9000 is deliberately not exposed,
because there is no native-protocol transport in the codebase to connect with it:

```sh
docker compose -f database-compose.yml up clickhouse
```

Point a connection at `localhost:8123` with user `libredb`, password
`password123`, database `demo`. The service is pinned to
`clickhouse/clickhouse-server:26.7.1.1315`, the exact build the provider was
live-verified against, and it sets `CLICKHOUSE_DEFAULT_ACCESS_MANAGEMENT=1` so a
restricted second user can be granted and revoked while you watch what degrades.

The same reasoning applies outward. If the only thing Studio needs is 8123, then
8123 is the only rule a security group needs, and 9000 stays closed with no
capability lost on this side. Connection strings follow the transport rather than
inventing a scheme: `clickhouse://`, `http://` and `https://` all parse, and an
`https://` URL sets TLS and moves the default port to 8443.

TLS has a limit worth reading before you plan a deployment. The transport uses
global `fetch`, whose trust follows the platform's default certificate store, so
`ssl.caCert`, `ssl.clientCert` and `ssl.rejectUnauthorized` are not honoured. A
node behind a publicly-trusted certificate works. A node behind a self-signed
certificate fails verification, and there is no flag here that will talk it out
of that.

## Why a denial arrives as a server error

The HTTP interface is mostly honest about failure. A syntax error, an unknown
table and bad credentials all come back as real status codes with ClickHouse's
numeric exception code in a response header. Two cases break that. One is a
failure part-way through a streamed response: the status line is already
committed as `200`, so the real exception arrives fenced in a trailer at the end
of a truncated body instead of in a header. The other is a permission denial,
measured with a purpose-made user granted `SELECT` on one table only:

| Surface, as a restricted user | Status | Code |
| --- | --- | --- |
| `system.query_log`, `system.processes`, `system.metrics`, `system.data_skipping_indices` | 500 | 497 `ACCESS_DENIED` |
| `OPTIMIZE TABLE`, `KILL QUERY` | 500 | 497 `ACCESS_DENIED` |
| `system.tables`, `system.columns` | 200 | filtered to what the user may see |
| `uptime()`, `version()` | 200 | needs no grant |

A permission denial answers 500, not 403 and not 401. Worse for anyone tempted to
read the text instead, the 497 message reads *"Not enough privileges. To execute
this query, it's necessary to have grant SELECT"* - it contains neither "access
denied" nor "permission denied", so message sniffing misses it entirely.

## Classifying by exception code rather than status

Detection and classification are therefore split. Detecting that something
failed is status-based and lives in the transport. Deciding what failed is
code-based, read from the exception-code header, and the transport throws one
normalized error
carrying that number so provider logic switches on an integer instead of parsing
prose.

The payoff is which parts of the interface survive a restricted user. Every
monitoring method degrades to empty or zero on exactly two codes - 497
`ACCESS_DENIED` and 60 `UNKNOWN_TABLE` - and any other failure propagates,
because those two are the live-verified codes for "this surface does not exist
for this user or this deployment" while anything else is a mistake that must keep
surfacing. `system.data_skipping_indices` needs its own grant and answers 500 on
a user who lacks it, so a denied index catalog still yields a full table-and-column
tree with an empty index list. Query statistics come from `system.query_log`,
which records nothing while `log_queries` is off, and the panel says exactly that
rather than showing a zero.

The same numbers appear in ordinary editor work. A bare `UPDATE ... SET ... WHERE`
answers code 48 `NOT_IMPLEMENTED`, which is why inline row editing is not offered
here at all; the documented way to change a row is `ALTER TABLE ... UPDATE` typed
in the editor. Multi-statement SQL is rejected by the server itself with code 62,
so no client-side splitting is attempted.

## The stateless cost: settings and temporary tables do not persist

One request per statement has a price, and it is stated rather than hidden. No
`session_id` is pinned, so `SET` and temporary tables do not survive to the next
statement. A `SET max_block_size = 4096` sent on its own changes nothing you will
observe afterwards. The native protocol port is out of scope entirely and no
session is held between statements, so both of those are boundaries of this
transport, not bugs waiting on a fix.

The reason is concurrency. ClickHouse rejects concurrent use of one `session_id`,
which would serialize every request and break the parallel schema read that fires
three catalog queries at once. Per-request settings are still sent as URL
parameters, which covers what the provider actually needs - a statement deadline
via `max_execution_time`, for instance.

The same statelessness explains two more absences. There are no transactions:
ClickHouse has no general multi-statement transaction to wrap and the connection
is stateless HTTP, so there is no begin, commit or rollback. And there is no
`cancelQuery`; a running statement is stopped through the maintenance `kill`
operation with its query id, which needs its own grant like any other
`system.processes` operation.

One boundary that is not about the transport, but belongs next to these: agent
mode reads PostgreSQL, SQLite and DuckDB only, because the read-only profile is
database-native and exists only where a provider implements it. On any other
engine a run ends `engine-unsupported`. Plan mode opens on every connection - it
is toolless, runs nothing, and drafts a statement for you to run yourself.

To check any of this against a real server, the compose service above is the
shortest path; the [getting started guide](/get-started) covers pointing a Studio
container at it.
