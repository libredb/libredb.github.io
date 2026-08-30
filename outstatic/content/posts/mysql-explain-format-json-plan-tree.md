---
title: Reading MySQL EXPLAIN FORMAT=JSON as a plan tree
status: published
author:
  name: LibreDB
  picture: ''
slug: mysql-explain-format-json-plan-tree
description: 'What the plan tree answers on MySQL, and where the surrounding introspection runs out: index figures here are estimates of distinct values.'
coverImage: ''
tags:
  - value: engineering
    label: Engineering
  - value: databases
    label: Databases
publishedAt: 2026-07-17T09:00:00.000Z
---

A join gets slow, someone runs `EXPLAIN FORMAT=JSON` on it, and the reply is a wall of
nested objects in a terminal. The plan is right there and unreadable, so the next move
is usually to guess: add an index, run it again, see if the wall changed.

Two things are on that screen and they do not deserve the same trust. The plan is the
server's own decision about how it will execute the statement. The statistics printed
beside it - rows, cardinality, table sizes - are estimates the optimiser works from.
Reading the first as authoritative and the second as measured is the mistake here.

## What EXPLAIN FORMAT=JSON gives you here

The MySQL provider declares `supportsExplain: true` and `explainFormat: 'mysql-json'`,
and the statement is built in one place, `src/lib/explain/mysql-json.ts`. It prefixes
your statement with `EXPLAIN FORMAT=JSON` and hands the result to the tree renderer.
That is the whole transformation; nothing is simulated. Two properties of that strategy
are worth knowing before you press the button.

**It describes without running.** `EXPLAIN FORMAT=JSON` asks the server what it would
do. Because it executes nothing, a statement that leads with a CTE is safe to explain,
and no data-modifying-CTE screen stands in front of the button here. That screen exists
only on the one engine whose explain statement executes what it explains.

**It only fires on statements it can classify.** The builder runs the statement through
the shared select-prefix check first - which accepts a bare `SELECT`, a leading CTE and
leading comments - and returns nothing when that check fails. When it returns nothing
the run is refused before anything reaches the server: that is the classifier declining,
not the server refusing.

## Reading the tree against a join

The point of drawing the JSON as a tree is that the nesting already is the tree - the
terminal just renders it as indentation you have to hold in your head. The plan panel
lays out scan type, join strategy and cost per node, so the expensive node is the one
you see first. The [feature page](/features) says which engines expose a plan this can
draw and which have nothing to render.

Take an ordinary two-table statement:

```sql
SELECT o.id, o.total, c.email
FROM orders o
JOIN customers c ON c.id = o.customer_id
WHERE o.status = 'open'
ORDER BY o.created_at DESC;
```

Read the tree outside in: the outermost node is the statement as a whole, and the
per-table access nodes sit at the bottom of it. Those table nodes are where the decision
you care about lives - which index the optimiser chose, whether it chose a full scan
instead, and how many rows it thinks it will touch getting there.

Three questions the tree answers well:

- **Which access path per table.** The node names the index it picked, or names none.
  This is a decision, not an estimate, and you can act on it directly.
- **The join order.** Which table drives the join and which is probed. The nesting is
  the order.
- **Where the sort happens.** Whether the ordering is satisfied by an index or by a
  separate sort of the joined result. The sort is either a node or it is not.

What the tree does not answer is how long any of that takes, and the numbers that look
like they answer it are the subject of the next two sections.

## The statistics beside the plan, and what they estimate

The plan panel is not the only place numbers show up. The object browser and the
monitoring tabs read `information_schema` for the same tables - `TABLES` for size and
row count, `COLUMNS` for columns, `KEY_COLUMN_USAGE` for foreign keys, `STATISTICS` for
indexes. Those numbers sit next to the plan, and one of them is routinely misread.

**The index `scans` figure on MySQL is `CARDINALITY`.** That is the optimiser's
estimate of the number of distinct values in the index, not a counter of how many
times the index was used. MySQL publishes no equivalent of a per-index usage counter,
so there is nothing else to put in that column. A high number means the index is
selective, not that it is popular; an index nothing has queried since the server
started still reports a large cardinality if its column has many distinct values.
Reaching for it to decide which index to drop reads a property of the data as if it
were a property of the workload.

Per-index size is a separate reading, taken from `mysql.innodb_index_stats` as
`stat_value * @@innodb_page_size`. That table needs `SELECT` on the `mysql` schema, and
MyISAM tables have no row in it. Where either applies the size reads `N/A` rather than
`0 B`, because zero is a measurement the server never made.

| Figure on screen | What it actually is |
| --- | --- |
| Index `scans` | `CARDINALITY` - estimated distinct values |
| Table row count | `TABLE_ROWS` - an InnoDB engine estimate |
| Table bloat | Derived from `DATA_FREE`, free space, an approximation |
| Per-index size | `innodb_index_stats`, or absent - never a fabricated zero |

## Row counts are engine estimates, not counts

`TABLE_ROWS` from `information_schema.TABLES` is an InnoDB estimate. It is sampled and
it drifts. It is the right input for an optimiser choosing between two access paths and
the wrong input for a sentence beginning "this table has".

This matters most at exactly the moment you are reading a plan, because the plan's own
row estimates come from the same statistics. When the tree says a node will touch a
number of rows and the reality is an order of magnitude different, the plan is not
lying - it is reporting faithfully from statistics that are stale. `ANALYZE TABLE` is
one of the four maintenance operations this provider offers, alongside `optimize`,
`check` and `kill`, and refreshing statistics is what makes a wrong-looking plan either
correct itself or prove it was right all along. The maintenance toolkit is admin-only,
so on a non-admin account this is a conversation with whoever holds that role.

If you want an exact number, count. `SELECT COUNT(*)` on InnoDB is a real count and the
estimate is not, and no amount of refreshing turns one into the other.

## Where the plan stops and measurement would have to begin

The statement built here is `EXPLAIN FORMAT=JSON` and only that. It describes; it does
not execute. So the tree tells you the shape of the work and never its duration, and
every figure it carries is an estimate by construction. That is not a gap in the
tooling - it is what a descriptive plan is.

To get from shape to duration, something has to actually run:

- **Run the statement and watch it.** There is no server-side query timeout on this
  provider - `queryTimeout` is not translated into one, so a runaway statement is not
  auto-killed. Cancellation is explicit: a statement issued with a query id records its
  connection thread id and cancelling issues `KILL QUERY` against it. That call reports
  success on the kill without confirming the target was still executing.
- **Read the digest table.** Real per-statement timings come from
  `performance_schema.events_statements_summary_by_digest`, which is a different
  reading from the plan entirely. Two cautions there. The slow-query list is a cap and
  not a count, having no slowness predicate, only an ordering by total wait time and a
  limit. And with `performance_schema` off, those metrics are absent, not zero.

One more boundary, because it is the one people assume their way past. Agent AUTO mode,
the tool-using run that reads results and cites them, does not run on MySQL: the
read-only execution profile it depends on is database-native and exists only for
PostgreSQL, SQLite and DuckDB, so an auto run on a MySQL connection ends
`engine-unsupported`. Agent PLAN mode does open here, grounded in the schema this
provider introspects; it executes nothing and drafts a statement for a person to run.
The [engine list](/databases) states this per engine, next to the transport.
