---
title: Monitoring a query engine that stores nothing
status: published
author:
  name: LibreDB
  picture: ''
slug: trino-monitoring-owns-no-storage
description: Nodes, sessions, slow queries and per-catalog connectors all report, while database size is N/A rather than zero, because there is no storage to measure.
coverImage: ''
tags:
  - value: engineering
    label: Engineering
  - value: databases
    label: Databases
publishedAt: 2026-03-31T09:00:00.000Z
---

The monitoring dashboard has seven tabs, and on Apache Trino several of them
answer with a refusal. A coordinator can observe the nodes in the cluster, the
statements in flight and the history it still remembers; it observes no bytes on
disk, because it owns none. Every table Trino can name belongs to a system behind
a connector, and so does that table's footprint.

So the question is not which panels work, but what the empty ones are allowed to
say. A blank figure has two readings, and they are not the same fact: *nobody
measured this* and *this measures zero*. For storage on Trino it is always the
first.

## Where each panel reads from

Nothing here is scraped from the web UI. Every reading is a statement sent down
the client protocol, `POST /v1/statement`, against `system`, `jmx` and the
`information_schema` of the catalog the connection pins.

| Panel | Statement source | What comes back |
| --- | --- | --- |
| Overview | `system.runtime.nodes`, `information_schema.tables`, `system.runtime.queries` | Version, table count, statements in flight |
| Overview uptime | `jmx.current."java.lang:type=runtime"` | The coordinator JVM's uptime |
| Sessions | `system.runtime.queries`, non-terminal states | The statements running now |
| Queries | `system.runtime.queries`, `FINISHED` rows by elapsed time | The coordinator's recent history |
| Storage | `system.metadata.catalogs` | One row per catalog, `location` = its connector |
| Tables | `SHOW STATS FOR <table>`, one statement each | Row counts and logical sizes, or a refusal |
| Performance | `jmx.current."trino.execution:name=querymanager"` | Queries per second |

The version field is the bare string `476` - no product name, no semver, because
that is what `system.runtime.nodes.node_version` holds. Uptime needs the `jmx`
catalog configured: nothing in `system.runtime` records a start time, and
`/v1/info`, which does report one, is not a statement. A cluster without `jmx`
reads `unknown` there rather than failing the overview: `CATALOG_NOT_FOUND` maps
to `unknown-object`, one of the two categories that mean *this surface is not
available here*. Every other failure propagates, since a timeout hidden behind an
empty panel is hidden forever.

The index reading is the one place a zero is honest: it returns an empty list and
sends no statement at all. Trino's `information_schema` holds exactly eight
views, with no `table_constraints` and no `key_column_usage`, so no connector can
declare a key through it. Zero is the true count, and it cannot vary with the
connection, so there is nothing to ask.

## Sessions and slow queries on a coordinator

A sessions tab on a PostgreSQL connection lists connections. Trino has none: the
client protocol is stateless HTTP, each statement is its own exchange, and there
is no session object anywhere to count. The panel shows statements in flight
instead, the nearest true thing.

That mapping leaves one column deliberately blank. `system.runtime.queries` has
no catalog column, so the per-session database field is an empty string rather
than the catalog this connection pinned - filling it in would credit somebody
else's statement with a catalog it may never have touched.

The queries tab inherits two more honest blanks. Call count is `1` and row count
is `0` on every row, because that table records executions rather than
statements: nothing aggregates, total time equals average time, and there is no
row-count column at all. The history behind it is a bounded in-memory window a
restart empties, and the panel's empty state says so - these stats hold only what
this coordinator still remembers.

The read also sees itself, as a `RUNNING` row, and that is not filtered: the
coordinator really is executing that statement.

## No database size, and why zero would be a lie

Trino publishes exactly one byte figure, `data_size` from `SHOW STATS`. It is per
table, an estimate, and null for every fixed-width column - measured on
`tpch.tiny.region`, `34` and `330` for the two varchars and null for the bigint.
There is no catalog of sizes to aggregate, and no capacity a percentage could be
a fraction of.

So the overview's database size is the string `N/A`, and the numeric field beside
it is not written at all: the key is absent from the object rather than present
holding `0`. A `0` is a measurement, and the storage tab formats whatever number
it is given, so a fabricated `0 B` beside a 0.0 percent breakdown is exactly what
this refusal avoids. The rows name the catalogs and their connectors instead,
which is where the data is.

The same rule caught the panels above it. The overview and performance tabs once
read two absent fields as zero, drawing a 0 percent bar rated **Poor** in red
beside a `0` deadlock count badged **Healthy** - a fault and a clean bill of
health for figures nobody measured. Both now read `N/A` beside the words
*Not measured*. Cache hit ratio is scored critical below 80, so a neutral `0`
there would have painted every healthy cluster red.

## One statement per table, and the cap that follows

`SHOW STATS` takes one table, or one query. There is no batch form, so describing
N tables costs N statements, and the pass is bounded at 25 of them.

That bound used to truncate: the reading described the first 25 tables of the
scope, returned those rows, and no consumer could tell. The result is a plain
array, and 25 rows out of 500 are indistinguishable from a catalog holding
exactly 25 - a cap read as a count is the absence lie one size up. An oversized
scope is refused outright now, which is also cheaper: the table list has already
answered the question, so no `SHOW STATS` is sent.

Measured against the probe cluster:

| Scope | User tables | Reading |
| --- | --- | --- |
| `tpch` | 72 | Refused, naming 72 |
| `tpch.tiny` | 8 | 8 rows - `lineitem` 60,175, `nation` 25 |
| `system` | 26 | Refused, naming 26 |
| `tpcds` | 250 | Refused, naming 250 |
| `jmx.current` | 379 | Refused, naming 379 |
| `memory` | 0 | `[]` - a measurement, not a refusal |

The limit, stated plainly: the tables panel describes at most 25 tables and goes
absent with a stated sentence above that, database size and per-catalog size are
`N/A` because this engine stores nothing, and the performance tab reports one
field with every other left absent.

The bound applies to what was asked for, not to what the catalog holds, so a
schema inside it is describable in a catalog of any size - which is how
`tpch.tiny` stays readable while `tpch` is refused. The refusal says how many of
the schemas the catalog's tables are in would fit the bound, or that none would,
rather than offering a remedy that fails; each version ends with the statement no
bound applies to, `SHOW STATS FOR "<catalog>"."<schema>"."<table>"`.

## Metrics that belong to the connector behind the catalog

The performance tab reports queries per second and nothing else, and each absence
is a different impossibility rather than a gap: Trino runs no transactions, holds
no buffer pool because it holds no pages, takes no locks so counts no deadlocks,
writes no checkpoints, and its caches belong to the connectors, which publish no
hit ratio through it.

The one field it does report comes from the coordinator's own JMX counter rather
than from counting rows of query history over a window: that history is bounded
and trimmed, so a derived rate would fall towards zero on a busy cluster the
moment the window wrapped.

The same ownership argument settles maintenance. Trino has no vacuum operation,
because it owns no storage to reclaim, and it computes no statistics of its own.
`ANALYZE` is in the grammar, but every connector decides for itself whether it
implements it, and the memory connector answers *This connector does not support
analyze*. A button that always fails is worse than a stated reason. The
maintenance toolkit is admin-only in any case, and on this engine no maintenance
control is rendered at all.

A panel can be absent with a sentence rather than empty because of the
[capability declarations](/features) each engine publishes, and Trino's line on
the [engine list](/databases) says the rest: it queries catalogs, and the storage
behind them is somebody else's.
