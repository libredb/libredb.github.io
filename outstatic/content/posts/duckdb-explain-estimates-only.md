---
title: DuckDB plans are estimates here, permanently
status: published
author:
  name: LibreDB
  picture: ''
slug: duckdb-explain-estimates-only
description: The timing form of EXPLAIN executes the statement it was asked to explain, so it is never emitted and no measured node timings are published.
coverImage: ''
tags:
  - value: engineering
    label: Engineering
  - value: databases
    label: Databases
publishedAt: 2026-03-23T09:00:00.000Z
---

Press Explain on a DuckDB query in Studio and you get a tree of operators, a join
order, a filter list and a cardinality guess. You do not get a millisecond
anywhere, and you will not get one in a later release.

`EXPLAIN (ANALYZE, FORMAT JSON) INSERT INTO probe VALUES (42)` was issued three
times against a fresh table. The table went from 0 rows to 1 to 2 to 3. Every
call really performed the insert, and an `UPDATE` behind it really changed the
row. Plain `EXPLAIN (FORMAT JSON)` on the same statement returned an INSERT plan
and left the count where it was.

## What the JSON plan gives you

The provider declares `explainFormat: "duckdb-json"` and sends one statement:
`EXPLAIN (FORMAT JSON) <query>`. DuckDB answers a single row with two columns.
`explain_key` is `physical_plan`; `explain_value` is a JSON *string*, which the
provider parses into an array of nodes. A node has exactly three keys - `name`,
`children`, `extra_info` - and the array always has one root. Measured over six
statements, the deepest plan ran nine levels.

`extra_info` is where the content is, and it is not uniformly shaped. On

```sql
EXPLAIN (FORMAT JSON)
SELECT c.name, o.total
FROM customers c JOIN orders o ON o.customer_id = c.id
WHERE o.total > 10
ORDER BY o.total
LIMIT 3;
```

one `SEQ_SCAN` node answered:

```json
{"Table":"warehouse.main.customers","Type":"Sequential Scan",
 "Projections":["id","name"],"Estimated Cardinality":"5"}
```

