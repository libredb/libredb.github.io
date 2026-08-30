---
title: The widest DMV surface here, and the grant it depends on
status: published
author:
  name: LibreDB
  picture: ''
slug: sqlserver-view-server-state-monitoring
description: Real blocked-session detection and real index seek and scan counts are things most engines cannot give, and a restricted login still sees none of them.
coverImage: ''
tags:
  - value: engineering
    label: Engineering
  - value: databases
    label: Databases
  - value: security
    label: Security
publishedAt: 2026-06-17T09:00:00.000Z
---

A session is stuck. You want to know which other session is holding it, and you
want to know it from the dashboard rather than from a script someone pasted into
a runbook in 2019. On most engines here, the honest answer is that the dashboard
cannot tell you. SQL Server DMV monitoring with blocked sessions is the
exception: the reading is real, it comes from a documented dynamic management
view, and it arrives beside real index seek and scan counts.

Then you connect with the login your security team actually issued you, and the
same dashboard goes blank.

Both of those sentences are true at once, and that is why this engine's
monitoring capability is published as `partial` rather than `full`.

## What the dynamic views make possible here

Monitoring on this provider is not a synthesised health score. It is a fan-out of
independent reads against `sys.dm_*` views and `sys.database_files`, each one
answering for itself. `getMonitoringData()` issues them in parallel, and each
sub-query is separately guarded, so one refusal does not take the tab down with
it.

| Panel | Where the number comes from |
| --- | --- |
| Health, sessions | `sys.dm_exec_sessions` |
| Cache hit ratio | `sys.dm_os_performance_counters` |
| Slow queries | `sys.dm_exec_query_stats` joined to `sys.dm_exec_sql_text` |
| Active sessions, blocking | `sys.dm_exec_requests` joined to the session view |
| Index usage | `sys.dm_db_index_usage_stats` |
| Table sizes | `sys.tables`, `sys.partitions`, `sys.allocation_units` |
| Storage | `sys.database_files` |

Nothing on that list is inferred from the schema. The slow-query panel reports
logical and physical reads from the query-stats view rather than estimating them,
and the table panel reports `STATS_DATE` as the last statistics update.

## SQL Server DMV monitoring: blocked sessions and index usage, both real

Two of those readings are worth naming individually, because the same panels on
other engines here are filled differently.

**Blocking is measured, not defaulted.** The active-sessions panel derives its
`blocked` flag from `blocking_session_id > 0` in `sys.dm_exec_requests`. This is
the only provider in the product that does. The PostgreSQL, MySQL and Oracle
providers report `blocked: false` for every session. A `false` there is a
placeholder; here it is an answer, and the session id it points at is the one
you would pass to a kill.

**Index counts are usage, not cardinality.** The index panel joins
`sys.dm_db_index_usage_stats` and reports seeks plus scans plus lookups since the
statistics were last reset. That is a record of what the engine actually did with
the index. It is the same calibre of reading as PostgreSQL's
`pg_stat_user_indexes.idx_scan`. The Oracle provider reports `0` in that column
and the MySQL provider substitutes `CARDINALITY`, which is a description of the
index rather than of its use. On SQL Server, an index whose seeks, scans and
lookups are all zero is an index nothing has touched since that reset.

Who is blocking whom, and which indexes are earning their maintenance cost, are
both readings rather than defaults here, which is why this is the widest read
surface of any provider in the [capability set](/features).

## The one grant everything is behind

Most of that table is `sys.dm_*`, and those dynamic management views are server-
scoped, so they need a server-level permission. The grant is `VIEW SERVER
STATE`. On SQL Server 2022 and later Microsoft split out a narrower `VIEW SERVER
PERFORMANCE STATE`, which `VIEW SERVER STATE` implies, so the coarser grant
remains the one that covers every panel on either version.

Without it, the reads do not degrade politely. They are refused. Measured on
2026-08-23 against SQL Server 2022 CU26, using a login holding nothing beyond
`CONNECT`:

