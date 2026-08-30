---
title: With performance_schema off, MySQL metrics are absent not zero
status: published
author:
  name: LibreDB
  picture: ''
slug: mysql-performance-schema-off-metrics-absent
description: Cache hit ratio, queries per second and buffer-pool usage are omitted rather than defaulted, and two more figures mean less than their names suggest.
coverImage: ''
tags:
  - value: engineering
    label: Engineering
  - value: databases
    label: Databases
publishedAt: 2026-08-14T09:00:00.000Z
---

A cache hit ratio of `0` and a cache hit ratio that nobody measured are not the
same fact. The first is a server in trouble. The second is a server that was never
asked, or was asked and declined to answer. A MySQL server with `performance_schema`
off does not raise an error when you query its performance figures - it answers a
row of NULLs. Anything that coerces those NULLs to numbers has just written down
three measurements that were never taken.

The rule this provider follows is short. A metric the server never published is
left out of the reading rather than defaulted into it.

## Where each panel reads from

Monitoring on MySQL is not one query. `getMonitoringData()` fans out several reads
in parallel, each against a different reporting interface, and they fail
independently:

| Panel | Source |
| --- | --- |
| Overview | `VERSION()`, `SHOW STATUS` / `SHOW VARIABLES`, `information_schema` |
| Performance | `performance_schema.global_status` and `SHOW STATUS` |
| Queries | `performance_schema.events_statements_summary_by_digest` |
| Sessions | `information_schema.PROCESSLIST` |
| Tables | `information_schema.TABLES`, with bloat estimated from `DATA_FREE` |
| Indexes | `information_schema.STATISTICS` plus `mysql.innodb_index_stats` |
| Storage | `information_schema.TABLES` and `SHOW BINARY LOGS` |

Reading that table top to bottom tells you which panels are conditional. Only two
rows depend on `performance_schema`. Schema introspection, sessions, sizes, row
counts and `EXPLAIN FORMAT=JSON` are on the other interfaces and are unaffected by
its state.

The reads are gathered with `Promise.allSettled`, so a refused panel costs only
itself. A rejected read is recorded under `errors.<panel>` and rendered as an
unavailable panel carrying the server's own sentence - `ERROR 1142`, say, when the
connected user has no grant on the digest table. One panel going dark does not
empty the six beside it; the reading throws only when all four core reads reject.

## MySQL monitoring with performance_schema disabled

With `performance_schema` off, the tables still exist and are still selectable. The
metric queries therefore succeed and return NULL. Every reading in
`getPerformanceMetrics()` is taken through a `measuredNumber()` helper, and a field
with nothing behind it is left out of the returned object entirely rather than set
to zero. Cache hit ratio, queries per second (`Queries` divided by `Uptime`) and
buffer-pool usage are absent. The panels show them as unmeasured.

The digest table behaves the same way. Off, it is readable and answers zero rows,
so the Queries panel is empty rather than broken. Measured 2026-08-27 on MySQL
26.7.0 started with `--performance-schema=OFF`, the slow-query list came back as
`[]` on both the health line and the panel. That is why an exception cannot be used
as the signal for "the capability is off" - the off state never raises one.

What does raise is the source being unreadable: no `performance_schema` database at
all (`ERROR 1049`), or a grant denied on it (`ERROR 1142`). Where the database is
absent outright, `getPerformanceMetrics()` returns `{}` - nothing measured, rather
than the `cacheHitRatio: 99` an earlier version defaulted to.

If you want the figures, start the server with the instrumentation on:

```yaml
services:
  mysql:
    image: mysql:latest
    command: ['--performance-schema=ON']
    environment:
      MYSQL_ROOT_PASSWORD: root
      MYSQL_DATABASE: app
    ports:
      - '3306:3306'
```

This is worth checking before you conclude anything from an empty Performance tab.
MariaDB reaches this same provider - there is no separate type id - and it ships
`performance_schema` off by default.

## Index scans are a cardinality estimate, not a usage counter

The Indexes panel has a `scans` column, and on MySQL that column is
`information_schema.STATISTICS.CARDINALITY`. Cardinality is the optimiser's
estimate of how many distinct values an index holds. It is not a count of how many
times the index was used, and there is no MySQL equivalent of the per-index scan
counter other engines expose.

The practical consequence is that you cannot find an unused index this way. A
never-touched index on a high-cardinality column reports a large number; a
constantly-used index on a boolean column reports two. Sorting the panel by that
column ranks columns by their distribution, not by anything about your workload.

The same panel is careful in the other direction about size. The per-index byte
figure comes from `mysql.innodb_index_stats`, which needs `SELECT` on the `mysql`
schema and has no row at all for a MyISAM table. In both cases `indexSizeBytes` is
omitted and the cell reads `N/A`, rather than a `0 B` the server never reported.
Row counts on the Tables panel carry the same caveat from the other direction:
`TABLE_ROWS` is an InnoDB estimate, and bloat is inferred from `DATA_FREE`.

## The deadlock counter that is the inverse of expectation

Deadlocks are the one performance figure that survives `performance_schema` being
off, because it comes from `SHOW STATUS`, which answers either way. A `0` there is a
real measurement and is reported as one, where the server publishes the variable.

It is also the one figure absent on the engine this provider is named for. The
metric reads the status variable `Innodb_deadlocks`, which MariaDB publishes and
MySQL does not - measured as an empty `SHOW STATUS` result on both 8.0.46 and
26.7.0:

```sql
SHOW STATUS LIKE 'Innodb_deadlocks';
-- MySQL: Empty set
```

So the expectation inverts. Turn instrumentation on and you get cache hit ratio,
queries per second and buffer-pool usage but still no deadlock count. Point the
same code at a default MariaDB and you get the deadlock count and none of the other
three. Neither server is broken; each publishes a different set, and the reading
reports the intersection of what was asked for and what came back.

## Reading a dashboard full of honest gaps

With `performance_schema` off every performance field is omitted rather than
defaulted, index scans are `CARDINALITY` rather than a usage counter, and the
deadlocks metric is absent on MySQL because it reads a status variable MySQL does
not publish. Those three are the difference between a panel you can act on and a
panel you can be misled by.

A gap on these panels means the server did not publish the number. It never means
the number is zero, and it never means the value is small. When absence has its own
rendering, a `0` you do see is load-bearing.

It is also why the empty state carries no cause. The Queries panel shows one fixed
sentence for every empty list, whatever produced it, because the one cause a reader
would guess - instrumentation off - is the cause that never reaches the error path.
Guessing there would be the same defect one level up.

The [monitoring surface](/features) is bounded by what each engine's own reporting
interface publishes, and that boundary differs from engine to engine. What each one
does and does not answer is published on the [engine pages](/databases) next to its
transport and default port, so you can check before you build a runbook on a figure
that turns out to be a cardinality estimate.
