---
title: A Druid plan tree with no cost anywhere on it
status: published
author:
  name: LibreDB
  picture: ''
slug: druid-plan-tree-without-costs
description: The plan returns the native query the cluster will run, rendered in its own operator vocabulary, and the planner publishes no cost and no row estimate.
coverImage: ''
tags:
  - value: engineering
    label: Engineering
  - value: databases
    label: Databases
publishedAt: 2026-02-09T09:00:00.000Z
---

Ask for a Druid explain plan for a query and you get back something that does not
look like a plan at all. One row, three columns, and every one of those columns is
a JSON string that has to be parsed a second time before it means anything. Inside
the first of them is the thing worth reading: the native Druid query the cluster
will actually run. What is not inside it is a single number.

The Druid plan tree carries no metrics. Druid's planner emits no cost and no row
estimate anywhere in that payload, verified across scan, groupBy and join plans,
and the plan statement never executes the query. There is structure, and there
is nothing else.

## What the plan statement returns

`EXPLAIN PLAN FOR <select>` goes down the same path every other Druid statement in
LibreDB Studio goes down: a JSON body posted to `/druid/v2/sql`, port 8888 on the
Router or 8082 on the Broker, with no driver in between. The answer is one row of
three columns - `PLAN`, `RESOURCES` and `ATTRIBUTES` - each of them a JSON string.
The envelope parse leaves three escaped blobs behind, and each needs its own parse
to become a structure.

`PLAN` is an array of `{ query, signature, columnMappings }` entries, and `query`
is the native query. The array is not always length one. Two aggregating branches
of a `UNION ALL` come back as two independent native queries, live-verified, so
the render has to show both without inventing a parent that Druid did not
describe. It gets a synthetic root labelled `2 native queries`; a single query is
its own root.

## Recursing into the native query as an operator tree

The tree here is not a flat list arranged to look like one. The recursion through
`dataSource` *is* the operator tree, and the shapes are Druid's own:

- a `query` dataSource wraps another native query,
- a `join` has a `left` and a `right`,
- a `union` has `dataSources[]`,
- `table`, `lookup`, `inline` and `external` are leaves.

Live, the join case:

```json
{ "type": "join",
  "left":  { "type": "table", "name": "libredb_demo" },
  "right": { "type": "query", "query": { "queryType": "groupBy",
             "dataSource": { "type": "table", "name": "libredb_rollup" } } },
  "rightPrefix": "j0.",
  "condition": "(\"region\" == \"j0.d0\")",
  "joinType": "INNER" }
```

Two rules keep that walk honest when the payload does not match expectations.
Recursion is bounded at 32 levels and a truncation is labelled rather than quietly
cut off. And a `dataSource` type the renderer does not recognise becomes a leaf
named by that type instead of being dropped. Druid adds dataSource types between
releases, and a dropped node would make the tree lie about what runs.

There was a second plan format available and it was not chosen. Setting
`useNativeQueryExplain: false` returns an indented Calcite `RelNode` text plan,
`DruidJoinQueryRel` over two `DruidQueryRel`s. It depends on a non-default context
flag, and it is indentation-parsed text where the default is structured JSON.

## Reading the vocabulary the cluster uses

Node labels name the native query type and the datasource: `groupBy`, `scan`,
`timeseries`, `topN`. That is a deliberate refusal to translate. A reader who
has spent time in Druid's own console already knows what a `topN` is.
Relabelling it as an aggregate node over a sequential scan would produce a tree
that reads like every other engine's tree and describes none of Druid's
behaviour.

It is the same reasoning that makes the sidebar call a table a Datasource on this
engine. The word the cluster uses is the word the interface uses, because the next
place the user goes is a Druid document.

## Filters and aggregations as rows, not metrics

A tree node in this render model can carry metrics, and metrics are drawn as
measured facts. So on Druid nothing is put there. What a reader actually needs
from a Druid plan - the filter, the dimensions, the aggregations, the granularity
- is surfaced as child rows instead:

```text
groupBy
|-- table libredb_demo
|-- granularity: all
|-- filter: range on qty
|-- dimensions: region AS d0
`-- aggregations: count AS a0
```

Those are labels, not measurements, and they are placed where labels go. The
alternative was available and was rejected: the field is optional, an empty
metrics slot is legal, and filling it with a plausible number would have been the
worst option on the list. A fabricated cost renders identically to a measured one.

The general description of the [plan tree feature](/features) stops describing
Druid at this point. That copy mentions costs laid out so the expensive node is
the one you see first, and it is accurate on the engines that publish a cost.
Druid publishes none, so on this engine the tree answers "what will run" and
never "what will it cost". Reading it as a cost view is the mistake to avoid.

## Why there is no analyze mode to compare against

On engines that have one, an analyze run is what settles an argument with the
planner: estimate on one side, measured rows and measured time on the other.
Druid's `EXPLAIN` never executes the statement, so that second side does not
exist. The plan strategy therefore builds `EXPLAIN PLAN FOR` for a `SELECT` in
both modes, and returns nothing for any other statement form.

Building the same statement in both modes is not a rounding-off. The direct
Explain action always asks for `analyze` and refuses to run when the strategy
declines, so returning nothing there would not narrow the feature, it would turn
the button off and leave only the background pre-warm working. The honest shape is
one plan, shown identically whichever path asked for it.

Nothing elsewhere on the connection fills the gap either, and that is worth
knowing before you go looking. Druid keeps no query log - no system table, no
endpoint, no file - so there are no slow queries to compare a plan against. Its
metrics reach an emitter rather than a SQL-readable table, so the performance
panel sends no statement at all. The one number available anywhere in this path is
the execution time of a real run, measured by the transport around its own HTTP
exchange, because the endpoint reports no timing of its own.

What the plan tree gives you is the shape of the work: which datasource, which
native query type, what was pushed into the filter, what the join looks like from
the cluster's side. That is enough to catch a scan that should have been a
`groupBy`, or a join whose right side is a whole datasource. It is not enough to
rank two plans by cost, and no amount of rendering will make it so.
