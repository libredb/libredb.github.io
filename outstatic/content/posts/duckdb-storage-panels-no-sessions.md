---
title: DuckDB storage answers, sessions and slow queries do not exist
status: published
author:
  name: LibreDB
  picture: ''
slug: duckdb-storage-panels-no-sessions
description: Two catalog functions other engines have are absent here, so both panels stay empty carrying the engine own error, and table bytes are block-granular.
coverImage: ''
tags:
  - value: engineering
    label: Engineering
  - value: databases
    label: Databases
publishedAt: 2026-07-23T09:00:00.000Z
---

Open the health dashboard on a networked engine and most of it fills in. Open it
on DuckDB and two of its tabs will never carry a row. DuckDB monitoring answers
database size, block counts, memory usage and settings, because those readings
exist in the engine. It answers nothing at all about sessions or finished
statements, because the two catalog functions that would carry them are not in the
engine.

That is not a gap waiting on a release. It is what an embedded engine is. DuckDB is
linked into the Studio process and reads a file on the same filesystem: there is no
listener, no port, no user and no password. A panel that lists who is connected has
no question to ask.

## What DuckDB monitoring can say: database size, blocks and memory

The readings that do exist come from `pragma_database_size()`, and the first thing
to know about them is that they are text. Against a two-schema fixture it answered:

```json
{"database_size":"2.0 MiB","block_size":"262144","total_blocks":"8",
 "used_blocks":"8","free_blocks":"0","wal_size":"0 bytes",
 "memory_usage":"2.0 MiB","memory_limit":"50.0 GiB"}
```

Every column except `block_size` is a human-formatted string. A gauge that wants
bytes has to parse `"2.0 MiB"` back into a number, or print the engine's own string
and stop pretending it has a figure. `memory_limit` is 80% of host RAM, so it
differs on every machine and no test asserts it.

Around that: `version()` answered `v1.5.5`. `duckdb_settings()` supplies
`access_mode`, `memory_limit` and `threads`. `duckdb_temporary_files()` exists and
answered `[]` on an idle database, which is a real reading of nothing rather than a
missing one. `duckdb_memory()` breaks memory down in genuine bytes as numeric
strings, `BASE_TABLE` at `2097152`.

So the overview page is populated and the storage page is populated. The difference
between those tabs and the two below is not how much work went into them. It is
whether the engine publishes the fact.

## The two catalog functions that do not exist

Both statements answer the same way, and the error is the whole story:

```sql
SELECT * FROM duckdb_queries();
-- Catalog Error: Table Function with name duckdb_queries does not exist!

SELECT * FROM duckdb_connections();
-- Catalog Error: Table Function with name duckdb_connections does not exist!
```

There is no slow-query log and no session list on DuckDB, because the catalog
functions for both do not exist, and the panels answer empty in the engine's own
words rather than reporting a zero. The Queries tab says that DuckDB keeps no store
of finished statements, so there is nothing to enable. The Sessions tab says DuckDB
publishes no session list, so the panel can never show a row. Those two sentences
are provider labels, not generic copy: without them the Queries panel would tell a
DuckDB user to install `pg_stat_statements`, which is advice about a different
engine.

The generic empty state those tabs used to render was "No active sessions found."
That reads as *nothing is running right now*, which is a claim about the current
moment. "This panel can never show a row" is a claim about the engine. They are
different sentences and only one of them is true here.

The SQLite provider makes the opposite call: it answers the sessions panel with a
single row describing its own handle. That row would be true on DuckDB too, and it
was still not shipped, because it would be the only row the panel could ever
produce, and *the engine reports one session* is a different claim from *the
engine reports nothing*. The count that is genuinely measurable travels as
`activeConnections` on the overview instead, where it is a number rather than a
session record.

Withholding follows through the rest of the toolkit. Maintenance offers `vacuum`
and `analyze` per table and globally, and `optimize` globally only, mapped onto
`CHECKPOINT`. `REINDEX` is a parser error on 1.5.5 and `PRAGMA integrity_check`
does not exist, so both are withheld rather than offered and failed. `kill` is
withheld for the reason above: there is no session to kill. The maintenance
toolkit and the audit trail are admin-only in any case.

## Where per-table bytes come from

`duckdb_tables()` publishes an `estimated_size` column, and it is the trap. It is a
row count, not a byte size — against tables of 5, 7 and 2 rows it answered 5, 7 and
2. Labelling that column "size" would put three-byte tables on the storage panel.
It is not published as the row count either, because it is an estimate: after
deleting from a 20,000,000-row table it answered 1,076,480 where `count(*)` answered
1,000,000, and a `CHECKPOINT` left it there. The object tree counts with `count(*)`,
which DuckDB serves out of row-group metadata.

The one real per-table byte figure is derived rather than published:

```sql
SELECT COUNT(DISTINCT block_id)
FROM pragma_storage_info('<table>')
WHERE persistent AND block_id >= 0;
```

Multiply that by `block_size` and you have the table's bytes on disk. There is no
index equivalent: `duckdb_indexes()` has no size column and `pragma_storage_info()`
reports only the table's own blocks, so index size is reported absent rather than as
zero.

## Why a one-row table reports 256 KiB

`block_size` on the fixture was 262144. A table occupying one persistent block
therefore reports 262144 bytes, which is 256 KiB, whether it holds one row or
enough rows to fill the block. Per-table bytes on DuckDB are a block-granular
derivation, and a one-row table reports 256 KiB.

Reading it as *this table wastes a quarter of a megabyte* is the wrong conclusion.
The figure answers how much of the file the table has been allocated, which is the
question a storage panel is actually for. It does not answer how many bytes the
values occupy, and the panel is not built to look like it does.

## Absent rather than zero, and why that rule holds here

The block query returns undefined, not 0, when there is no persistent block to
count. Two ordinary situations produce that: an `:memory:` database, which has no
file to allocate blocks in, and a table whose rows are still in the write-ahead log
and have not been checkpointed into the file yet.

A zero in that cell would read as *this table is empty*, which is a statement about
the reader's data and would be false in both cases. An absent cell reads as *this
was not measured*, which is what happened. The same rule runs through the whole
surface — a zero on a size panel is a claim, and the provider will not make one it
cannot support.

This is the same rule that decides what appears anywhere else in the product: the
[capability declarations behind each feature](/features) are data, and the
[per-engine pages](/databases) publish what each engine deliberately cannot answer
next to what it can. On DuckDB that comes to two panels that will never carry a
row, each naming the table function the engine does not publish, and a per-table
byte figure presented as the allocation it measures rather than as the size of the
values.
