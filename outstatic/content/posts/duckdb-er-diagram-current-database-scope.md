---
title: DuckDB diagrams are scoped to the catalog you opened
status: published
author:
  name: LibreDB
  picture: ''
slug: duckdb-er-diagram-current-database-scope
description: Foreign keys come from a single bulk read of the constraint catalog, and every catalog statement the DuckDB provider issues is scoped to the current database.
coverImage: ''
tags:
  - value: engineering
    label: Engineering
  - value: databases
    label: Databases
publishedAt: 2026-02-03T09:00:00.000Z
---

A DuckDB foreign key schema diagram draws real edges. The engine stores declared
constraints in a catalog you can query, `duckdb_constraints()` publishes both the
constraining columns and the referenced ones as arrays, and the ER diagram
capability for `duckdb` is `full` rather than partial. That part is settled.

The part worth reading is the boundary drawn around it. Every catalog statement
the provider issues carries the same `WHERE` clause, and that one clause decides
which objects appear in the tree, which edges appear in the diagram, and which
perfectly queryable database is missing from both.

## Five catalog statements and no per-object sweep

Reading a schema is where a database tool usually gets slow, because the naive
shape is a loop: list the tables, then for each table ask for its columns, then
ask again for its constraints. A hundred tables is two hundred round trips on top of the first.

`getSchema()` on DuckDB issues five catalog statements plus one counting
statement, and no per-object sweep. The five are bulk reads over the whole
catalog:

| Statement | Reads | Feeds |
| --- | --- | --- |
| `duckdb_tables()` | schema, table, `estimated_size` | The object tree |
| `duckdb_views()` | schema, view | The object tree |
| `duckdb_columns()` | column, type, nullability, default | Tables and views both |
| `duckdb_constraints()` | primary and foreign keys | The diagram |
| `duckdb_indexes()` | index name, uniqueness, expressions | The table detail |

`duckdb_columns()` covers views as well as tables, so one read serves both. No
schema query is issued at all: schema names come from the `schema_name` column
that every one of the five already carries.

Two shapes in that table are not what they look like.
`duckdb_tables().estimated_size` is a row count rather than a byte size, and it
is an estimate: after a delete on a 20,000,000-row table it answered 1,076,480
where `count(*)` answered 1,000,000, and a `CHECKPOINT` left it there. The
counting statement is why the sixth read exists - one `UNION ALL` arm per table,
issued once for the whole catalog. And `duckdb_indexes().expressions` is declared
`VARCHAR` and prints as the string `"[a, b]"`, so the statement casts it
`::VARCHAR[]` to make the engine produce a real list.

## Where a DuckDB foreign key schema diagram gets its edges

The constraint read is the one the diagram depends on:

```sql
SELECT schema_name, table_name, constraint_type,
       constraint_column_names, referenced_table, referenced_column_names
FROM duckdb_constraints()
WHERE database_name = current_database()
  AND constraint_type IN ('PRIMARY KEY', 'FOREIGN KEY');
```

The `constraint_type` filter is doing real work. `duckdb_constraints()` publishes
every `NOT NULL` and every `UNIQUE` constraint as its own row too, so an
unfiltered read returns rows the diagram has no use for. Filtering by type
is also why this read is not filtered on `NOT internal` the way the table, view
and column reads are.

Both column lists arrive as `VARCHAR[]` - `["id"]`, not a comma-joined string -
so a composite key needs no string parsing. A composite foreign key is one
constraint row spanning several columns, and the provider zips
`constraint_column_names` against `referenced_column_names` into the product's
per-column relationship records. On a `PRIMARY KEY` row `referenced_table` is
NULL and `referenced_column_names` is `[]`, which is how one read serves both
key kinds without a second statement.

