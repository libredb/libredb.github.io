---
title: Reading ClickHouse plans as JSON trees
status: published
author:
  name: LibreDB
  picture: ''
slug: clickhouse-explain-json-plan-trees
description: The estimated plan is the only plan there is, because this engine never executes the statement to produce one, so nothing in the view was measured.
coverImage: ''
tags:
  - value: engineering
    label: Engineering
  - value: databases
    label: Databases
publishedAt: 2025-12-21T09:00:00.000Z
---

Press Explain on a ClickHouse SELECT and what comes back is a document, not a
listing. The statement behind the button is one fixed form -
`EXPLAIN json = 1, indexes = 1 <your select>` - built by
`src/lib/explain/clickhouse-json.ts` and sent as the body of a `POST /` on port
8123, the same stateless HTTP request every other statement here travels in.
There is no driver under it and no session pinned behind it. The answer is a tree
rather than a stage list, and the word measured never applies to any node in it.

## What the EXPLAIN statement asks for

Two options, and deliberately not a third.

`json = 1` asks for the plan as JSON. `indexes = 1` asks each MergeTree read node
to report the index structures it consulted while deciding what to read.

`actions = 1` is not requested. It would attach the expression internals of every
node, which multiplies plan size roughly tenfold - 21 KB for a two-table join,
live-measured - and the tree render model has no row shape that could show them.
A plan the viewer cannot draw is a payload, not a plan.

What arrives is one row with one `String` column named `explain`, and the value
of that column is itself a JSON string. So the plan needs a second parse:
`extractPlan()` does it, and stores the result as a structure rather than one
escaped blob, which is why the raw-JSON tab and the model-backed explainer both
receive the same object the tree is drawn from. The parsed shape is an array
containing a single `{ Plan: {...} }` object; `toPlanRoot()` unwraps up to five
layers, so the plan is accepted at whatever depth the server or the storage layer
hands it back.

```sql
EXPLAIN json = 1, indexes = 1
SELECT country, count() FROM events WHERE ts >= now() - INTERVAL 7 DAY
GROUP BY country
```

One structural mercy compared with other engines: children always live under
`Plans`, and `Plans` is always an array. There is no second child key to walk and
no single-child-versus-list special case.

## Reading the tree, node by node

The plan goes through the shared tree model, the same render path every other
plan-producing engine here uses. The part that is ClickHouse-specific is what
`indexes = 1` hangs off a `ReadFromMergeTree` node.

Each entry in that node's `Indexes` array carries `Type`, `Keys`, `Condition`,
`Search Algorithm`, and two pairs of counts: `Initial Parts` against `Selected
Parts`, and `Initial Granules` against `Selected Granules`.

Those entries are rendered as separate child rows rather than folded into one
detail string, because a single MergeTree read can report up to four of them -
Min-Max, Partition, PrimaryKey, and one per data-skipping index - and each is a
different pruning decision with a different reason to have failed. When both
counts of a pair are present, the row shows the selected-over-initial ratio,
because that ratio is the whole content of the row: an entry that selected every
part and every granule it started with pruned nothing, and it says so before you
run anything.

A `ReadFromMergeTree` node that carries no `Indexes` entries is information too.
Nothing was reported as having narrowed that read, and the tree shows that
absence rather than filling it in.

One access note: the data-skipping index catalog needs its own grant, and a denial
arrives as HTTP 500 carrying exception code 497, not as a 403.

## Why there is no analyze mode to compare against

Here is the boundary, stated plainly. There is no analyze mode on this engine:
ClickHouse's EXPLAIN never executes the statement, so the estimate is the only
plan available and no node in it was measured or timed. There is no
`EXPLAIN ANALYZE` to press instead, no actual-rows column to compare against an
estimate, and no elapsed time attached to any node in the tree.

That has a consequence inside the strategy that is worth naming, because it looks
like an oversight until you read it. `buildSql()` returns the same statement in
both modes, estimate and analyze. Declining the analyze mode - returning `null`
for it - would not narrow the feature, it would switch the feature off: the
direct Explain action always builds with mode `analyze` and refuses to run when
the strategy declines, so the button would simply go dead while only the
background pre-warm still worked. The same call is made for the same reason in
the SQLite and Couchbase strategies.

That flag is a wiring detail, not a capability. There is still no analyze mode
here: both requests ask for the same estimated plan, and neither of them runs
your statement.

## The same plan in the direct action and the pre-warm

Two paths reach a plan. The Explain action is the one you press. The pre-warm is
the one that runs in the background so the plan is already there when you open
the tab.

On some engines those two can differ, because one may execute the statement and
the other may not. On ClickHouse they cannot differ: both send
`EXPLAIN json = 1, indexes = 1`, both get the estimate, and neither runs your
SELECT. A pre-warm on a query that would scan a year of events costs the server a
planning pass and nothing else. Nothing was executed in the background, so nothing
in the tree is a timing, in either path.

The [plan viewer's published limit](/features) says the same thing from the other
side: plan rendering follows the engine, and nothing in the tree is simulated. What
the engine did not report is not drawn.

## Questions this plan answers, and questions it cannot

It answers the shape questions, which are most of the ones worth asking before a
statement runs:

- Which parts and granules would be selected, and by which index structure.
- Whether the primary key condition is usable at all against this WHERE clause.
- Whether a data-skipping index is being consulted for the predicate you wrote it
  for.
- The join and aggregation structure above the read, and where a projection or a
  filter sits relative to it.

It cannot answer anything that requires the statement to have happened: duration,
rows actually read, peak memory, whether the mark cache was warm, whether that
promising pruning ratio held under real concurrency. None of those are absent from
the render because the render dropped them. They were never in the response.

For those, the measurement lives elsewhere and is a different surface entirely:
`system.query_log`, read with `type = 'QueryFinish'` and grouped by
`normalized_query_hash`, so one row describes a statement shape with its call
count and its min, max and average duration - the way `pg_stat_statements` groups,
not one row per execution. That log records nothing while `log_queries` is off,
and the panel's empty state says exactly that rather than showing a zero. Note
also that per-index usage counts are always zero on this engine, because
ClickHouse publishes no per-index counter the HTTP interface can reach, and a
guessed number would be worse than an obvious zero.

One more boundary, since a plan tree is where someone often reaches for the
model-backed helper. Agent mode reads PostgreSQL, SQLite and DuckDB only,
because the read-only profile is database-native and exists only where a provider
implements it; on any other engine a run ends engine-unsupported. Plan mode opens
on every connection - it is toolless, runs nothing, and drafts a statement for you
to run yourself. On a [ClickHouse connection](/databases) that plan run is grounded
through the provider's own schema description.

Read the ratios, not the timings. There are no timings.
