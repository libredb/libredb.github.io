---
title: CQL has no EXPLAIN, so the tab is hidden
status: published
author:
  name: LibreDB
  picture: ''
slug: cassandra-no-explain-in-cql
description: The keyword is not in the grammar at all, and the only alternative profiles a statement that has already run, which is not a plan and is not offered as one.
coverImage: ''
tags:
  - value: engineering
    label: Engineering
  - value: databases
    label: Databases
publishedAt: 2026-07-12T09:00:00.000Z
---

Go looking for a Cassandra EXPLAIN query plan and CQL answers before the server
does any work at all. The parser stops on the first token. There is no plan node
to draw, no cost model to read, and no format flag that would produce one, so in
LibreDB Studio the Explain action and the plan tab are not rendered on a
Cassandra connection. `supportsExplain` is `false`, no `explainFormat` is
declared, and `src/lib/explain/` is never reached for this provider.

The limit, in one sentence: **the explain capability is false and both the
action and the plan tab stay hidden, because the keyword is not in the CQL
grammar and tracing profiles a statement that has already run rather than
producing a plan.**

## What the grammar answers to an explain keyword

Measured against Apache Cassandra 5.0.9, the official `cassandra:5.0.9` image:

```sql
EXPLAIN SELECT id, name FROM probe.customers;
-- line 1:0 no viable alternative at input 'EXPLAIN'
```

That is not a permission failure, an unsupported-operation error or a hint that
some flag would turn it on. `no viable alternative at input` is the CQL parser
saying the word is not a token it knows, at character zero, before a keyspace or
a table is ever resolved. It is the same answer `CREATE UNIQUE INDEX` gets for
`UNIQUE`. A join is refused a few characters later and in different words -
`SELECT ... JOIN ...` answers `mismatched input 'o' expecting EOF`, stopping on
the alias that follows the first table name - but the reading is the same. The
vocabulary is smaller, and this word is not in it.

An interface has two ways to handle that. It can show the button and let the
server produce the sentence above with a driver stack trace wrapped around it, or
it can not show the button. LibreDB Studio does the second, for the reason set
out in [the capability model behind the feature set](/features): a control that
cannot work is absent with its reason recorded. A parser error arriving from a
button the interface itself offered reads as a broken statement, or a broken
interface, long before it reads as an engine that has no such feature.

## Tracing profiles a statement that already ran

Cassandra has one introspection surface for statement execution. Setting
`{traceQuery: true}` on a statement makes the coordinator write a session row to
`system_traces.sessions` and a series of event rows to `system_traces.events`.
What lands there is the coordinator's own steps, the replicas it contacted, and a
microsecond reading for each.

That answers a real question: which nodes served the read, in what order, and
where the microseconds went. It is not exposed in LibreDB Studio.

## Why that is not a plan

A plan is a statement about a query that has not run yet. You read it to decide
whether to run the query. That is the entire value: on an engine that has an
EXPLAIN, the plan costs the planning and no execution, and it describes the
access path before you pay for it.

A trace is the opposite artifact. It exists only because the statement already
executed against the cluster, at whatever cost that carried. The full-partition
scan you were hoping to avoid has happened by the time there is anything to read.
Both artifacts describe execution, and only one of them arrives in time to change
a decision.

So the two are not interchangeable, and the honest move is to leave the trace
where it is rather than dressing it as a plan view. Wiring `system_traces` under
a tab labelled Explain would put a familiar control in a familiar place and
change what pressing it means, which is the one thing a capability declaration
exists to prevent. If tracing is ever exposed here, it will not be called EXPLAIN
and it will not sit where a plan sits.

There is a second, quieter absence in the same area. The native protocol carries
no server-side duration, so the execution time shown beside a Cassandra result is
this process's measurement of the exchange - the only number in existence, and
labelled as what it is rather than presented as engine-reported timing.

## Designing against the partition key instead

The question a plan answers still gets answered here; Cassandra moves it earlier.
In a planner-driven engine you write the query, then ask what access path it
chose. In CQL the access path is decided by the primary key you
wrote in the DDL, and the server refuses statements it would have to scan for
rather than quietly scanning:

```sql
SELECT * FROM probe.orders WHERE amount > 5;
-- Cannot execute this query as it might involve data filtering
-- and thus may have unpredictable performance ... use ALLOW FILTERING

SELECT * FROM probe.orders ORDER BY name;
-- ORDER BY is only supported when the partition key is restricted by an EQ or an IN.
```

Read those two sentences as what they are. They are the planner's warning,
delivered before the read runs instead of after it, and they arrive whether or
not anyone thought to press a button. An engine that refuses the bad access path
does not need to explain the good one.

The thing a plan would have told you is instead legible in the DDL, and one pair
of brackets carries it:

| Table | Primary key | `WHERE tenant = 'a'` |
| --- | --- | --- |
| `probe.pk_flat` | `PRIMARY KEY (tenant, day, ts)` | served |
| `probe.composite_pk` | `PRIMARY KEY ((tenant, day), ts)` | refused, code 2200, data filtering |

Same three columns, same order, same names. In the first the partition key is
`tenant` alone, so restricting it names one partition. In the second the
partition key is the pair, so `tenant` on its own names no partition and the read
would have to cross the ring. That is the whole plan, and it was written when the
table was created.

This is also why the migration generator declines to emit a Cassandra
`CREATE TABLE` from a schema diff: the internal column model keeps one boolean
for "is primary", which cannot tell those two tables apart, and a generated
statement that picked the flat layout would silently repartition the data. A
comment naming the reason is emitted in its place.

## What the editor does show you

The plan tab is not the only absence on a Cassandra connection: inline row
editing, a second page of results and query cancellation are all off as well,
each with its own recorded reason. What the query surface does carry:

- **Column roles in the tree.** `system_schema.columns` carries `kind` and
  `position`, so columns are ordered partition key, then clustering columns, then
  everything else alphabetically - the order `DESCRIBE TABLE` prints and the
  order a `WHERE` clause has to be written in. Declaration order is not
  recoverable; `position` is `-1` for every regular and static column.
- **Running statements.** `system_views.queries` publishes thread id, task text
  and two microsecond readings, so the sessions panel lists what the node is
  executing right now. It carries no user, no keyspace and no client address, so
  those read `unknown` rather than borrowing the connected role.
- **A row bound that respects the dialect.** `ALLOW FILTERING` has to stay last,
  so the injected `LIMIT` is transposed ahead of it rather than appended after.
  `OFFSET` is not in the grammar, so a request for a page after the first is
  refused with that reason instead of returning page one again.
- **Agent Plan mode.** It is toolless, executes nothing, and drafts a statement
  for a human to run. Agent AUTO mode ends `engine-unsupported` here: its
  read-only profile is database-native and exists on PostgreSQL, SQLite and
  DuckDB only.

What is not present, and says so where the number would be: no row count and no
table size anywhere, because `system.size_estimates` counts partitions per token
range from flushed SSTables only, and `system_views.disk_usage` reports whole
mebibytes. No slow-query list either - the threshold writes to the node's log
file rather than to a table, so there is nothing a session can read.

Each of those absences is published on the [engine reference](/databases)
alongside the transport and port, which is where a limit belongs: before the
evaluation, not twenty minutes into it.
