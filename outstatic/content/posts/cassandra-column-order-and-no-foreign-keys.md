---
title: No constraints to discover, and a column order to rebuild
status: published
author:
  name: LibreDB
  picture: ''
slug: cassandra-column-order-and-no-foreign-keys
description: The catalog reports no position for regular columns and sorts by name, so the tree rebuilds the order a where clause actually needs.
coverImage: ''
tags:
  - value: engineering
    label: Engineering
  - value: databases
    label: Databases
publishedAt: 2026-01-09T09:00:00.000Z
---

Open the ER diagram on a Cassandra connection and the canvas has boxes and no
lines. Open one of those boxes and the columns sit in an order nobody typed. Both
are the same fact seen twice: a Cassandra table schema publishes a column order
for the partition key and the clustering columns, and nothing else - and it
publishes no relations at all. Every engine answer quoted below was measured
against Apache Cassandra 5.0.9, the version `system.local.release_version`
reports on the official `cassandra:5.0.9` image.

## Why the relation list is always empty here

An empty edge list is usually ambiguous. It can mean the read found nothing, the
read was refused, or the concept does not exist on this engine, and a client that
reports `[]` for all three has told you nothing.

Cassandra settles it. The provider declares no foreign keys and the relation list
is always empty, because the clause does not exist in this model, and index
uniqueness is always false for the same reason. Neither is a gap in the read.
`ALTER TABLE ... ADD CONSTRAINT ... FOREIGN KEY` answers `line 1:48 mismatched
input 'FOREIGN' expecting EOF`, and `CREATE UNIQUE INDEX` answers `no viable
alternative at input 'UNIQUE'`. The keywords are not in the grammar, so there is
no statement that could create the object the diagram is looking for.

That is recorded in the capability set rather than left to the canvas to imply:
`declaresForeignKeys` is `false`, so a reader knows `foreignKeys: []` means this
engine has none rather than this schema declares none. The [ER diagram
feature](/features) publishes the matching limit on the product side - edges come
from declared foreign keys, and a relationship your application enforces in code
but never declares has nothing to discover.

## A primary key that means something else

The relational reflex is to read a primary key as an identity. In CQL it is an
access path, and it is two things wearing one name.

The partition key decides which partition a row lives in. The clustering columns
decide the order of rows inside that partition. Only the brackets in the DDL say
which columns do which job, and the difference is not cosmetic:

```sql
-- probe.composite_pk
PRIMARY KEY ((tenant, day), ts)

-- probe.pk_flat
PRIMARY KEY (tenant, day, ts)
```

Those two tables differ by one pair of brackets and nothing else. `SELECT * FROM
probe.pk_flat WHERE tenant = 'a'` is served, because `tenant` is the whole
partition key there. The
identical restriction on `probe.composite_pk` answers code 2200, `Cannot execute
this query as it might involve data filtering and thus may have unpredictable
performance` - `tenant` is half a partition key, and half is not a partition.

Ordering follows the same rule. `SELECT * FROM t ORDER BY name` answers `ORDER BY
is only supported when the partition key is restricted by an EQ or an IN`, because
a sort order only exists inside a partition.

So the useful thing a schema tree can tell you about a Cassandra table is not
which column is "the key". It is which columns are the partition key, in what
order, and which are the clustering columns, in what order.

## What the catalog does not preserve

Introspection is four statements against `system_schema`, scoped to the pinned
keyspace: tables, views, columns and indexes. The column read is the one that
matters here:

```sql
SELECT table_name, column_name, type, kind, position, clustering_order
  FROM system_schema.columns WHERE keyspace_name = 'probe'
```

Two properties of that result set decide what a tree can honestly show:

| Column kind | `position` | Ordering in the result |
| --- | --- | --- |
| `partition_key` | 0-based within its kind | by column name |
| `clustering` | 0-based within its kind | by column name |
| `regular`, `static` | always `-1` | by column name |

The server returns rows sorted by column name, and `position` is `-1` for every
regular and static column. So the order the table was written in cannot be
reconstructed from the catalog.

`nullable` comes out of the same read and is `false` for exactly the primary-key
components, because CQL has no `NOT NULL` to declare on anything else and every
regular column of an existing row may be absent entirely.

## Rebuilding a Cassandra table schema column order from the partition key out

Declaration order is gone, so the tree does not pretend to have it. It builds an
order that means something instead: partition key by `position`, then clustering
columns by `position`, then everything else alphabetically.

That is not an arbitrary tie-break. It is the order `DESCRIBE TABLE` prints, and
it is the order the primary key has to be written in a `WHERE` clause. Reading a
table node top to bottom gives you the prefix rules in the sequence you need them,
and `clustering_order` comes along on each clustering column, so the direction the
rows are stored in is on the same line as the column that stores them.

The same distinction is why the schema-diff migration generator will not emit a
Cassandra `CREATE TABLE`. `system_schema.columns` separates the two roles by
`kind`, but `ColumnDiff` keeps a single boolean for "is primary", so both tables
in the bracket example above reduce to the same three key columns and the shared
serializer would pick the flat layout. Generating that would repartition the data
and succeed while doing it, so a comment naming the reason is emitted in place of
the DDL. One boolean is not enough to describe this key, in the diff generator or
anywhere else.

## Reading the tree as a query guide

The tree for a Cassandra keyspace is a list of access paths. Each table names its
partition key first, so you can see which restriction any query against it has to
carry; then its clustering columns in storage order, so you can see what may be
ranged over and what may be sorted; then the rest of the columns, which you can
select and cannot filter on without `ALLOW FILTERING`.

Secondary indexes are read from `system_schema.indexes`, with `options.target`
naming the indexed column, and each one carries `unique: false` - the engine's
answer, not the schema's. Materialized views come from `system_schema.views` and
appear as tables with their own columns; they are disabled by default in 5.0
(`materialized_views_enabled: false`), so on a stock install that list is empty
and the tree shows tables only.
