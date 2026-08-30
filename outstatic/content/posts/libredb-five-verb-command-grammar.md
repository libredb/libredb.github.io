---
title: Five verbs over an ordered keyspace, with a catalog on top
status: published
author:
  name: LibreDB
  picture: ''
slug: libredb-five-verb-command-grammar
description: The whole grammar is get, put, delete, prefix and range, and yet the tree still shows declared columns for the namespaces that have them.
coverImage: ''
tags:
  - value: engineering
    label: Engineering
  - value: databases
    label: Databases
publishedAt: 2026-04-11T09:00:00.000Z
---

A `.libredb` file is ordered key-value bytes on disk. There is no server, no wire
protocol and no port: the `@libredb/libredb` package opens the file in-process,
synchronously, and a connection is an absolute path in the `database` field. So the
commands you can type against it in the query editor are not a dialect of anything.
There are five of them, they are the entire language, and what follows is what an IDE
built for SQL does with a language that small.

## The grammar, all five verbs of it

The grammar in `docs/providers/libredb.md` section 5.1 is complete in one code block.

```text
get <key>
put <key> <value>
delete <key>
prefix <prefix>
range <start> <end>
```

Verb matching is case-insensitive. Arguments split on whitespace, and consecutive
whitespace outside quotes collapses, so `put key hello  world` stores `hello world`
with one space, not two. Quotes preserve whitespace inside a token, and an unmatched
quote is rejected immediately with a `QueryError`, as is an empty command. An unknown
verb raises the same error with the five supported verbs listed in the message, so
nothing has to be guessed.

Each verb has a fixed result shape, which is what lets a generic results grid render
the output of a store that has no rows:

| Command | Fields | Example row |
| --- | --- | --- |
| `get` (found) | `key`, `value` | `{ key: 'user:1', value: 'Ada' }` |
| `get` (missing) | `key`, `value` | zero rows |
| `put` | `changed` | `{ changed: 1 }` |
| `delete` | `changed` | `{ changed: 1 }`, or `0` if the key was absent |
| `prefix` | `key`, `value` | one row per matching key |
| `range` | `key`, `value` | one row per key in the interval |

Blank lines and lines that start with `#` are skipped, and the first remaining line
is the one that runs. That rule exists so the schema explorer's generated cheatsheet
is directly runnable: every line in it is a concrete command rather than a template
with placeholders, so selecting one line and running it works as written.

That list is the whole language, which means the two things missing from it are
missing on purpose. There is no explain and no transaction control here: the engine
publishes no plan and the command grammar has no transaction verb, so both are
withheld rather than offered and then failing. In practice that means
`supportsExplain` is `false` and the Explain button and tab are absent rather than
degraded into something that is not a plan, and the BEGIN/COMMIT/ROLLBACK trio and
the sandbox toggle are not offered on this connection. The kernel does expose a
`transact()` method for atomic multi-key writes; v1 does not surface it through the
grammar.

## Half-open ranges, stated once

`range` is half-open: `[start, end)`. The start key is included and the end key is
excluded.

This is the sentence that has to be read once and remembered, because the failure it
prevents is silent. `range user:1 user:2` returns `user:1` and not `user:2`. Nothing
errors. A grid with one row in it looks exactly like a correct answer, and a person
who assumed both ends were inclusive will conclude that `user:2` does not exist.

The convention is not only the editor's. The same interval reads the entire keyspace
for the schema tree: `kv.range('', '\u{10FFFF}')` covers everything because the upper
bound sits above every key rather than equal to the last one. Half-open intervals
compose - the end of one is the start of the next, no key counted twice and none
skipped - which is why the scan and the editor use the identical form.

## Writing a JSON value without breaking the tokenizer

A JSON value in a `put` must be wrapped in single quotes.

```text
put user:3 '{"name":"Grace","age":45}'
```

Not double quotes. The tokenizer treats a bare double quote as token quoting, the way
a shell does, and would strip the ones around the object - storing a string that is
no longer valid JSON, with no error, because a key-value store has no opinion about
what a value contains. The single-quote wrapper preserves the inner double quotes
verbatim. This is section 12.2 of the provider doc, and it is written down there for
the same reason it is written down here: the corruption is invisible until something
downstream tries to parse the value back.

Read it back and the value comes pretty-printed: `renderValue()` attempts
`JSON.parse` on every value string and, on success, re-serializes it at two-space
indentation for the grid, leaving non-JSON strings as-is. That is presentation and
nothing more. The value is still one opaque string, and the indentation does not make
it a typed column or make the object's fields addressable by a command.

## What the catalog adds to a key-value tree

Since `@libredb/libredb` 0.0.2 the file carries a persisted catalog, and `getSchema()`
reads it through `catalog(db)` rather than guessing from key names alone. What the
tree shows depends on what the catalog declares about each namespace:

| Kind | Columns shown |
| --- | --- |
| Relational, cataloged | the table's real declared columns and types, primary key marked `isPrimary`, `nullable: false` because v1 relational columns are required |
| Document, cataloged | generic `id` (string, primary) and `document` (object) - documents are schemaless, so there are no declared per-field columns |
| Uncataloged raw kv | `key` (string, primary) and `value` (string, nullable) |

So a relational namespace written through the `table()` lens shows its actual column
names, not a `key`/`value` pseudo-table. `TableSchema` has no dedicated kind field, so
the kind is signalled by the columns themselves. The reconciliation is plain: a
relational table stores rows under `<table>:<pk>`, the scan groups those as `N:*`, the
provider strips the trailing `:*` and looks `N` up in the registry, and a match
upgrades the group to its catalog-aware columns. A cataloged namespace with no rows
yet is still emitted, with `rowCount: 0`.

The catalog also shapes the generated `put` example: a JSON object built from a
relational table's declared columns, a small JSON object for a document collection,
a plain string for raw kv. It does not add a verb. The grammar is unchanged by the
catalog work - `get`, `put`, `delete`, `prefix` and `range` still operate on the raw
kv keyspace exactly as before. One behavioural refinement came with it: `prefix` and
`range` results now filter out keys in the reserved internal namespace, using the
package's own `isReservedKey` predicate rather than a hardcoded string, so a
full-keyspace `range` no longer returns catalog metadata alongside your data.

## Namespaces are still groupings from a bounded scan

The tree looks like a table list. It is not one, and the difference is published
rather than smoothed over.

The scan stops at `LIBREDB_MAX_KEY_SCAN`, which is 10,000 keys. A prefix group that
appears only past the cap does not show as a table, and the row counts are capped
with it. `tablesAreDerivedGroupings` is `true` on this provider - one of only two
engines that declare it - and where it is true, the agent's plan rules state in one
sentence that the rows are groupings this server derived from a bounded scan, and
that the list is one reading's reach rather than the database's contents. Plan mode
opens on a LibreDB connection and is grounded by exactly that read; Agent AUTO mode
does not run here at all, because it requires a database-native read-only profile
this provider does not implement, and a run ends `engine-unsupported`.

The same reasoning removes controls. `Profile Table` and `Generate Test Data` address
an object and insert rows into it, and a `users:*` row is not an object any command
can be given, so both are hidden rather than left to answer HTTP 400. Above the cap,
the monitoring Tables panel refuses with
`LIBREDB_TABLE_STATS_TRUNCATED` instead of publishing counts that are short by an
unknown amount - while the schema tree still lists the namespaces it reached, because
a list of namespaces is not a count.
