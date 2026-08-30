---
title: Oracle diagrams are scoped to the connecting user
status: published
author:
  name: LibreDB
  picture: ''
slug: oracle-er-diagram-owner-scoped
description: Five bulk dictionary reads build the tree regardless of table count, and every one of them is filtered by owner, so other schemas are simply not drawn.
coverImage: ''
tags:
  - value: engineering
    label: Engineering
  - value: databases
    label: Databases
publishedAt: 2025-12-07T09:00:00.000Z
---

A table you can query is missing from the picture. You select from
`REPORTING.INVOICE` in the editor, it answers, you open the diagram, and the box
is not there. Nothing failed and no error was raised, so the natural conclusion
is that the diagram is broken.

It is not. The Oracle diagram is built from five reads of the data dictionary,
and every one of those five carries `OWNER = :1`, bound to the user the
connection authenticated as. `REPORTING.INVOICE` is visible to your session and
owned by somebody else, so it was never in the result set the tree and the
diagram are drawn from.

## Five reads, whatever the table count

`getSchema()` on the Oracle provider issues five bulk queries against the `ALL_*`
data-dictionary views and groups the rows in memory, by table:

| What is read | View |
| --- | --- |
| Tables and the row estimate | `ALL_TABLES` (`NUM_ROWS`) |
| Columns | `ALL_TAB_COLUMNS` |
| Primary keys | `ALL_CONSTRAINTS` + `ALL_CONS_COLUMNS`, `CONSTRAINT_TYPE = 'P'` |
| Foreign keys | `ALL_CONSTRAINTS` type `'R'`, joined to the referenced constraint |
| Indexes | `ALL_INDEXES` + `ALL_IND_COLUMNS` |

Five round trips for four tables. Five round trips for four hundred. The count
is a property of the code, not of the schema, because the grouping happens in
the process rather than in a query per table.

The two other shapes in this codebase put the cost somewhere else. A per-table
loop is N+1: the round-trip count follows the table count. A single stitched
query is one round trip, which is what the PostgreSQL provider does, but it
needs a materialized CTE that only holds together in one dialect. Five bulk
statements sit between the two: a fixed count, no generated SQL, and five flat
result sets grouped in memory by table name.

## Where the declared keys come from

The boxes come from `ALL_TABLES` and `ALL_TAB_COLUMNS`. The edges - the part that
makes it a diagram rather than a list - come from `ALL_CONSTRAINTS`. A foreign
key in Oracle is a constraint of type `R` whose `R_CONSTRAINT_NAME` names the
primary or unique constraint it points at, so the read joins the constraint back
to the one it references:

```sql
SELECT ac.TABLE_NAME,
       acc.COLUMN_NAME,
       rc.TABLE_NAME AS REF_TABLE,
       rcc.COLUMN_NAME AS REF_COLUMN
FROM ALL_CONSTRAINTS ac
JOIN ALL_CONS_COLUMNS acc ON ac.CONSTRAINT_NAME = acc.CONSTRAINT_NAME AND ac.OWNER = acc.OWNER
JOIN ALL_CONSTRAINTS rc ON ac.R_CONSTRAINT_NAME = rc.CONSTRAINT_NAME AND ac.R_OWNER = rc.OWNER
JOIN ALL_CONS_COLUMNS rcc ON rc.CONSTRAINT_NAME = rcc.CONSTRAINT_NAME AND rc.OWNER = rcc.OWNER
WHERE ac.OWNER = :1 AND ac.CONSTRAINT_TYPE = 'R'
```

Two consequences follow from that being the only source of an edge.

The first is the rule the [feature page](/features) publishes for every engine:
edges are discovered from declared foreign keys. A relationship your application
enforces in code, or that lives only in a naming convention, declares nothing for
this query to find and draws no line. Oracle is not special there; it is the same
sentence as ClickHouse, arrived at from the opposite direction, since ClickHouse
declares no foreign keys at all.

The second is specific to this dictionary read. The join above matches
`ac.R_OWNER` to the referenced constraint's owner, but the outer filter is
`ac.OWNER = :1`. A foreign key declared in your schema and pointing at a table in
another one has a resolvable target row and no box to attach it to, because the
target table was excluded by the table read. The relationship exists in Oracle.
It is not in the picture.

## Why the schema read is owner-scoped

`OWNER = :1` is not the same predicate as "everything you can read". The `ALL_*`
views show every object the session holds any privilege on: application schemas
the user has a single SELECT grant on, integration staging areas, whatever a
vendor package installed. Drawing all of them produces a picture of the
instance, not of the schema you are working in.

Scoping to the connecting user makes the drawn scope match the credential. What
you see is what that user owns, which is a boundary a DBA can reason about and
grant against.

It also settles the edge set with no further work. Nodes and edges are filtered
by the same predicate, so the diagram can never contain an edge pointing into
empty space.

## What is not listed, and how to see it

There is no cross-schema browsing on the Oracle provider. Objects in
other schemas that your user can see are not listed in the tree, are not drawn in
the diagram, and there is no setting that changes it. There is also no two-phase
loading - no separate list-then-relations call - so `/api/db/schema/list` falls
back to the same full `getSchema()`. The tree arrives whole or not at all.

Two things do work, and neither pretends to be the diagram.

**Add a connection for that user.** Oracle connects to a service rather than a
database name, so a second connection differs from the first only in the
credential: same host, same port, same service, a different user. That user's
schema becomes a tree and a diagram of its own.

**Ask the dictionary yourself.** The editor sends the SQL you type, and the
`ALL_*` views are ordinary tables to it:

```sql
SELECT OWNER, TABLE_NAME, CONSTRAINT_NAME, R_OWNER
FROM ALL_CONSTRAINTS
WHERE CONSTRAINT_TYPE = 'R' AND R_OWNER <> OWNER
ORDER BY OWNER, TABLE_NAME
```

That returns the cross-schema references your session can see. It is a result
grid, not a graph, and it is the honest answer: the product will not draw
something it did not read.

## What the tables do not carry

The `TableSchema` this read returns has no size field. Not zero, not unknown - the
field does not exist, because none of the five queries reads a segment. Storage
figures on Oracle come from the monitoring path, which reads `USER_SEGMENTS` and
`DBA_DATA_FILES` under its own privilege guards, and that path is separate from
the schema read on purpose: a schema tree that needed a DBA grant to render would
not render for the application user it is usually opened as.

The one number the tables do carry is `rowCount`, taken from
`ALL_TABLES.NUM_ROWS`. That is the optimizer's estimate. It is as fresh as the
last `DBMS_STATS` run, and it is `NULL` on a table nobody has gathered statistics
for, which is every table you created this morning. Read it as an order of
magnitude for choosing which box to open first. Do not read it as a count; the
count is `SELECT COUNT(*)`, and it costs what it costs.

The rest of what the Oracle provider does and declines to do - Thin-mode
transport, the maintenance vocabulary, and an agent auto run that ends
engine-unsupported on Oracle while plan mode still opens and executes nothing -
is on the [engine page](/databases).
