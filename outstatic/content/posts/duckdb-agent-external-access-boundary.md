---
title: Read-only mode is not the DuckDB boundary, external access is
status: published
author:
  name: LibreDB
  picture: ''
slug: duckdb-agent-external-access-boundary
description: Under read-only access alone, file copies, exports, extension installs and filesystem reads all succeeded while an insert was refused in the same session.
coverImage: ''
tags:
  - value: engineering
    label: Engineering
  - value: databases
    label: Databases
  - value: security
    label: Security
publishedAt: 2025-12-18T09:00:00.000Z
---

With `access_mode: 'READ_ONLY'` in force, `INSERT` was refused and
`read_text('/etc/hostname')` returned the file. Both in the same session, on the
same handle. Everything below follows from that pair of results.

## The read-only flag bounds the database, not the process

DuckDB is embedded and file-based. There is no host, no port, no user and no
password - the connection is a server-local path to a database file or
`:memory:`, and the filesystem is the access control. `defaultPort` is `null`,
so the connection dialog offers no port at all.

That shape is what makes the read-only flag misleading. `access_mode` is a
property of the attached database. When it is set, the engine refuses statements
that would modify that database, and it says so plainly:

```
Cannot execute statement of type "INSERT" on database "w" which is attached in read-only mode!
```

The flag was genuinely in force during every measurement below. `INSERT` was
refused throughout. What it does not touch is the process: the DuckDB library is
linked into Studio's own process, holds Studio's own privileges, and its
file-reaching functions are ordinary reads as far as `access_mode` is concerned.
This is the same class of escape as `VACUUM INTO` on SQLite and `COPY TO PROGRAM`
on PostgreSQL, both already closed in their own providers.

## What still succeeded under it, measured

Each row below was run against DuckDB v1.5.5 through `@duckdb/node-api`
1.5.5-r.4, on a handle carrying `access_mode: 'READ_ONLY'` and nothing else.
The second column is the same statement on the handle the agent actually gets.

| Statement | `READ_ONLY` alone | With `enable_external_access: 'false'` |
|---|---|---|
| `INSERT INTO users ...` | refused | refused |
| `COPY (SELECT 1) TO '/path/leak.csv' (FORMAT CSV)` | allowed, file written | `Permission Error` |
| `COPY users TO '/path/leak.parquet' (FORMAT PARQUET)` | allowed, file written | `Permission Error` |
| `EXPORT DATABASE '/path/exp'` | allowed, directory written | `Permission Error` |
| `INSTALL httpfs` | allowed, reaches the network | `Permission Error` |
| `read_csv_auto('/path/x.csv')` | allowed, arbitrary local file read | `Permission Error` |
| `read_text('/etc/hostname')` | allowed, contents returned | `Permission Error` |
| `read_blob('/etc/hostname')` | allowed, bytes returned | `Permission Error` |
| `glob('/etc/*')` | allowed, directory listing | `Permission Error` |
| `sniff_csv('/etc/hostname')` | allowed | `Permission Error` |
| `ATTACH '/path/new.duckdb' AS side` | refused, file must exist | `Permission Error` |
| `CREATE TEMP TABLE` then `INSERT` | allowed | allowed |
| `SET memory_limit='1GB'` | allowed | allowed |
| Ordinary reads, `duckdb_*()`, `pragma_database_size()` | allowed | allowed |

Read the first column as a capability list for anything holding that handle: it
can write a CSV anywhere the Studio process can write, read any file the process
can read, and pull an extension over the network. The database file it was told
to protect is the one thing it cannot touch.

Note what the second column leaves alone. Catalog reads, storage pragmas and
ordinary `SELECT` are untouched, which is why the agent still has a usable
engine after the option is set.

## The option that closes the process, fixed at open

`queryReadOnly` opens a second handle with two engine options, both fixed at
open: `access_mode: 'READ_ONLY'` and `enable_external_access: 'false'`. The
second one is the boundary. Under it, every form in the table above answers with
the engine's own sentence:

```
Permission Error: Cannot access file "/etc/hostname" - file system operations are disabled by configuration
```

Two details about that handle are worth knowing before you reason about
deployment. It is a second handle in the *same operating-system process* as the
writable editor connection, and that is the only reason it can exist: a second
DuckDB *process* on an open file is refused with a lock error even when it asks
for `READ_ONLY`. And the writable editor connection passes neither option, by
design - there `COPY ... TO` and `read_csv_auto('...')` are features, and they
were measured unaffected. The file-reading capability listed for DuckDB on
[the engine list](/databases) is a property of the editor connection, not of an
agent run.

This is also the concrete meaning of a boundary published elsewhere on this
site: agent AUTO mode, the run that executes model-authored statements, works on
PostgreSQL, SQLite and DuckDB only, because that read-only profile is
database-native and exists only where a provider implements it. On any other
engine an auto run ends `engine-unsupported`. Agent PLAN mode opens on every
connection, executes nothing, and drafts a statement for a human to run.

## Why it cannot be turned back on mid-session

A configuration option is only a boundary if the thing inside the box cannot
change it. That was not a given, so it was measured. Both spellings answer the
same way:

```sql
SET enable_external_access = true;
SET GLOBAL enable_external_access = true;
-- Invalid Input Error: Cannot enable external access while database is running
```

The control measurement is the one that makes this meaningful. `SET
memory_limit='1GB'` is accepted on the same read-only handle. So the refusal is
a property of `enable_external_access` specifically, not a blanket "read-only
sessions cannot run SET". The engine lets a session reconfigure itself in
general and refuses this one option in particular, which is the property the
profile rests on rather than something to assume without measuring.

## A denylist is defence in depth, not the boundary

The provider still runs a SQL denylist before the engine sees a statement. It
names `COPY`, `EXPORT`, `ATTACH`, `INSTALL`, `LOAD`, the
`read_csv` / `read_parquet` / `read_json` / `read_text` / `read_blob` / `glob`
family and `json_execute_serialized_sql`, and it refuses outright any statement
it cannot read reliably, such as one with an unterminated string or comment. It
stays because a refusal that names the construct and the reason is worth more to
a reader than a generic permission error, and because it costs nothing to run
first.

It is not the boundary, and three measured bypasses are why. All three executed
when the denylist was the only control. All three are refused by the engine
option today.

| Bypass | Why a text guard misses it |
|---|---|
| `SELECT * FROM "read_text"('/etc/hostname')` | The scanner skips quoted-identifier spans by design, which is correct for a keyword and wrong for a function name. DuckDB resolves `"read_text"(...)` and `main."read_text"(...)` exactly like the bare spelling; all three returned the file |
| `SELECT * FROM '/tmp/x.csv'` | A replacement scan turns a bare path in `FROM` into a `read_csv_auto`. There is no forbidden word anywhere in the statement to find |
| `json_execute_serialized_sql(json_serialize_sql('SELECT * FROM read_text(''/etc/hostname'')'))` | The second statement travels inside a string literal, which the scanner correctly declines to read as code. The outer function is denied by name, but the class is not closable by reading text |

The same pass found one thing the option does not stop: `read_duckdb()` pointed
at the connection's own file still answers, because it reaches nothing the
profile had not already granted.

So the limit, stated plainly: read-only access mode alone bounds the database
rather than the process, the boundary is external access disabled at open, and
the SQL denylist is defence in depth with three measured bypasses on record.
One more boundary sits outside DuckDB entirely and is worth carrying into your
threat model with the rest of [what this product publishes about its own
security](/security): anyone who can create a DuckDB connection chooses a path
on the server's filesystem, so on a shared deployment that right is closer to a
shell on the Studio host than to a database login.
