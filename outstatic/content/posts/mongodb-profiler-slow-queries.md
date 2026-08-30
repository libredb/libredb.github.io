---
title: MongoDB slow queries stay empty until you enable the profiler
status: published
author:
  name: LibreDB
  picture: ''
slug: mongodb-profiler-slow-queries
description: The panel names the command to run instead of showing a blank table, and the metrics beside it are omitted rather than reported as zero.
coverImage: ''
tags:
  - value: engineering
    label: Engineering
  - value: databases
    label: Databases
publishedAt: 2026-08-17T09:00:00.000Z
---

Open the monitoring Queries tab on a fresh MongoDB connection and there is nothing
in it. Not because the read failed, and not because the server is idle. The
MongoDB slow query log is a collection, `system.profile`, and it does not exist
until somebody switches the profiler on. `getSlowQueries()` reads that collection
and nothing else, so before the profiler runs there is genuinely nothing to list.

The panel does not draw an empty table and leave you to work out whether the tool
is broken. It prints the sentence that names the missing step:

> Query stats come from the database profiler - run db.setProfilingLevel() to
> start recording into system.profile.

That string is `slowQueriesEmptyState`, a per-engine label on the MongoDB
provider. It used to be PostgreSQL's `pg_stat_statements` advice, hardcoded into
the panel for every engine including this one, and `pg_stat_statements` is a
PostgreSQL extension that a MongoDB server has no equivalent of.

## Where each MongoDB monitoring read gets its numbers

Each monitoring read is a separate call to the server, and the provider doc names
the commands behind every one. Knowing which read stands behind a panel tells you
what a blank panel means.

| Monitoring read | Commands it issues |
|---|---|
| Health | `serverStatus`, `db.stats()`, `currentOp`, `system.profile` |
| Overview | `serverStatus`, `buildInfo`, `db.stats()`, `listCollections` |
| Performance metrics | `serverStatus` (WiredTiger cache + opcounters) |
| Slow queries | `system.profile` |
| Active sessions | `currentOp` |
| Table stats | `collStats` per collection |
| Index stats | `$indexStats` plus `indexes()` |
| Storage stats | `db.stats()` plus the WiredTiger section |

Two consequences fall out of that table. First, the slow-query read has no second
source: no opcounter, no `currentOp` sample, no client-side timing stands in for
the profiler. Second, the reads divide along privilege lines. `serverStatus`,
`currentOp`, `$indexStats` and the profiler want `clusterMonitor` or an equivalent
role; `listCollections` and `collStats` do not. A user without the monitoring role
gets a populated Tables tab and an empty Performance tab, and that asymmetry is a
permissions answer, not a bug. The Overview read is the exception, because its
`listCollections` sits in the same `try` as `serverStatus`, so a refused
`serverStatus` takes the whole overview into the catch with it.

Every one of those methods is wrapped in try/catch, so one refusal costs one panel
rather than the dashboard. The same principle runs through the rest of the
[monitoring surface](/features): what a panel shows is bounded by what the engine
reports.

## Why the MongoDB slow query log, system.profile, is empty by default

Switching the profiler on is a mongosh command against the database you want
profiled - the same one the empty state names:

```js
db.setProfilingLevel(1)
```

Run it in mongosh or in your own shell session, not in the Studio editor. The
editor here parses a JSON command object and only that:

```json
{ "collection": "orders", "operation": "find", "filter": { "status": "open" } }
```

A statement beginning `db.` cannot be executed through this provider at all. That
is the same boundary the engine grid states on
[the databases page](/databases) - queries here are MongoDB queries, with no SQL
translation layer faked over them - and it cuts the other way too: mongosh syntax
is not the language the editor accepts either.

Once the profiler is on, the Queries tab lists per-operation time and documents
returned, sorted by `millis`, slowest first. The slow-query block inside the
Health read sorts the same collection by `ts` instead, most recent first, because
health is a question about now and the Queries tab is a question about what hurts.

One honesty note about that Health block: when the whole health read fails it
still emits a placeholder row reading `Error fetching health info` in the query
column. That is a fabricated row in a list of measurements, one size down from the
numbers described below, and it is still there because removing it requires
`HealthInfo.slowQueries` to become optional across all fifteen engine ids. It is
tracked, not defended.

## Omitted versus zero, and why the difference matters

The rule the rest of this dashboard follows is one sentence long. A number the
server never published is left out of the payload entirely. A number the server
published as zero is kept and rendered as zero.

They are different facts and they used to be the same value. The provider once
returned a hardcoded `cacheHitRatio: 99` when it could not read WiredTiger, and
`activeConnections: 0` and `databaseSizeBytes: 0` in the catch blocks around a
failed `serverStatus`. At the panel, an invented 99 is indistinguishable from a
measurement. A fabricated 0 is worse, because it also flattens a genuinely idle
server's real 0 into the same value, so the two can no longer be told apart
downstream.

Absence is now spelled explicitly - a `measuredNumber(...)` reading plus a
conditional spread - rather than `|| 0`, which invented a figure, or
`|| undefined`, which would have discarded a real one.

## Cache ratio, connections and database size

Three readings carry the rule, and each has its own reason to go missing.

**WiredTiger cache hit ratio.** Computed from `pages read into cache` over
`pages requested from the cache`. It is omitted when the deployment publishes no
`wiredTiger` section at all, when `pages requested from the cache` is 0 on a
server that has served nothing yet, and when `serverStatus` fails outright. The
Overview and Performance tabs then render *Cache Hit* as `N/A` beside *Not
measured*, and the card border stays neutral rather than being rated. A measured
0 - a genuinely cold cache - renders as `0.0%`. `bufferPoolUsage` follows the same
section and the same rule.

**Connection count.** From `serverStatus.connections.current`. The
`serverStatus` manual page promises no top-level field on every deployment, so a
`serverStatus` that answers without a `connections` section is treated as an
ordinary answer rather than an error. With the key absent, the Connections card
reads `N/A` above *not published*, and - this is the part a blank would not have
achieved - the sample is dropped from the connection sparkline instead of adding a
real 0 point to a trend line on every refresh.

**Database size.** From `dbStats.dataSize`. The Storage tab keys its entire
breakdown off whether `databaseSizeBytes` is defined. With the key present as a
fabricated 0 it treated the total as known and drew a breakdown over it: Tables
and Indexes at 0.0%, and an *Other (unattributed)* row computed as
`total - tables - indexes`. Because the table read does not share the failure -
`collStats` needs no monitoring role - real per-collection byte figures arrive
into that subtraction and the row renders a negative byte count as a measurement.
A 1 KB collection with 512 B of indexes printed the literal string `-1536 B`. With
the key omitted the tab draws *No storage size information available* instead.

So, plainly: slow queries come from `system.profile` and are empty until the
profiler is enabled, and the cache-hit ratio, connection count and database size
are omitted rather than reported as zero when their source published nothing.

## Two counts that still report zero, and why that is recorded as a limitation

The rule is not applied everywhere yet, and the exception is published rather than
quietly excluded. `tableCount` and `indexCount` on the overview object are
required numbers. They have no absence to spell, so a failed overview read - the
one an unprivileged user gets - reports 0 collections and 0 indexes on a database
that has plenty of both.

They are the one place in that object that states more than it read. Fixing them
is the same change the connection count and the byte figure already received, and
it is larger than it looks: both fields would have to become optional across all
fifteen engine type-ids, and every reader of them adjusted. Until that happens the
two zeros stand, listed in the provider's known limitations beside the readings
that were fixed.

A dashboard's job is to tell you what the server said. Where the server said
nothing, the least useful thing to print is a number.
