---
title: A MySQL ER diagram is bounded by one database
status: published
author:
  name: LibreDB
  picture: ''
slug: mysql-er-diagram-single-database-scope
description: Every introspection query binds to the connected database, so a reference that crosses schemas simply does not appear as an edge on the diagram.
coverImage: ''
tags:
  - value: engineering
    label: Engineering
  - value: databases
    label: Databases
publishedAt: 2026-06-11T09:00:00.000Z
---

You connect to `orders`, open the diagram, and the boxes are right. Then you look
for the line from `orders.customer_id` to the customers table and it is not
drawn. Nothing failed. When you generate a MySQL ER diagram from an existing
database, the edge set is bounded by the connection, and the customers table
lives in a different database on the same server.

Every introspection query binds the connected database, so there is no
cross-schema foreign-key resolution, and the schema read issues one query plus
three per table with no two-phase streaming. That one sentence covers both
boundaries this post is about: what bounds the edge set, and what the read
costs.

## Where a MySQL ER diagram from an existing database gets its edges

There is one source, and it is the catalog. The MySQL provider's `getSchema()`
reads four `information_schema` views:

| Data | View | What is read |
| --- | --- | --- |
| Tables | `TABLES` | `TABLE_ROWS` (an InnoDB estimate), `DATA_LENGTH + INDEX_LENGTH` |
| Columns | `COLUMNS` | first 100 per table; primary key is `COLUMN_KEY = 'PRI'` |
| Foreign keys | `KEY_COLUMN_USAGE` | rows where `REFERENCED_TABLE_NAME IS NOT NULL` |
| Indexes | `STATISTICS` | columns concatenated by `SEQ_IN_INDEX`; unique is `NOT NON_UNIQUE` |

The third row is the entire edge set. An edge on the diagram is a row in
`KEY_COLUMN_USAGE` that names a referenced table, and nothing else becomes one.
The layout is done by ELK.js and the boxes carry cardinality labels, but the
graph itself is discovered rather than authored: if the server does not publish
the constraint, there is no line to lay out. That is the published limit on
[the features page](/features) too - a relationship your application enforces in
code but never declares in the schema has nothing to discover.

For a MySQL foreign key diagram this has a consequence worth checking before you
conclude the tool lost an edge. If a reference was never declared as a
constraint, `KEY_COLUMN_USAGE` has no row for it, so it is invisible to any
catalog reader, this one included. The application still works. The diagram is
still correct about what the database declares, which is the only thing it
claims to show.

## Why the scope is one database

Every introspection query the provider issues is parameterised with
`TABLE_SCHEMA = ?`, bound to the database on the connection. That single decision
is what makes the scope one database, and it follows from MySQL's own model:
a MySQL schema is a database. There is no second level to walk.

So the provider never sees a table outside the connected database. Table display
names are bare - no `schema.table` prefix, because there is only one schema to
prefix with. And there is no cross-schema foreign-key resolution: a constraint
whose referenced table lives elsewhere on the server has no box to point at, so
it is not drawn as an edge.

This is where the shape differs sharply from the PostgreSQL provider in the same
codebase, which walks all non-system schemas in one pass and resolves foreign
keys across them. Both are reading the catalog honestly; they are reading
differently shaped catalogs. If your MySQL server holds a logical application
split across several databases, the diagram is per-database and you will open it
once per connection.

The practical move is to make the connection say what you want to see. One
connection per database is not a workaround here, it is the unit the catalog
reads in. The provider asks for foreign keys one table at a time, binding
`TABLE_SCHEMA` and `TABLE_NAME`; drop the table binding and the same predicate
returns the whole edge set in one statement you can run yourself:

```sql
-- every declared edge in the connected database
SELECT TABLE_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
FROM information_schema.KEY_COLUMN_USAGE
WHERE TABLE_SCHEMA = ?
  AND REFERENCED_TABLE_NAME IS NOT NULL;
```

## The read cost behind the tree

The same catalog shape sets the cost. `getSchema()` issues one query for the
table list and then three queries per table - columns, foreign keys, indexes.
That is the classic `1 + 3N` pattern, and it is stated in the provider doc rather
than hidden: a hundred-table database is a little over three hundred round trips
before the tree is complete.

Those statements carry parameters, so they go over the binary prepared protocol
rather than the text one. That is a routing rule in the provider - a statement
with placeholders uses `execute`, a parameterless one uses `query` - and it means
schema reads are bound values, not interpolated database names.

One more bound worth knowing before you read a wide table's box: columns are read
`LIMIT 100` per table. A table with two hundred columns shows a hundred of them.
For a diagram that is usually academic, since the edges hang off keys and not
off the hundredth column, but it is a cap and not a coincidence.

## No two-phase load, and what that feels like on a wide schema

PostgreSQL's provider implements `getSchemaList()` and `getSchemaRelations()`,
which lets the object tree paint names first and stream relationships in behind
them. MySQL implements neither. The `/api/db/schema/list` route therefore falls
back to the single `getSchema()` call described above.

What that feels like: the tree arrives complete or it does not arrive. There is
no fast first paint of table names followed by edges filling in, because the only
reading available is the whole one. On a schema of a dozen tables you will not
notice. On a schema of several hundred, the first open of the object tree or the ER
diagram is one long read where the PostgreSQL path is a bulk read followed by a
relationship pass, and it is more round trips for the same information.

Stating that is more useful than tuning around it. The fix is a second
introspection path in the provider, not a setting you can change, and until that
exists the honest description of the tree is: one query plus three per table, no
streaming.

Two smaller facts belong with it, because they are the same catalog. Row counts
on the tables come from `TABLE_ROWS`, which is an InnoDB engine estimate rather
than a count - the number on the box is the engine's guess, and a
`SELECT COUNT(*)` can disagree with it. And the MySQL provider implements no
`getPoolStats()`, so there is no pool panel to watch while a large schema read
is in flight.

## What the scoping rule covers

`getSchema()` returns one entry per `BASE TABLE` in the connected database, so a
box on the diagram is a base table and an edge is a declared foreign key between
two of them. Anything the connection did not bind is not missing data, it is out
of scope, and the edge set is one you can check against the server yourself with
the statement above.

The same provider answers for MariaDB, Percona, TiDB and the other
MySQL-protocol engines - there is no separate MariaDB type id - and their
support levels differ, listed per engine on [the databases page](/databases).
The scoping rule is this provider's code rather than any one server's, so it
holds wherever this provider is what answered.

If you want the cross-database picture, the diagram will not assemble it for
you. It will tell you what one database declares about itself, which is the
thing a catalog can know.
