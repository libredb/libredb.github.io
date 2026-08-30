---
title: ClickHouse diagrams show structure without relations
status: published
author:
  name: LibreDB
  picture: ''
slug: clickhouse-no-foreign-keys-diagram
description: 'An empty edge list here is the engine answer, not an unfinished read: no engine, no table setting and no DDL declares a foreign key anywhere.'
coverImage: ''
tags:
  - value: engineering
    label: Engineering
  - value: databases
    label: Databases
publishedAt: 2026-05-12T09:00:00.000Z
---

Open the ER diagram on a ClickHouse connection and you get boxes with no lines
between them. Before deciding the read went wrong, it is worth knowing that a
ClickHouse foreign key is not a thing that exists to be read. No engine, no table
setting and no DDL statement declares one. The catalog the diagram reads has no
constraint table in it, so there is nothing to look up and nothing that a
different query would have found.

## What a discovered diagram needs from an engine

The diagram in LibreDB Studio is discovered rather than drawn. `getSchema()`
returns a `foreignKeys` list per table, and each entry becomes one edge, laid out
hierarchically by ELK.js. That list is the entire input. The [ER diagram
feature](/features) publishes the consequence beside the claim: a relationship
your application enforces in code but never declares in the schema has nothing to
discover, and will not appear.

On an engine with a constraint catalog, reading that list is a lookup. Someone
wrote `REFERENCES`, the server created an object, and the object is still there
to be selected. The edge on the canvas has the same standing as the column list
next to it - it is a fact about the database, not a reading of it.

ClickHouse introspection here is three parallel reads of the system catalogs:
`system.tables` for name, `total_rows`, `total_bytes`, `sorting_key` and
`primary_key`; `system.columns` for name, type, `is_in_primary_key` and the
default kind and expression, ordered by declaration position; and
`system.data_skipping_indices` for the nearest thing this engine has to a
secondary index object. There is no fourth read, because there is no fourth
catalog. Foreign keys are always `[]`.

## A references clause that parses and enforces nothing

The confusing part is that the word is accepted. `REFERENCES` in a column
definition parses on ClickHouse, and the server enforces nothing by it.

Nothing about the clause is recorded anywhere a client can read back. `system.*`
holds no constraint catalog, so it leaves no trace after the statement returns. A
tool that trusted the DDL text it was handed would report a relationship the
server has no opinion about.

This is the difference between a syntax that is tolerated and a feature that
exists. The provider's own capability record settles it rather than leaving it to
the parser: `declaresForeignKeys` is `false` in `getCapabilities()`, beside
`supportsInlineRowEdit: false` and `supportsCreateTable: false`.

## Declared absence versus an empty read

An empty list on its own is ambiguous. It can mean the read found nothing, the
read was refused, or the concept does not exist here. Three situations, one
value, and nothing downstream can tell them apart.

The refusal case is not hypothetical on this engine. A permission denial arrives
as HTTP `500` with exception code `497 ACCESS_DENIED`, not `403`, so every error
path in this provider is classified by the numeric code rather than by status or
message text. `system.data_skipping_indices` needs its own grant and answers
`500` / `497` without it, while `system.tables` and `system.columns` answer `200`
pre-filtered to what the connected user may see. A restricted user therefore gets
a full table-and-column tree with an empty index list - a genuinely degraded
read, and one the interface has to distinguish from an impossible one.

`declaresForeignKeys: false` is the sentence the empty array cannot say. It is
set once, at the provider level, and it does not depend on the grant the current
user happens to hold.

**The limit, stated plainly: this provider declares no foreign keys and the
relation list is always empty, because this engine has no foreign-key concept
anywhere, so the diagram shows structure without discovered relations.** No
permission fixes it, no DDL adds it, and no reorganisation of your tables turns
the edges on. It is the published boundary for this engine on the [engine
matrix](/databases), written next to its transport and default port rather than
discovered at runtime.

## What the structure map is still worth

The panel is not empty, and what it does hold is specific to how this engine
stores data:

| Panel content | Source |
| --- | --- |
| Tables, row counts, on-disk size | `system.tables` - `total_rows`, `total_bytes` |
| Columns, in declaration order | `system.columns`, ordered by `position` |
| Column types, verbatim | the declared string, wrappers intact |
| Primary key | `system.tables.primary_key`, `is_in_primary_key` |
| Sorting key | a second entry, only when it differs from the primary key |
| Data-skipping indexes | `system.data_skipping_indices` |
| Foreign keys | always `[]` |

Three of those rows carry more than they look like they do.

Types are the declared strings with nothing normalised - `Nullable(String)`,
`LowCardinality(String)`, `Array(UInt8)`, `Map(String,String)`,
`Enum8('x'=1,'y'=2)`, `Decimal(10,3)`, `DateTime64(3)`. The wrapper is the part
that says nullable, low-cardinality, parameterised or enumerated, so collapsing
it onto a generic family would throw away the information. Nullability is derived
by testing for the `Nullable(...)` wrapper rather than searching for the
substring, because `LowCardinality(Nullable(String))` is a nullable column while
`Array(Nullable(String))` is not.

Row counts are the server's own bookkeeping from `system.tables`, not a
`COUNT(*)`. For a view and for every non-MergeTree engine those columns really
are null, and null is reported as unknown rather than coerced to zero - a table
shown as "0 rows" when the server never said so is a number the explorer would
have invented.

The key entries describe the read path, which is what a ClickHouse table is
organised around. The primary index is a real sparse index over the sort order,
and `ORDER BY` may extend `PRIMARY KEY` with trailing columns that shape the
on-disk order, so the sorting key is surfaced as its own entry when it adds
something the primary key entry does not already say. Note that none of these is
unique: three identical values were accepted into a table declared
`PRIMARY KEY (a)`, live-verified.

## Where the join actually lives on this engine

Not in the schema. It lives in the statement you write, and in the choice you
made when you laid the tables out.

Whether a table carries its dimensions inline, and which columns the sorting key
leads with, are layout choices rather than declared relationships. Neither is
recorded as a relationship, because neither is one - they are storage decisions,
and the structure map above shows exactly the parts of them the server tracks:
the column list, the primary key, and the sorting key when it differs from the
primary key.

When you do write a join, the relationship is stated at the moment it is used, by
the person using it, and it can be read back from the plan. `EXPLAIN json = 1,
indexes = 1` is what the Explain action builds for a `SELECT`, and the plan comes
back as a JSON tree that the interface renders node by node:

```sql
EXPLAIN json = 1, indexes = 1
SELECT o.id, c.name
FROM orders AS o
JOIN customers AS c ON o.customer_id = c.id
WHERE o.created_at >= now() - INTERVAL 7 DAY
```

Two things to keep straight about reading that plan. `Indexes` entries appear on
`ReadFromMergeTree` nodes and can report up to four kinds - Min-Max, Partition,
PrimaryKey and each data-skipping index - each with its initial and selected part
and granule counts, which is where you see whether the sorting key did any work
for the predicate. And this plan was never executed: ClickHouse's `EXPLAIN` does
not run the statement, so there is no analyze mode to ask for and the estimate is
the only plan available. Nothing on that tree was timed.
