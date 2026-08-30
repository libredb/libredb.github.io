---
title: Trino plans are planned, never analyzed
status: published
author:
  name: LibreDB
  picture: ''
slug: trino-explain-format-json-only
description: Only the planning form is ever emitted, because the analyze form executes the statement and a plan view reaching object storage twice is a real invoice.
coverImage: ''
tags:
  - value: engineering
    label: Engineering
  - value: databases
    label: Databases
publishedAt: 2026-02-12T09:00:00.000Z
---

On a single-node database, the cost of `EXPLAIN ANALYZE` is boring: you run the
statement twice, you burn some local CPU, nobody notices. On a federating engine it is
not boring, because the statement under the plan does not stay inside the engine. Trino
owns no storage. Every scan in that plan leaves the coordinator and lands on S3, on an
Iceberg table, on a Hive warehouse, on a Postgres someone else pays for. Running it a
second time to draw a picture is a line on an invoice.

So the decision about which explain form to send is not a rendering preference. It is a
spending decision, and it was settled by measurement rather than by reading the manual.

## Two explain forms, one of which runs your statement

Trino has two explain forms and they are not two renderings of one thing.

`EXPLAIN (FORMAT JSON) <statement>` asks the planner what it would do. The answer is one
row of one column named `Query Plan`, whose cell is JSON text: a map keyed by fragment
id, each fragment a tree of nodes carrying a `descriptor`, a `details` array and an
`estimates` array.

`EXPLAIN ANALYZE <statement>` asks the cluster what it did. To answer that, it has to do
it.

The names invite you to read the second as the first with better numbers attached. That
reading is wrong on every engine and expensive on this one, so it was checked instead of
assumed.

## The measurement that settled it

The probe is the smallest thing that can distinguish planning from running: a statement
whose execution leaves a mark you can count. The `memory` connector ships in the stock
`trinodb/trino:476` image, so nothing had to be built for it.

```sql
CREATE TABLE memory.default.probe (n integer);

EXPLAIN (FORMAT JSON) INSERT INTO memory.default.probe VALUES (42);
SELECT count(*) FROM memory.default.probe;   -- 0

EXPLAIN ANALYZE INSERT INTO memory.default.probe VALUES (7);
SELECT count(*) FROM memory.default.probe;   -- 1
```

Zero rows after the planning form. One row after the analyze form. The row that appeared
is the seven.

That is the whole argument, and it holds for a `SELECT` too - a select leaves no row
behind, but it does the same reads to the same object store. So **only the JSON planning
form is ever emitted: the analyze form executes the statement, verified by a probe table
going from zero rows to one, so every Trino plan shown here is an estimate.** Row counts
in the tree are the planner's guess. Costs in the tree are the planner's guess. Nothing
in that view was observed happening.

A second measurement closed the door from the other side. `EXPLAIN ANALYZE` accepts no
`FORMAT` option at all on 476 - `EXPLAIN ANALYZE (FORMAT JSON) ...` answers `line 1:18:
mismatched input 'FORMAT'` - so its output is the box-drawing text plan. Even if the
billing argument had gone the other way, that output is not a shape a tree renderer can
read without a parser written specifically for it.

## Why the background pre-warm settles it

If the plan were only fetched when someone pressed a button, the argument above would be
about one deliberate click. It is not.

The estimate is fetched in the background on every `SELECT` a user runs, so the plan tab
is already populated when they open it rather than starting a round trip at the moment
they look. That is the right behaviour on a local Postgres and it is what makes the
analyze form unusable here: it would mean every single query in the editor silently runs
twice, once for the results grid and once for the plan the user may never open.

Two round trips to a Hive warehouse per query, on every query, for a panel nobody asked
for. The pre-warm is not the reason the analyze form is refused - the probe is - but it
is the reason the refusal is not a close call.

## Reading an estimated plan across connectors

What you get instead is real, and it is worth knowing how to read.

Node labels match Trino's own text renderer exactly. A node prints as
`Output[columnNames = [_col0]]` or `Aggregate[type = FINAL]` in the tree because that is
how the engine prints it, so a plan read here and a plan pasted from the CLI do not have
to be translated between two spellings. Descriptor entries that describe nothing - the
empty `keys` and the `hash` of `[]` an `Aggregate` also carries, the empty `arguments` on
a `LocalExchange` - are dropped, which is also what Trino's own renderer does; keeping
them pushes the one entry that identifies the node off the end of the row.

Per-node prose from `details` is kept and joined, so an aggregate shows its assignment
(`count := count(count_0)`) on the node it belongs to rather than as an invented child.

Estimates come from the first entry of the node's `estimates` array: `outputRowCount` as
estimated rows, `cpuCost` as estimated cost. Two things about those numbers are measured
rather than defensive. A cost Trino could not compute arrives as the **string** `"NaN"`,
not as null - live, the PARTIAL aggregate of a two-fragment count plan reports
`"cpuCost" : "NaN"` - so it is dropped rather than printed beside a row estimate that is
perfectly real. And a `RemoteSource` node carries an empty `estimates` array on purpose:
its estimate lives in the fragment it reads from, which is a sibling in the same map.

That fragment map is the part that rewards attention on a federated query. Each fragment
is its own tree in the same map, and a `RemoteSource` is the seam where one reads from
another. The plan cannot tell you which connector was slow. It can tell you how many rows
the planner expected one fragment to hand the next.

## What the plan cannot tell you about the storage behind it

An estimate is only as good as the statistics under it, and on Trino those statistics
belong to somebody else. Each catalog's connector supplies them, or does not.

What a connector does publish, you can read directly. `SHOW STATS FOR <table>` is honest
about its own gaps: `data_size` is an estimate, and null for every fixed-width column.
Measured on `tpch.tiny.region`, the two varchars report `34` and `330` and the `bigint`
reports `null` - not zero bytes, no answer.

That is why the size panels decline rather than round down. `databaseSize` reads `N/A`,
and `databaseSizeBytes` is absent from the overview object entirely instead of present
holding `0`, because absence and zero are different facts. Trino stores nothing, so the
storage rows name the catalogs and their connectors rather than a footprint.

The plan also cannot show you a key it was never given. Trino's `information_schema` holds
exactly eight views, with no `table_constraints` and no `key_column_usage`, so no
connector can declare a primary key, a foreign key or an index through it. That is a fact
about the engine rather than a gap in the integration: `indexes` and `foreignKeys` arrive
as empty arrays by construction, and the ER diagram for a Trino connection draws the
tables and never an edge, permanently.

The trade is stated on the [plan rendering feature](/features) as well: plans are read
from the engine's own output and nothing is simulated. On Trino, the engine's own output
that can be had without executing anything is the estimate. If you need measured timings,
type `EXPLAIN ANALYZE` in the editor yourself, having decided that a second execution is
worth what it costs. It is not a decision a background panel gets to make for you.
