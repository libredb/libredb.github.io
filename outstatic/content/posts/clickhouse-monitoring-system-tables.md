---
title: Monitoring ClickHouse from its own system tables
status: published
author:
  name: LibreDB
  picture: ''
slug: clickhouse-monitoring-system-tables
description: 'Every ClickHouse monitoring panel is a read of a catalog the server already maintains, with two boundaries: a setting that empties one panel, and a counter nobody publishes.'
coverImage: ''
tags:
  - value: engineering
    label: Engineering
  - value: databases
    label: Databases
publishedAt: 2026-03-25T09:00:00.000Z
---

A blank monitoring panel and a broken monitoring panel look the same from the
outside. Both show nothing, and the person looking at them has to guess which one
they got. On ClickHouse the Queries panel has a legitimate way of being empty that
has nothing to do with the read failing: a server setting. Making that
distinguishable without opening a terminal is most of what follows.

The whole surface arrives over one transport. The ClickHouse provider carries no
driver: every statement is the body of a `POST /` on the documented HTTP interface,
default port 8123, 8443 with TLS, answered through the runtime's own `fetch`. There
is no connection pool, because there is no session — each read below is one
stateless request.

## Which system table backs each panel

Nothing here is computed by the tool. Each panel is a read of a catalog the server
already maintains, and the panel is worth exactly what that catalog is worth.

| Panel | Read from |
| --- | --- |
| Overview | `version()`, `uptime()`, `system.metrics`, `system.server_settings`, `system.parts`, `system.tables`, `system.data_skipping_indices` |
| Performance | `system.events` (`MarkCacheHits`, `MarkCacheMisses`, `Query`), `system.asynchronous_metrics` (`MemoryResident`, `OSMemoryTotal`) |
| Queries | `system.query_log` where `type = 'QueryFinish'` |
| Sessions | `system.processes` |
| Tables | `system.parts`, active parts only |
| Indexes | `system.data_skipping_indices` |
| Storage | `system.disks` |

Three figures in the Performance row are substitutions rather than direct
equivalents, and saying so is the point. The cache hit ratio is the mark cache,
which is this engine's nearest equivalent to a buffer cache, not a page cache
figure borrowed from somewhere else. Buffer pool usage is resident memory against
total machine memory. Queries per second divides the lifetime `Query` counter by
uptime, because a single-shot read never samples the same counter twice and cannot
produce a rate any other way.

The overview is five separate reads on purpose, not one statement. A restricted
user gets a 200 from `version()`, `uptime()` and `system.tables` and a failure from
`system.metrics` and the two count queries. Combined into one statement, the whole
panel would go dark; split, the reader keeps the half the grant allows.

## The Queries panel groups by normalized query hash

The Queries panel does not list executions. It lists statement shapes.

`system.query_log` is filtered to `type = 'QueryFinish'` and grouped by
`normalized_query_hash`, so one row is one statement shape with its call count and
its minimum, maximum and average duration. That is the same grouping
`pg_stat_statements` performs on PostgreSQL, and it is the grouping that makes the
panel readable: a dashboard query fired ten thousand times with the same literals
substituted is one row worth reading, not ten thousand rows worth scrolling.

```sql
SELECT normalized_query_hash, count() AS calls, avg(query_duration_ms)
FROM system.query_log
WHERE type = 'QueryFinish'
GROUP BY normalized_query_hash
```

One behaviour to know before you file a bug against it: `system.query_log` is
flushed asynchronously. A statement that finished a moment ago may not be in the
table yet. If you run something slow, switch to the Queries panel and do not find
it, waiting a few seconds is the correct response.

The sessions read has a smaller version of the same self-awareness. `system.processes`
is filtered with `query NOT LIKE '%system.processes%'` so the panel does not report
itself as an active query, which is the same exclusion the PostgreSQL provider
applies to `pg_stat_activity`. Every row is reported with a constant state of
active, because ClickHouse has no idle-in-transaction equivalent to distinguish.

## The empty panel is the log_queries setting

Here is the limit, stated plainly. **Query statistics come from the query log, which
records nothing while query logging is off.** The ClickHouse `log_queries` setting
controls whether the server writes to `system.query_log` at all. With it off, the
table exists and is empty, the read succeeds, and the panel has nothing to draw.

That is why the empty state on this engine says what it says: *Query stats come
from system.query_log, which records nothing while log_queries is off.* It names
the setting because the setting is the action. Nothing about the connection, the
grant or the network needs investigating first.

This label used to be wrong. It was hardcoded to PostgreSQL's `pg_stat_statements`
advice for every engine, which meant a ClickHouse operator staring at an empty
ClickHouse slow query panel was told to install an extension their server has never
heard of. An empty panel that gives the wrong instruction is worse than an empty
panel that gives none.

The tool does not turn `log_queries` on. The maintenance toolkit is admin-only and
offers three operations here and only three — optimize, analyze and kill — and none
of them writes a server setting.

## Two codes degrade a panel, and everything else propagates

Every monitoring method here degrades to empty or zero on exactly two exception
codes: 497 `ACCESS_DENIED` and 60 `UNKNOWN_TABLE`. Any other failure propagates to
the surface unchanged.

Those two are the live-verified codes for *this surface does not exist for this user
or this deployment* — a missing grant, or a system table an older or trimmed build
does not have. Everything else is a real fault, and swallowing it would turn a
broken server into a quiet dashboard, which is the failure mode this design exists
to avoid.

The classification is done by numeric code rather than by HTTP status, and it has
to be: a permission denial on ClickHouse answers HTTP 500, not 403 or 401. Status
alone cannot tell a revoked grant from a crashed read. That is a live-verified
finding of this provider, not general folklore.

The practical shape of a restricted user, then: the schema tree and the overview
survive, and only the panels and maintenance operations that need their own grant
go quiet. Which panel went quiet tells you which grant is missing. It is the same
rule the [engine list](/databases) states — a control that cannot work is hidden,
not offered and then failed — applied to a surface that degrades panel by panel
rather than all at once.

## Index scan counts, and the zero that is honest

The Indexes panel reads `system.data_skipping_indices` and reports every index with
a scan count of zero. Always zero, on every index, on every deployment.

**ClickHouse publishes no per-index usage counter anywhere the HTTP interface can
reach.** There is no catalog to read the number out of. The options were to omit
the column, to estimate it, or to print an obvious zero, and the zero wins because
an estimate in a column labelled as a count is a number an operator will act on.

Two other figures are shaped by the same rule and are worth knowing so you read
them correctly:

- Row counts and table sizes come from the server's own bookkeeping,
  `system.tables.total_rows` and `total_bytes`, not from `COUNT(*)`. For views and
  non-MergeTree engines they are reported as unknown rather than zero, because
  those two things are not the same claim.
- Maximum connections is zero where `system.server_settings` is unavailable. It is
  an ordinary system table on self-managed builds and was verified present on OSS
  26.7.1, but it is grant-gated like every other `system.*` read, and it degrades
  rather than failing the panel.

Storage numbers here are as good as `system.parts` and `system.disks` are, and no
better. The panel reports the engine's own catalog, and where the catalog is silent
it says zero or unknown rather than filling the gap. Each engine's published
boundary sits on the [engine list](/databases) next to its transport and default
port, so it is readable before you connect rather than after.
