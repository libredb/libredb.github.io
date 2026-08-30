---
title: Querying Parquet and CSV from the DuckDB editor
status: published
author:
  name: LibreDB
  picture: ''
slug: duckdb-parquet-csv-editor-versus-agent
description: File-reaching SQL works on the writable editor connection and is refused under the read-only agent handle, so the capability has to be stated with that split.
coverImage: ''
tags:
  - value: engineering
    label: Engineering
  - value: databases
    label: Databases
publishedAt: 2026-05-09T09:00:00.000Z
---

You can query a Parquet file with SQL in the DuckDB editor without importing it,
without a staging table and without a load step. You cannot do it in an agent run
against the same connection. Both are true at once, and the difference between
them is a boundary the read-only agent handle fixes at open.

DuckDB is an embedded engine: the connection is a server-local path to a database
file or `:memory:`, with no host, no port, no user and no password. The
filesystem is the access control. That is also why the file-reading question is
sharper here than elsewhere - whatever the engine can read, it reads with the
Studio process's own privileges.

## Query a Parquet file with SQL, with no load step

The editor connection is a plain read-write DuckDB handle. It is opened with none
of the restricting engine options described further down, so the file-reaching
table functions are available:

```sql
SELECT country, count(*) AS orders
FROM read_parquet('/data/warehouse/orders-2026-q3.parquet')
GROUP BY country
ORDER BY orders DESC;

SELECT *
FROM read_csv_auto('/data/imports/customers.csv')
LIMIT 200;
```

There is a third form, and it matters later: DuckDB has a replacement scan, so a
bare path in `FROM` resolves on its own.

```sql
SELECT * FROM '/data/imports/customers.csv';
```

No function name appears in that statement, which is the point when the denylist
comes up below.

The extensions this depends on are already present without network access. On the
probe run, `autocomplete`, `core_functions`, `icu`, `json` and `parquet` were
loaded from the bundled set; `httpfs` was installed but not loaded. So local
Parquet and local CSV work in an air-gapped container, and object storage over
HTTP is a separate question with a separate extension.

One editor behaviour to know before you paste a script in: a multi-statement
string runs only its first statement. `runAndReadAll("SELECT 1 AS a; SELECT 2 AS
b")` answered `[{"a":1}]`, with no error and no second result.

## What the writable editor connection can reach

The editor connection does not merely read Parquet. It reaches any path the
Studio process can reach.

`COPY ... TO` writes a file. `EXPORT DATABASE` writes a directory.
`read_text('/etc/hostname')` returns file contents, `read_blob` returns bytes,
`glob('/etc/*')` returns a directory listing, and `sniff_csv` reaches whatever
path it is given. All of those were measured working. On the editor connection
they are features - a `COPY (SELECT ...) TO '/data/out/result.parquet' (FORMAT
PARQUET)` is how you get an answer out of an analytical session and into the next
job.

```sql
COPY (
  SELECT customer_id, sum(total) AS lifetime
  FROM read_parquet('/data/warehouse/orders-2026-q3.parquet')
  GROUP BY customer_id
) TO '/data/out/lifetime.parquet' (FORMAT PARQUET);
```

The consequence follows directly: on a shared deployment, a DuckDB connection is
closer to a shell on the Studio host than to a database login. Anyone who can
create one chooses a path on the server's filesystem. Grant connection-creation
rights on that understanding rather than on the mental model you use for a
networked engine with roles and passwords.

One more constraint from the same embedded design. A DuckDB file admits exactly
one operating-system process: a second read-write process is refused with
`IO Error: Could not set lock on file ...`, and a second `READ_ONLY` process is
refused with the same error. Two Studio replicas pointed at one file is a broken
configuration, not a degraded one. That measurement is why the engine's row on
[the engines page](/databases) says health shows storage rather than connections.

## The same statements under the agent handle

Agent AUTO mode runs on PostgreSQL, SQLite and DuckDB only, because the read-only
profile is database-native and exists only where a provider implements it. On any
other engine an auto run ends `engine-unsupported`. PLAN mode is a different
thing entirely: it opens on every connection, holds no tools, executes nothing,
and drafts a statement for a human to run.

When an AUTO run touches DuckDB, it does not reuse the editor's handle. A second
handle opens in the same process with two engine options fixed at open:

```
access_mode: 'READ_ONLY'
enable_external_access: 'false'
```

Under that handle, every statement in the two sections above is refused:

