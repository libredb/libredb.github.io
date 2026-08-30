---
title: Stateless requests mean there is no session to count
status: published
author:
  name: LibreDB
  picture: ''
slug: libsql-monitoring-stateless-hrana
description: Active connections are absent rather than zero and no connection ceiling is published, while table and index bytes are real because the storage view answers.
coverImage: ''
tags:
  - value: engineering
    label: Engineering
  - value: databases
    label: Databases
publishedAt: 2025-12-15T09:00:00.000Z
---

Open the monitoring dashboard on a libSQL connection and several tiles have nothing in
them. That is the correct reading. A checklist written against a connection-pooled
engine - uptime, active connections, a cache hit ratio, a slow query log - misses on
almost every line here, and every miss traces back to one protocol decision made above
the storage layer.

libSQL is SQLite's dialect with a server in front of it. The server is `sqld`, and what
`sqld` speaks is Hrana: a list of requests posted as JSON to `POST /v2/pipeline`, one
result per request. One type-id, `libsql`, reaches both a self-hosted `sqld` and Turso
Cloud, because they speak that same protocol and embed the same SQLite - 3.47.0 measured
on both, on 2026-08-27. There is no driver dependency of any kind; the whole transport is
about 330 lines, and a statement travels through the runtime's own `fetch`.

## One statement, one request, no session

A pooled engine gives a monitoring dashboard its spine for free. A session exists, it has
a start time, a state and a current statement, so the server can be asked to list them.
Hrana has no session object. A statement is a request, the stream closes with it, and the
next statement is a new request. This provider holds nothing between the two.

That is also why transaction controls are hidden on this engine rather than shown and
then failed. libSQL has transactions; the provider closes its Hrana stream in the same
request as the statement, so it holds no session to carry one. `supportsTransactions` is
`false` and the controls do not render. The same fact drives everything below.

## What is absent, and why zero would be wrong

Here is the monitoring surface as it was measured through the product against both
deployments, with a fixture of two tables - 3 rows and 2000 rows - and one index.

| Panel | Reading |
| --- | --- |
| Uptime | `N/A` - no route or catalog publishes one |
| Max connections | `0`, this codebase's encoding for "no limit published" |
| Active connections | absent - Hrana is stateless |
| Cache hit ratio | `N/A` - SQLite's counters sit behind the C API, and no statement reaches them |
| Active sessions | empty - no session exists to report |
| Slow queries | empty, permanently - libSQL keeps no statistics about finished statements |
| Deadlocks | `0` |
| Health | `Integrity: OK`, `Journal Mode: wal` |

Two rows in that table are doing more work than the others.

**Active connections is absent, not zero.** `getActiveSessions()` answers `[]`, and the
tile renders no number at all. A `1` there would be the provider counting the request it
is making to ask the question - the dashboard describing itself. A `0` would be a claim
about the server that nobody measured. Absence is the only honest reading, and the same
rule governs the byte fields further down: where a figure is unavailable it is omitted,
because `0 B` next to a table name reads as an empty table.

**Deadlocks is a fact rather than a gap.** SQLite serialises writers behind one write
lock and refuses a second with `SQLITE_BUSY`, so `0` there is the engine's behaviour
written down, not a counter that failed to load. That distinction is why what each panel
can show is bounded by what the engine reports rather than by a shared layout, which is
the trade [the interface makes on every engine](/features).

State the boundary plainly, because it is the shape of this engine and not a defect:
**uptime is N/A, active connections are absent because each statement is its own
stateless HTTP request, no connection ceiling is published, and vacuum, analyze and
checkpoint are refused by the server's own statement allowlist.** Nothing on this page
is waiting for a later release to fill it in.

## The version each deployment publishes

`GET /version` is a `sqld` route. Turso Cloud does not have it and answers
`{"error":"route not found: [\"version\"]"}`, so `serverVersion()` returns `null` there
instead of throwing. The panel then reads what each deployment actually published:

- self-hosted: `sqld 0.24.33 (f8fb14f3 2026-08-11) (SQLite 3.47.0)`
- Turso Cloud: `SQLite 3.47.0`

Neither reads "Unknown", because in both cases the engine answered something. The Cloud
string is shorter because one route is missing, not because the reading failed, and a
dashboard that cannot tell those two apart teaches you to ignore it.

Those version strings are dated measurements against one build and one Turso Cloud
database, re-probed on the pinned `v0.24.33` image. They are not a supported range.

## Where the real byte figures come from

Two figures on this dashboard are measured rather than estimated: the bytes a table
occupies and the bytes its indexes occupy.

Introspection here is plain SQL: `sqlite_master` for tables, the `pragma_table_info`,
`pragma_index_list`, `pragma_index_info` and `pragma_foreign_key_list` functions for
structure, and `dbstat` for bytes.

```sql
SELECT name, SUM(pgsize) AS bytes FROM dbstat GROUP BY name
```

`dbstat` answers on both deployments. Against the fixture that produced 4096 bytes of
table and 4096 of index for the 3-row table, and 53248 bytes for the 2000-row one; the
database size tile read `64 KB`, 65536 bytes, from `page_count x page_size`. Row counts
are a real `SELECT COUNT(*)` per table rather than a statistics estimate. The index panel
lists `idx_customers_country` with its column and its 4096 bytes and reports `scans: 0`,
because no per-index scan counter exists to read.

The Storage tab shows one entry, `main`, at 65536 bytes, and no WAL size. No statement
reports the WAL, and the pragma that would checkpoint it is refused. So the tab is one
row, and the missing row has a reason printed where it would have been.

A whole schema read is three round trips regardless of table count, plus one for sizes,
because Hrana takes a list of requests and sends them together. A failing statement does
not abort the pipeline, so outcomes come back per statement: one table's column read can
fail while every other table in the tree stays intact.

## Maintenance the server itself refuses

The maintenance toolkit on this engine offers two operations, `reindex` and `check`.
Measured on both deployments:

| Statement | Result |
| --- | --- |
| `REINDEX` | accepted |
| `PRAGMA integrity_check` | accepted |
| `VACUUM` | refused |
| `ANALYZE` | refused |
| `PRAGMA optimize` | refused |
| `PRAGMA wal_checkpoint(TRUNCATE)` | refused |

The two deployments word the identical refusal differently under one error code, so
nothing in the provider matches on the message text. `runMaintenance` refuses those types
here rather than relaying a server error for a statement the user never typed, and
the controls are withheld rather than drawn and failed. The maintenance toolkit and the
audit trail are admin-only in any case.

`PRAGMA query_only = true` is on the same refused list, which is why agent AUTO mode ends
`engine-unsupported` on libSQL: the read-only profile is enforced by the database,
statement by statement, and there is no statement this provider can issue to establish
one here. The engine-side answer exists and is
a credential you create, `turso db tokens create <database> --read-only`. Agent plan mode
opens on this connection like any other - toolless, executing nothing, drafting a
statement for a human to run.

`PRAGMA integrity_check` is worth one more sentence, because its answer is read rather
than its status. A corrupt database reports the damage in the returned row while the
statement itself succeeds, so checking only for an error would report a healthy database.