`Table` is a string and `Projections` is an array of strings, inside the same
object. A reader that assumes strings silently drops the projection list, so the
rendering strategy joins an array's members rather than printing `[object
Object]`. The keys seen across the probed statements are `Table`, `Type`, `Table
Index`, `Projections`, `Filters`, `Expression`, `Conditions`, `Join Type`,
`Groups`, `Aggregates`, `Order By`, `Top`, `CTE Name`, `CTE Index` and `Estimated
Cardinality`.

Two boundaries around that. `EXPLAIN (FORMAT JSON)` on a statement DuckDB cannot
resolve throws rather than answering a payload - `Catalog Error: Table with name
nope_missing does not exist!` - so a typo produces an error, not an empty plan.
And a multi-statement string runs only its first statement: `runAndReadAll("SELECT
1 AS a; SELECT 2 AS b")` answers `[{"a":1}]`, with no error and no second result.
Explaining a pasted script explains the top of it.

## The measurement, and what it is not

The analyze plan variant is never emitted: it executes the statement it was asked
to explain, so DuckDB plans here carry structure with no timings, and that absence
is permanent rather than pending.

That is the whole rule, and the insert count above is the whole evidence. It is
worth being precise about what is *not* the reason. Those three executing calls
each answered a `{"result": "error"}` payload, and it would be easy to file this
as a broken output format. It is not. On other runs the same form answers
`explain_key = "analyzed_plan"` with a real profile object carrying `latency`,
`cpu_time`, `operator_timing`, `operator_cardinality`, `rows_returned` and a
nested `children` - an object, not the array that `physical_plan` publishes. The
payload is intermittent. The execution is not.

So the Explain action turns the analyze form off for DuckDB rather than
sending it and post-processing whatever comes back. There is no timing data to
show, and none is fabricated. A control that cannot work is absent with its
reason written where it would have been, which is the same rule the rest of
[the capability model](/features) runs on.

## Why a later release makes this worse, not better

The obvious hope is that this is a version to wait out - that DuckDB will
eventually emit clean analyze JSON and the timings will appear. Read the failure
again and the hope inverts.

Today the analyze form is unusable in two ways at once: it runs your statement,
and it sometimes hands back a payload nobody can render. The second failure is
loud. It is what keeps a plausible-looking implementation from shipping and
quietly executing a `DELETE` the user asked only to see.

A release that fixes only the payload removes the loud half and keeps the
dangerous one. The plan viewer would then look correct - a timed tree, operator
by operator - while every press of Explain still ran what the user asked only to
see. The trap gets harder to notice exactly as the output gets prettier. That is
why this limitation is recorded as ours and permanent rather than as the engine's
and pending: it is a decision about what the button is allowed to do, not a bug
report waiting on an upstream fix.

The safe use of the analyze form is the one where the execution is not a surprise:
you already intend to run the statement, you run it yourself, and you read the
profile as a side effect of a run you chose. That is a different action from
"explain this", and it stays outside the Explain button.

## Reading structure when there are no numbers

A plan without timings is still worth opening, as long as you read it for the
questions it can answer.

- **Join order and join type.** `Conditions` and `Join Type` tell you what DuckDB
  decided to do with your predicate, which is usually the finding.
- **What got pushed down.** `Filters` on a scan node is the predicate arriving at
  the scan rather than above it, and `Projections` names the columns that scan
  reads.
- **Where the shape is wrong.** A `SEQ_SCAN` under a node you expected to be fed
  by an index is visible without a clock.

`Estimated Cardinality` is the one number in the tree, and it needs reading twice.
It is an estimate, not a measurement, and a node need not carry it at all - in the
plan above, the root `TOP_N` carried only `{"Top":"3","Order By":"o.total ASC"}`.
An absent cardinality is absent, not zero, and it is rendered that way.

Treat the estimate as the optimizer's belief rather than as a row count. DuckDB
publishes a second, unrelated estimate that shows why: after a delete on a
20,000,000-row table, `duckdb_tables().estimated_size` answered 1,076,480 where
`count(*)` answered 1,000,000, and a `CHECKPOINT` left it there. That is the
catalog's estimate rather than the plan's, but it is the same lesson, and it is
why the object tree counts with `count(*)` instead.

## Where to get real timings instead

The timings you can have on DuckDB are wall-clock timings of runs you chose.

Each executed statement returns its own `executionTime` alongside `rows`,
`fields` and `rowCount`, so the editor times what you actually ran. That is a
whole-statement figure, not a per-operator one - it will tell you a query got
slower, never which node did it.

Nothing retrospective exists to fall back on. `SELECT * FROM duckdb_queries()`
answers `Catalog Error: Table Function with name duckdb_queries does not exist!`,
and `duckdb_connections()` answers the same way, so there is no slow-query log and
no session list to consult afterwards. Both panels stay empty permanently and
print DuckDB's own reason rather than reporting a zero.

What monitoring does publish is resource evidence, which is often the thing you
wanted the timings for. `pragma_database_size()` reports database, WAL and memory
figures - as human-formatted strings such as `"2.0 MiB"`, parsed to bytes for the
gauge - `duckdb_memory()` breaks usage down in real bytes, and
`duckdb_temporary_files()` answers with a real reading rather than a gap - it
answered `[]` on an idle database, which is a reading and not a blank.

And a query that is taking too long can be stopped:
`DuckDBConnection.prototype.interrupt()` exists in `@duckdb/node-api` 1.5.5-r.4
and is what cancellation calls. Measured, it halts a running scan with `INTERRUPT
Error: Interrupted!` and leaves the connection usable for the next statement -
which matters more than usual on an engine with no session to `KILL` from a second
connection.

The full set of what DuckDB answers and what it declines is on
[its engine page](/databases).