```
Permission Error: Cannot access file "/etc/hostname" - file system operations are disabled by configuration
```

`read_parquet`, `read_csv_auto`, `read_text`, `read_blob`, `glob`, `sniff_csv`,
`COPY ... TO`, `EXPORT DATABASE` and `INSTALL` all answer that way.
`CREATE TEMP TABLE` and `SET memory_limit` still work; ordinary reads, the
`duckdb_*()` catalog functions and `pragma_database_size()` are untouched. The
agent can read the database. It cannot read the disk the database sits on.

**So the file-reaching capability is editor-only.** It works on the writable
editor connection and nowhere else: under the agent read-only profile every one
of these forms is refused, by an engine option fixed at open and by a statement
denylist. If your plan was to have an agent run read Parquet files off the disk,
the plan does not work, and it will not work by configuration.

This is where the same-process detail above matters. A read-only handle in a
separate process would hit the file lock. The agent's handle works only because
it is a second handle in the *same* process as the writer.

## Two independent controls doing the refusing

There are two controls, they are not equivalent, and only one of them is the
boundary.

**`access_mode: 'READ_ONLY'` is not the boundary.** With it genuinely in force -
`INSERT` refused in the same session - `COPY ... TO` wrote a file, `EXPORT
DATABASE` wrote a directory, `INSTALL httpfs` reached the network,
`read_text('/etc/hostname')` returned contents and `glob('/etc/*')` listed a
directory. The flag bounds the database, not the process.

**`enable_external_access: 'false'` is the boundary**, and it holds because it
cannot be undone from inside a session. Both `SET` and
`SET GLOBAL enable_external_access = true` answer
`Invalid Input Error: Cannot enable external access while database is running`.
That refusal is a property of the option rather than of read-only mode: `SET
memory_limit` on the same handle is accepted, so a session being unable to
reconfigure itself was not a given.

**The SQL denylist is defence in depth.** It runs first, it names the construct
and the reason - which the engine's sentence does not - and it refuses any
statement it cannot read reliably, such as one with an unterminated string or
comment. It covers `COPY`, `EXPORT`, `ATTACH`, `INSTALL`, `LOAD`, the
`read_csv` / `read_parquet` / `read_json` / `read_text` / `read_blob` / `glob`
family and `json_execute_serialized_sql`.

It is not the boundary because three bypasses were measured against it:

| Bypass | Why reading text misses it |
| --- | --- |
| `SELECT * FROM "read_text"('/etc/hostname')` | The scanner skips quoted-identifier spans - right for a keyword, wrong for a function name. All three spellings returned the file |
| `SELECT * FROM '/tmp/x.csv'` | The replacement scan from section one. There is no forbidden word in the statement to find |
| `json_execute_serialized_sql(json_serialize_sql('...'))` | The inner statement travels inside a string literal, which the scanner correctly declines to read as code |

All three execute when a text guard is the only control. All three are refused by
the engine option today. That is the argument for putting the boundary in the
engine and keeping the parser as the thing that explains it.

## Designing a workflow around the half that stays open

The split is stable, so build on it rather than around it.

**Do the file work in the editor, deliberately.** Reading a Parquet file,
sniffing a CSV, writing a result out with `COPY ... TO` - these belong in a tab a
person is looking at, run by an identity you granted a path to.

**Land what the agent needs inside the database.** An AUTO run can read tables,
views and the catalog on that file. If the analysis it should perform is over
Parquet, materialise the Parquet into a table in the editor first, then point the
run at the table. DuckDB answers `count(*)` out of row-group metadata, so the
object tree counts rows rather than trusting `estimated_size`, which is an
estimate - after a delete it answered 1,076,480 where `count(*)` answered
1,000,000.

**Use PLAN mode where AUTO cannot go.** Plan mode drafts the file-reaching
statement and hands it back for you to run in the editor. Nothing executes, so
nothing has to be sandboxed, and the statement lands on the connection that is
allowed to run it. The [feature pages](/features) carry the same split for agent
mode generally.

Two smaller traps worth knowing while you set this up. A catalog is named after
the file stem, so `analytics.duckdb` containing a schema named `analytics`
produces `Binder Error: Ambiguous reference to catalog or schema "analytics"` -
that is the file name, not a product bug. And an `ATTACH`-ed catalog is queryable
but not enumerated in the object tree, because every catalog statement is scoped
to `current_database()`.
