---
title: Foreign-key diagrams on a schema with a hundred tables
status: published
author:
  name: LibreDB
  picture: ''
slug: postgresql-er-diagram-two-phase-introspection
description: 'The schema tree renders before relationships arrive, and every introspection CTE is materialized on purpose: a 122-table read measured about 295 seconds before the change and about 2.6 seconds after.'
coverImage: ''
tags:
  - value: engineering
    label: Engineering
  - value: databases
    label: Databases
publishedAt: 2026-06-09T09:00:00.000Z
---

On a small schema, the query that generates an ER diagram from a Postgres
database is boring. You join `information_schema.tables`, `columns`,
`table_constraints`, `key_column_usage` and `constraint_column_usage`, add
`pg_class` for row counts and sizes, and it returns without anyone noticing the
cost. The same query, unchanged, against a schema with 122 tables took just
under five minutes. Nothing was broken. The plan was simply allowed to be as bad
as it wanted.

Two changes fixed it, and both of them cost accuracy somewhere. That trade is the
actual subject here.

## Why generating an ER diagram from a Postgres database stalls in one round trip

The introspection query is a stack of CTEs: one per catalog surface, joined at
the end into tables, columns, primary keys, foreign keys and indexes. Written
that way it reads like five independent scans followed by a join.

PostgreSQL 12 and later does not read it that way. A CTE referenced exactly once
is inlined into the enclosing query by default, which is usually the right call -
it lets the planner push predicates down instead of building a fence around a
subquery. Here it is the wrong call twice over. Once inlined, the planner
estimates `rows=1` for each of these `information_schema` scans. An estimate of
one row makes a nested loop look free, so it chooses nested loops, and each
iteration re-executes the whole `information_schema` scan underneath.

That is the failure mode. It is not a slow query in the ordinary sense - it is a
correct query being re-run once per row of an outer relation the planner guessed
at one row and that is nothing like one row. On a small schema the multiplier is
small enough that nobody notices. Past roughly a hundred tables, constraints and
indexes, the same plan spends minutes.

## What AS MATERIALIZED changed, measured

Every schema-introspection CTE in the PostgreSQL provider is declared
`AS MATERIALIZED`. That keyword turns the optimisation fence back on: each CTE
computes exactly once, into a temporary result, and the join runs against that.

```sql
WITH tables_info AS MATERIALIZED (
  SELECT
    t.table_schema,
    t.table_name,
    COALESCE(c.reltuples::bigint, 0) as row_count,
    COALESCE(pg_total_relation_size(c.oid), 0) as total_size
  FROM information_schema.tables t
  LEFT JOIN pg_class c ON c.oid = (quote_ident(t.table_schema) || '.' || quote_ident(t.table_name))::regclass
  WHERE t.table_schema NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
    AND t.table_type = 'BASE TABLE'
),
columns_info AS MATERIALIZED (
  SELECT
    c.table_schema,
    c.table_name,
    json_agg(... ORDER BY c.ordinal_position)
      FILTER (WHERE c.ordinal_position <= 100) as columns
  FROM information_schema.columns c
  WHERE c.table_schema NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
  GROUP BY c.table_schema, c.table_name
)
SELECT ...
```

On the 122-table schema that motivated the change, the measured result was about
295 seconds down to about 2.6 seconds. That number is from the provider document
in the product repository, taken on one schema on one machine; it is a ratio
worth understanding, not a benchmark to quote back at anyone. What is portable is
the shape of it: the cost was quadratic in the wrong variable, and the keyword
removed the multiplier rather than making anything faster.

There is a maintenance hazard in that, so it is written down where the SQL is: if
you edit these queries and drop `MATERIALIZED`, you reintroduce the timeout, and
you reintroduce it silently, because the query is still correct.

## Rendering the tree before the edges arrive

2.6 seconds is fast enough for a diagram and too slow for a sidebar. Nobody
minds waiting for a graph; everybody minds a schema tree that is blank while
something thinks about foreign keys.

So the read is split in two, and the split is not by table but by kind of fact.

| Call | Returns | Deliberately omits |
| --- | --- | --- |
| `getSchemaList()` | Tables, columns, primary keys, row counts, sizes | Foreign keys and indexes, returned as empty arrays |
| `getSchemaRelations()` | Foreign keys and indexes, keyed by table display name | Everything already in the list |

The tree renders from the first call. The second runs independently and its
results are merged into the tree in the client as they arrive. The expensive
joins - constraints against key usage against column usage - are entirely in the
second query, which means a schema whose relationship read is slow, or whose
relationship read fails outright, still produces a usable object browser. A
single-round-trip `getSchema()` still exists for callers that want everything at
once, but it is not the path the interface takes.

One detail that only shows up on a schema wide enough to have several of them:
the foreign-key CTE joins `constraint_column_usage` on both `constraint_name`
and `constraint_schema`. Joining on the name alone mis-resolves two constraints
that share a name in different schemas, which draws an edge to the wrong table.
That was a real bug and it has a regression test, because a diagram that is
confidently wrong is worse than one that is late.

## Reading the diagram: declared keys only

The edges are discovered, not authored. They come from the foreign keys the
database declares, laid out hierarchically by ELK.js, with cardinality labels on
the edges themselves. Tables in `public` show by bare name; tables elsewhere are
shown schema-qualified, and referenced tables follow the same rule so a
cross-schema key points somewhere legible.

The consequence is the one stated on the [ER diagram feature
page](/features): a relationship your application enforces in code and never
declares in the schema has nothing to discover. If `orders.customer_id` is an
`integer` with no constraint on it, the schema has not said that it references
anything, and the graph is built from what the schema says.

## The price of the fast path

Three things on that screen are less than they look, and it is better to know
which:

**Row counts are planner estimates.** They come from `pg_class.reltuples`, not
from `COUNT(*)`. `reltuples` is whatever the last `ANALYZE` or autovacuum left
behind, so on a table that has just been bulk-loaded it will be stale, and on a
table that has never been analyzed it is `-1`, which is clamped to zero for
display. A count that says 0 on a table you know has rows means "not analyzed",
not "empty". Counting exactly would mean scanning every table, which on a
122-table schema is the five-minute problem again in a different costume.

**Column lists stop at the first 100 columns per table.** The columns CTE
aggregates under `FILTER (WHERE c.ordinal_position <= 100)`, so a table wider
than that is introspected down to its first hundred columns and no further.

**Only declared foreign keys are drawn.** Stated above, repeated here because it
belongs in the same list as the other two: the graph is a picture of the
database's declarations, not of your data model.

Those three are the same decision seen three times. The tree is fast because it
reads the catalog's own summaries instead of the tables, and the catalog's
summaries are estimates. You can have exact counts or a schema browser that
opens; on a wide schema you cannot have both, and we would rather label the
estimate than hide the wait.