```
Msg 300, Level 14, State 1, Line 1
VIEW SERVER PERFORMANCE STATE permission was denied on object 'server', database 'master'.
```

The provider catches that per sub-query and turns it into an absence rather than
a zero. The slow-query list comes back `[]` with an empty state that names the
cause - query stats come from `sys.dm_exec_query_stats`, which needs the server
grant - instead of repeating advice about a PostgreSQL extension that does not
exist here. The connection count is omitted entirely: `activeConnections` is an
optional field, the key is absent from the `POST /api/db/health` body, and the
Connections card renders `N/A` over "not published" and drops the sample from the
trend chart rather than plotting a `0`.

That distinction is the whole design of the guard. A count of `0` is a reading
about an idle instance. A count that was refused is not a reading at all, and
publishing it as `0` describes a busy server as idle on the strength of a
permission error.

The same restriction arrives a second way. On Azure SQL Database, server-scoped
DMVs are restricted by the platform, and `sys.dm_exec_sessions` there wants
`VIEW DATABASE STATE`, which cannot be granted in `master`. Nothing is
misconfigured in that case; the panels are simply empty for the same reason.
Granting server-state to a reporting login is a real privilege decision, and it
belongs in the same conversation as the rest of the
[deployment boundaries](/security) rather than being handed out to make a chart
render.

## Why performance metrics stop at a single figure

Here is the limit, stated plainly. **`getPerformanceMetrics()` on SQL Server
reports only the buffer-cache hit ratio - no queries per second, no deadlock
count, no buffer-pool usage - and it omits even that one figure when
`sys.dm_os_performance_counters` cannot be read. A login without the server-state
grant gets `N/A` and empty lists across the dashboard.**

When the ratio is unreadable, `getHealth().cacheHitRatio` is the string `"N/A"`
and the Overview and Performance tabs render "Not measured". There are two
ordinary ways to reach that state: the permission denial above, or a counter base
of zero, where a `NULLIF` guard makes the division return a single `NULL` row. A
ratio genuinely measured as zero is a different thing and is kept, and shown as
`0.0%`.

This behaviour is newer than the panel. `getHealth()` used to publish `"0%"` for
an unreadable ratio and `getPerformanceMetrics()` used to default to `100`. The
`0%` was the more damaging of the two, because the Overview card rates a low ratio
"Needs tuning": a least-privilege login was shown a cache fault SQL Server had
never reported.

`bufferPoolUsage` was removed for a related reason. It had been assigned the cache
hit ratio itself - the same number under a second name, drawn and rated as though
it were an independent gauge. SQL Server does publish pool occupancy through
`sys.dm_os_buffer_descriptors`, but this provider does not query it, and that scan
is not free. One measured number is worth more than two names for it.

## Grading a capability by its weakest login

The temptation is to grade the capability by its best day, on the administrator
connection that holds the grant already. We grade it by the login a reader is
likely to hold instead, and by that measure it is partial: one missing grant
collapses most of the dashboard to `N/A` and empty lists, and the one
performance figure that exists is a single ratio.

There is one case the guard cannot catch, and it is worth publishing rather than
discovering. On SQL Server 2019 and earlier, `sys.configurations` needs only the
`public` role, and the session view is documented as showing an ungranted login
its own session rather than refusing it. Read literally, that login gets a
row-filtered `COUNT(*)` - its own connection, not the server's - and the card
draws a confident `1/32767`. The statement succeeded, so no guard runs. That is a
wrong measurement rather than an absence, it is what Microsoft's permissions
wording implies rather than something we have observed on a live instance, and
separating the two would need a permission probe rather than a `try`/`catch`.

The maintenance actions that sit beside these panels - Update Statistics, Check
Database, Rebuild Indexes, Kill Session - are admin-only, as is the audit trail.
Read access to the dashboard and the ability to act on it are different grants in
SQL Server, and they are different grants here too.
