---
title: Which PostgreSQL health numbers need an extension or a grant
status: published
author:
  name: LibreDB
  picture: ''
slug: postgresql-health-panels-extension-gated
description: A tour of the health surface organised by what is missing and why, because a panel that reads Not measured is the only version an operator can act on.
coverImage: ''
tags:
  - value: engineering
    label: Engineering
  - value: databases
    label: Databases
publishedAt: 2026-08-11T09:00:00.000Z
---

Open the monitoring tab on a stock PostgreSQL container and several panels answer with a
label instead of a number. The slow-query list holds one row that reads
`pg_stat_statements extension not enabled`. There is no buffer-pool figure at all.
Checkpoint write time reads `N/A`. None of that is a fault in the connection - it is
PostgreSQL telling you what it publishes to the role you connected as, on the version you
are running, with the extensions you installed.

A dashboard has two ways to handle that. It can fill the gap with a plausible number, or it
can name the gap. This one names the gap. What follows is which statistics view backs each
panel, and what has to be true for that view to answer.

## Which statistics view backs each panel

There is no metrics agent in the container and no sampling daemon. Every panel is a
`SELECT` against PostgreSQL's own statistics views, issued over the same `pg` connection
pool the editor uses.

| Panel | View or function it reads |
| --- | --- |
| Health: connections, size, cache hit, sessions | `pg_stat_activity`, `pg_database_size`, `pg_statio_user_tables`, `pg_stat_statements` |
| Overview: version, uptime, max connections, object counts | `version()`, `pg_postmaster_start_time()`, `pg_settings`, `pg_tables`, `pg_indexes` |
| Performance: cache hit, deadlocks, checkpoint write time | `pg_statio_user_tables`, `pg_stat_database`, `pg_stat_bgwriter` |
| Slow queries | `pg_stat_statements`, falling back to `pg_stat_activity` |
| Sessions | `pg_stat_activity`, excluding the app's own backend |
| Tables: live and dead tuples, vacuum times, bloat | `pg_stat_user_tables` plus the size functions |
| Indexes: type, size, scan count, usage ratio | `pg_stat_user_indexes`, `pg_index`, `pg_am` |
| Storage | `pg_tablespace` and the WAL functions |

Reading the table as a list of dependencies is the useful move. Four of those rows carry
a condition. `pg_stat_statements` is an optional extension, so the Health and Slow
queries rows answer only where someone has installed it. The WAL functions behind Storage
and the `pg_stat_bgwriter` counters behind Performance are privilege-gated, and
`pg_stat_bgwriter` also changed shape in PostgreSQL 17. The remaining four rows read
catalog and statistics views directly, with no optional extension in the path.

## Slow queries without pg_stat_statements

This gap degrades in two different ways depending on which panel you are looking at, which
is worth knowing before you read either one.

The dedicated slow-query view calls `getSlowQueries()`. Without the extension it falls
back to a snapshot of `pg_stat_activity`: the queries running at the moment you looked.
That is a different quantity from what the panel is for. `pg_stat_statements`
accumulates per-statement totals since the last reset, so a short query that runs
constantly rises to the top on volume alone. A live snapshot shows you whatever was in
flight during one round trip, and a fast frequent query is rarely in it.

The health summary calls a lighter slow-query block, and that one does not fall back at
all. It returns a single placeholder row reading `pg_stat_statements extension not
enabled`. One panel shows the wrong shape of data with a label saying so; the other
shows no data with a label saying why.

Both paths are wrapped in try/catch, so a missing extension never fails the monitoring
request; it changes what the request can answer. Enabling `pg_stat_statements` is a
server-side change made outside Studio, against the PostgreSQL documentation for your
version - the provider installs nothing.

Until the view is there, treat the panel as a session list, not a workload profile.

## Why there is no buffer-pool figure at all

The performance tab has a cache hit ratio and no buffer-pool usage. That asymmetry is
deliberate and it was once a bug.

`bufferPoolUsage` used to be computed as `blks_hit / (blks_hit + blks_read)` from
`pg_stat_database`. That expression is a cache hit ratio. The tab was therefore drawing
the same quantity in two places with one of the two mislabelled, and when both counters
were zero it substituted `100`, so an untouched database reported a perfect buffer pool.

PostgreSQL publishes no buffer-pool occupancy figure. The number exists only through the
`pg_buffercache` extension, which is not installed by default and whose scan takes a
lock over `shared_buffers`. So the field is not reported. Not zero, not estimated - the
panel does not exist, which is the only reading that does not mislead someone deciding
whether to raise `shared_buffers`.

The cache hit ratio itself has the same discipline applied one level down. It comes from
`pg_statio_user_tables`, and that view has nothing to divide in two ordinary situations:
a database with no user tables, where the aggregate is `NULL`; and a table nothing has
read yet, where `heap_blks_hit` and `heap_blks_read` are both `0` and the ratio is a
division by zero. In both cases the panel reads "Not measured". Both statements used to
wrap the result in `COALESCE(..., 100)`, so an unmeasured database was rated Excellent.

## Checkpoint and WAL readings that need a grant

WAL size in the storage tab comes from the WAL functions, which are superuser-gated. A
denial there is caught and the field is omitted rather than surfaced as an error, because
a permission boundary is not an incident.

Checkpoint write time is the more interesting one, because it is gated by version as
well as by privilege. PostgreSQL 17 moved `checkpoint_write_time` and
`checkpoint_sync_time` out of `pg_stat_bgwriter` into `pg_stat_checkpointer`. On 17 and
later the query against `pg_stat_bgwriter` throws, and `checkpointWriteTime` reports
`N/A`. Measured through this provider on 2026-08-23 against `postgres:18`, that is what
the panel shows. It is never `0.0s`, which would be indistinguishable from a server that
has genuinely written nothing since its counters were reset.

Deadlocks follow the same rule from the other direction. When `pg_stat_database` has no
row for the connected database, `deadlocks` is absent from the response rather than
reported as zero deadlocks. Absent means nobody counted. Zero means somebody counted and
found none.

## Absent, zero and Not measured are three different answers

The whole design of this surface is that those three states stay distinguishable. The
boundary, stated plainly: without `pg_stat_statements` the
slow-query list falls back to a live `pg_stat_activity` snapshot and health returns a
placeholder row instead of a list. `bufferPoolUsage` is never reported on this engine.
Per-second counters - `transactionsPerSecond` and `queriesPerSecond` - are absent
entirely, because deriving them needs time-based sampling of `pg_stat_database` and the
metric call is single-shot. And `blocked` on an active session is always `false`:
lock-wait detection through `pg_locks` is not wired in, so an empty blocked column is a
statement about the code, not about your locks.

That last one is the sharpest example of why the distinction matters. A `false` you
believe is worse than a panel you know is missing, and it is the reason the [monitoring
surface](/features) reports absences as absences. PostgreSQL is the engine where
[nothing is held back](/databases) in feature coverage, and it is still an engine whose
health surface depends in places on an extension, a grant or a major version. Those are
two compatible facts, and publishing both is cheaper than explaining one of them during
an incident.
