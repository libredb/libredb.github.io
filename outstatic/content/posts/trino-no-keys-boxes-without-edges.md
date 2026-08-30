---
title: Why a Trino diagram draws boxes and never edges
status: published
author:
  name: LibreDB
  picture: ''
slug: trino-no-keys-boxes-without-edges
description: The catalog views a connector could declare a key through do not exist here, so the empty edge set is the engine answer rather than an empty schema.
coverImage: ''
tags:
  - value: engineering
    label: Engineering
  - value: databases
    label: Databases
publishedAt: 2026-05-17T09:00:00.000Z
---

Go looking for a Trino primary key or foreign key in `information_schema` and the
search ends faster than you expect. The views that would hold one are not empty.
They are not there. Measured against Apache Trino 476, the catalog publishes
exactly eight views, and neither `table_constraints` nor `key_column_usage` is
among them.

That single fact decides two things a user sees in LibreDB Studio: an ER
diagram that never draws an edge, and a row editor that is not rendered at all.
The two look unrelated until you know where they come from.

## What the catalog here actually publishes

Every Trino catalog carries its own `information_schema`. Listing one on 476
gives eight views and nothing else:

```
applicable_roles  columns  enabled_roles  roles  schemata  table_privileges  tables  views
```

Schema introspection uses two of them. The provider runs `tables` and `columns`
in parallel against the catalog the connection pinned, both excluding
`information_schema` itself, both ordered by `ordinal_position` so the mapper
never sorts. Against `tpch` that read returns 72 tables with their declared
columns and types rendered verbatim - `varchar(25)`, `array(integer)`,
`row(x integer, y varchar)`.

One correction before going further, because the field name misleads: the
Database field on a Trino connection holds a **catalog**, not a database. Trino's hierarchy is catalog to schema to table, one
level deeper than the tree, so the connection pins the catalog and the tree shows
the schemas inside it. A table is always displayed `schema.table`. A connection
that pins no catalog still connects and still runs every fully qualified
statement; it just has no tree to draw.

## Why no connector can declare a key through it

There is no view in that list a constraint could arrive in. `table_constraints`
is where a primary key would be named and `key_column_usage` is where its columns
would be. Trino publishes neither, in any catalog, on any connector.

So this is not a read that came back empty. It is a read that has no place to
happen. A PostgreSQL table reached through the PostgreSQL connector still has its
primary key and its indexes on the PostgreSQL server; Trino will not name one of
them, because the interface it would name them through does not exist. Whether
the system behind a connector has keys is that system's business and unreadable
from here.

Trino is a query engine, not a database. It stores nothing. Every table it can
name belongs to something behind a connector, and much of what a database tool
normally reports - bytes on disk, indexes, keys, transactions, a vacuum button -
belongs to a system Trino only reads. The missing constraint views are one
instance of that, not an oversight in the catalog's design.

What it produces in the provider is deliberate and consistent. `ColumnSchema.isPrimary`
is `false`. `TableSchema.indexes` and `.foreignKeys` are `[]` by construction
rather than by omission. `declaresForeignKeys` is `false`. `getIndexStats()`
returns `[]` and sends no statement at all, because the answer cannot vary with
the connection, so there is nothing to ask.

## Boxes with no edges, permanently

The ER diagram on this site is described plainly on the
[feature page](/features): edges come from declared foreign keys, and a
relationship your application enforces in code but never declares in the schema
has nothing to discover. Trino is that rule at its limit. Every foreign key it
could declare is a foreign key it declares nowhere.

So the diagram opens, lays out the tables it read from `information_schema.tables`,
and draws no edges. Not once, not until statistics warm up, not on a better
catalog. No column is reported as primary and the relation list is always empty,
because the catalog carries no constraint views at all, which is also why inline
row editing is withheld rather than offered.

The distinction that matters is between an empty answer and an unanswerable
question. A schema with no foreign keys declared yet might grow some tomorrow;
the diagram would then draw them. A Trino catalog will not, because `declaresForeignKeys`
is false at the provider level and the engine has no mechanism through which that
could change. The empty edge set is the engine's answer.

That is also why the diagram is not switched off. Switching it off would say the
feature is unavailable, which is untrue - the tables are real, the layout is
real, and each box carries the declared columns and types read from
`information_schema.columns`. What is absent is the edge set, and it is absent for a
reason a reader can check in one query.

## The same fact behind a withheld edit control

The inline row editor builds an `UPDATE ... WHERE <pk> = <val>`. That statement is
only safe because the `WHERE` clause identifies exactly one row, and it identifies
exactly one row only because a primary key says so. Take the key away and the
statement still parses. It still runs, on a connector that accepts writes. It
rewrites every row that matches, silently, and nothing in the answer distinguishes
one row updated from all of them.

So `supportsInlineRowEdit` is `false` on Trino and the control is not rendered.
Not greyed out with a tooltip; absent. This site's rule is that a control which
cannot work is hidden rather than offered and then failed, and the reason is
written where the control would have been.

Writes themselves are not the issue and are not blanket-refused. `CREATE TABLE`
is in the grammar and was live-verified on the `memory` connector, so
`supportsCreateTable` is `true`. The same connector answers `UPDATE` with
`This connector does not support modifying table rows`, and that refusal is shown
verbatim rather than substituted, because the connector's own message names the
boundary better than anything the provider could write for it. Writes belong to
the connector. The missing edit control does not - it belongs to the missing key.

## Where the relationship lives instead

The relationships in a federated setup are real. They are just not in Trino.

They live in the systems behind the catalogs, where the constraint was declared,
and they live in the SQL you write. A join across two catalogs runs exactly as
typed when the names are fully qualified - the pinned catalog only supplies the
default for names that are not. The join condition is the relationship, stated by
you, for that statement.

If a diagram with edges is the thing you need, connect to the system that
declares them. The [engine list](/databases) publishes what each one answers next
to its transport and default port, so a PostgreSQL catalog you reach through
Trino for federation is the same server you can connect to directly for its keys.
Two connections, two honest answers, neither one inventing the other's.

A note on the rest of the Trino surface, so the shape is clear. `EXPLAIN` is real
and renders as a plan tree, from `EXPLAIN (FORMAT JSON)` only: live-verified on
476, that form planned an `INSERT` into a probe table and left it at 0 rows, while
`EXPLAIN ANALYZE` inserting into the same table took the count from 0 to 1,
because that form executes. A plan view must not run the user's query. Monitoring
reads the coordinator through `system.runtime`, `system.metadata` and `jmx`. The
index statistics panel reports zero indexes, and on this engine that is a
measurement rather than a refusal. Agent PLAN mode opens on a Trino connection,
executes nothing, and is grounded by asking the provider to describe its own
schema; agent AUTO mode does not run here at all, and a run started in it ends
engine-unsupported.