This is the same rule the [ER diagram feature](/features) states everywhere: the
edges are discovered from declared constraints, not inferred. A relationship your
loader enforces in application code and never declares in the schema has nothing
in `duckdb_constraints()` to find, and no edge is drawn for it. That is worth
knowing on an analytical file, where a table built by a bulk load may carry no
declared constraints at all - a diagram with boxes and no edges there is an
accurate picture of the file, not a broken read.

## Why the reads are scoped to the current database

Every one of the five carries `database_name = current_database()`. The obvious
alternative is worse, and it fails silently.

`duckdb_schemas()` publishes an `internal` flag, and the natural filter is
`WHERE NOT internal`. On DuckDB that flag is TRUE for `main` even in a user
database. So the obvious filter drops `main` - the schema nearly every table
lives in - out of the object browser, with no error raised anywhere. The tree
just comes back short, and a user has no way to tell a missing schema from an
empty one.

Scoping by database is the filter that behaves. `NOT internal` remains correct on
`duckdb_tables()`, `duckdb_views()` and `duckdb_columns()`, where it removes the
system catalog rather than the user's default schema, and each of those carries
the database scope as well.

There is a second reason to prefer the database scope, and it comes from the
`information_schema` alternative. `information_schema.tables` and
`information_schema.columns` do answer on DuckDB, Postgres-shaped, with a
`table_type` of `BASE TABLE` or `VIEW`. They are deliberately not used: they
carry no `internal` flag, so they cannot separate the user's objects from the
system catalog, which is the one distinction the tree needs.

## An attached catalog you can query but cannot browse

Here is the cost of that clause, stated plainly.

**Attached catalogs are not enumerated in the object browser. Every catalog read
is scoped to the current database, so a database attached inside a session is
queryable but never appears in the tree.**

Run `ATTACH '/data/side.duckdb' AS side` in the editor and `SELECT * FROM
side.main.events` returns rows. The editor works on it. The diagram does not draw
it, the tree does not list it, and no table inside it is counted. Nothing errors;
the objects are simply not there, because `current_database()` still answers with
the catalog the connection was opened against and the five reads all agree with
each other about which catalog that is.

That `ATTACH` is an editor statement. Agent auto mode runs on DuckDB, and it
does not get the same escape hatch: `ATTACH` is named on the provider's SQL
denylist, and the agent's handle is opened with `enable_external_access:
'false'` on top of `access_mode: 'READ_ONLY'`.

The workaround is the connection dialog. A DuckDB connection is a server-local
file path - there is no host, no port and no credential, since `defaultPort` is
`null` and the filesystem is the access control. Adding a second connection
pointed at `/data/side.duckdb` gives that file its own tree and its own diagram.
The [DuckDB engine page](/databases) carries the transport details for this.

One deployment note goes with that. A DuckDB file admits exactly one operating
system process: a second read-write process is refused with `IO Error: Could not
set lock on file ...`, and a second READ_ONLY process is refused with the same
error. So close a `duckdb` CLI session on the file before opening it in Studio,
and never point two Studio replicas at one path.

## One filename trap that looks like a product bug

The catalog name is the file stem. `warehouse.duckdb` is the catalog `warehouse`,
and `current_database()` answers `warehouse`.

Now name the file `analytics.duckdb` and put a schema named `analytics` inside
it. Every unqualified reference to that name fails:

```
Binder Error: Ambiguous reference to catalog or schema "analytics" - use a fully qualified path
```

Real, reproducible, and not a provider bug - the engine cannot tell which of the
two you meant. It is worth knowing what it is when you hit it, because the error
arrives in the editor and reads like a tool failure. It is a report about the
file name.

Two things follow. Object-browser navigation qualifies `schema.table` rather than
relying on an unqualified name resolving. And the catalog reads are scoped by
`current_database()` rather than by a literal catalog name, so the collision that
breaks a hand-written query never reaches the introspection path. The diagram
still draws for a file named this way. The editor is where the ambiguity bites,
and the message names the fix itself - qualify the reference fully, or rename
the file so that catalog and schema no longer share a name.
