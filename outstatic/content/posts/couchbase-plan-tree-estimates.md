---
title: Couchbase plan trees are estimates, and minus one means none
status: published
author:
  name: LibreDB
  picture: ''
slug: couchbase-plan-tree-estimates
description: This dialect has no analyze form, so the direct action and the background pre-warm show the same estimate, and a negative cost renders as no estimate.
coverImage: ''
tags:
  - value: engineering
    label: Engineering
  - value: databases
    label: Databases
publishedAt: 2026-05-23T09:00:00.000Z
---

A Couchbase EXPLAIN query plan - N1QL is the old name for the language now called
SQL++ - is a JSON document, not a table. It has a root operator, operators nested
under it, and numbers attached to some of them. Two of those details will mislead
a reader who assumes the plan behaves like the plans they already know: the tree
is not uniformly shaped, and one of the numbers is a sentinel.

A plan reader that treats that sentinel as a metric does not fail. It draws a
tidy panel with a confident number in it, and the number is nonsense.

## What the plan statement returns here

`supportsExplain` is `true` on this provider and `explainFormat` is
`couchbase-json`. The strategy builds one statement, `EXPLAIN <your SELECT>`, and
posts it to `/query/service`, the same Query Service endpoint every other
statement goes to. It produces the plan without executing the query. A statement
that is not a `SELECT` is declined rather than sent.

What comes back is the operator tree. This is a fragment of a real one, taken
from Couchbase Server 8.0.2 Community Edition, and it is worth reading closely
because it answers a question people ask before they ask about cost:

```json
{ "#operator": "PrimaryScan3", "index": "#sequentialscan", "using": "sequentialscan" }
```

That is a collection with no index at all being read by a sequential scan, which
is what Server 7.6 and later fall back to. The plan says so in the operator
itself. On Server 7.0 to 7.2 the same statement does not produce a plan with a
fallback in it; it fails with error 4000, and the provider re-raises that error
carrying the runnable `CREATE PRIMARY INDEX` remedy quoted for the exact keyspace.
So before any estimate is read, the plan has already told you which of the two
worlds you are in.

## Walking a tree with two different child shapes

Couchbase plans nest children under two different keys, and both are real.

`Sequence` and its relatives carry `~children`, an array. `Parallel` carries
`~child`, a single operator object. There is no wrapper array around it, no
one-element list to iterate. A walker written against the array form alone reads
the `Parallel` node, finds no `~children`, and treats it as a leaf.

```json
{
  "#operator": "Sequence",
  "~children": [
    { "#operator": "PrimaryScan3", "index": "#sequentialscan" },
    { "#operator": "Parallel", "~child": { "#operator": "Sequence", "~children": [] } }
  ]
}
```

The failure mode is the thing to notice. Nothing throws. The panel renders, the
tree looks complete, and everything below the first `Parallel` is gone. A user
comparing two plans would be comparing two truncations.

`couchbase-json.ts` therefore collects every tilde-prefixed key and accepts
either shape - an array of operators or a single operator - before walking into
it. The rendered result is the same `{ kind: "tree" }` model every other engine's
plan renders into, which is why the Explain panel looks the same here as it does
elsewhere in [the interface](/features) while the parsing underneath is
engine-specific.

## Why there is no analyze form to compare with

**SQL++ has no analyze mode.** There is no `EXPLAIN ANALYZE` in this dialect, so
the estimate is not one of two views you can flip between - it is the only view.
The direct Explain action and the background pre-warm that fires when a SELECT
runs build the same statement and show the same estimated plan. Real timings
exist, but they come from a request-level `profile: "timings"` parameter, and the
explain strategy emits SQL text only; setting a request parameter is outside what
it can do by design. Nothing in the Explain panel on this engine has ever measured
anything.

The strategy could have declined the analyze mode instead, and that was
considered and rejected for a concrete reason: the direct Explain action always
builds with mode `analyze`, and refuses the run when the strategy declines. A
`null` there would not have narrowed the feature to one honest mode. It would
have left the button dead while the background pre-warm quietly kept working.
Returning the estimate in both modes is the version where the reader can see what
is available.

## The sentinel that is not a cost

Couchbase Server 8.0.2 advertises `clusterCapabilities.n1ql` including
`costBasedOptimizer`, and it does so on Community Edition, so cost and
cardinality can appear on plans from a Community cluster. They are read in two
places: flat on the operator, or nested under `optimizer_estimates`.

When the optimizer has no estimate to give, it does not omit the field. It writes
`-1`.

```json
{ "#operator": "PrimaryScan3", "optimizer_estimates": { "cost": -1, "cardinality": -1 } }
```

That is the whole trap. A cost of -1 is not a very cheap operator. A cardinality
of -1 is not a row count. Both mean the optimizer had no estimate to give.
Sort a plan's operators by cost, cheapest first, with the sentinel left in place,
and the operators the optimizer knows least about sit at the top of the list -
the exact inverse of what that list claims to show.

So `-1` is treated as absent. The panel shows no cost, not a cost of minus one,
and not a substituted zero either - a measured zero and an unmeasured value are
different facts, and the monitoring panels here keep them different for the same
reason: a denied metric is omitted, while a measured `0` is kept.

Couchbase's own statistics statement is `UPDATE STATISTICS FOR <keyspace> INDEX
ALL`, which the maintenance toolkit runs per collection, for an administrator
only. It is Enterprise Edition only: on Community Edition the cluster answers
"'Update Statistics' is an enterprise level feature." and that refusal is
returned verbatim as a failed result rather than reworded. So a Community reader
who wants to try running it has no supported way to do so from here.

## Reading an estimate for what it is

An estimated plan still answers the questions worth asking of a plan. Which index
was chosen, or whether the fallback scan was chosen instead. Whether a predicate
reached the index scan or is being applied after a full read. What the shape of
the query is once the optimizer has rewritten it. None of those need a timing.

What the plan cannot tell you is how long anything took. For that, the query
service keeps `system:completed_requests`, which holds only the requests that ran
past the query service's own threshold, with their elapsed time - one row per
request, so those are individual requests and not aggregates. That catalog needs
the Query System Catalog RBAC role, and without it the monitoring panels here are
empty rather than zeroed.

Couchbase states the missing case explicitly, with `-1`, rather than leaving the
field out. The work on this side was to keep that statement intact instead of
rendering it as a number. What each engine does and does not do here is published
per engine on [the databases page](/databases), beside its transport and its
default port.
