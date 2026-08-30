---
title: Writing SQL++ that starts with the document key
status: published
author:
  name: LibreDB
  picture: ''
slug: couchbase-sqlpp-document-key
description: Selecting everything nests the document and drops the key, so generated statements project it explicitly, and that alias is why cell editing is switched off.
coverImage: ''
tags:
  - value: engineering
    label: Engineering
  - value: databases
    label: Databases
publishedAt: 2026-07-06T09:00:00.000Z
---

Open a Couchbase collection, look at the rows, and try to find the document you
just read. If the statement was `SELECT *`, it is not there. The identifier is
not a column that got scrolled off the right edge; it was never in the result at
all. That missing column decides three other things: the statement the editor
writes for you, the name the schema tree gives the key, and one control the
results grid does not offer.

## What selecting everything actually returns

`SELECT * FROM hotel` does not return the document's fields at the top level. It
returns them nested under the keyspace name:

```json
[{ "hotel": { "city": "Bursa", "name": "..." } }]
```

Two things went wrong in one row. The fields are one level deeper than a grid
wants them, and the document key is absent, because the key lives in the
document's metadata rather than in its body. In SQL++ that metadata is reached
through `META()`, and a wildcard does not reach it.

The nesting has a second consequence inside the transport. The Query Service
returns a `signature` describing the result's shape, and for a wildcard that
signature says nothing useful, so columns have to be derived from the rows
themselves - the union of the keys they carry, first seen first. A hand-written
`SELECT *` still runs and still renders. It just costs you the key and gives the
grid no declared column list to work from.

## Projecting the key, and naming it once

So generated statements do not use a wildcard. Clicking a collection in the
schema explorer emits this, from `src/lib/query-generators.ts`:

```sql
SELECT META(d).id AS __id, d.* FROM `travel`.`inventory`.`hotel` AS d LIMIT 50;
```

Three decisions are packed into that one line. The keyspace gets an alias, `d`,
so `d.*` flattens the document to the top level instead of nesting it. `META(d).id`
projects the key as a real column. And the alias for that column is `__id`, which
is not an arbitrary choice: it is the constant `COUCHBASE_DOCUMENT_KEY_COLUMN` in
the introspection module, the same constant the schema tree uses when it turns
the `~meta` pseudo-property that `INFER` reports into a leading column marked
primary.

That is the point of naming it once. Column metadata here comes from
`INFER <keyspace> WITH {"sample_size": 100}`, run per collection, four at a time
with a five-second server-side timeout each. `INFER` returns one row per document
shape it found, and all of those flavours are unioned rather than taking the
first, so a field present in only some shapes still appears - marked nullable,
because its `%docs` is below 100. The key arrives through that same path as
`~meta.id`. If the schema tree called it `id` and the grid called it `__id`, the
same value would carry two names in two panels of the same screen. It carries one.

The backticks are not decoration either. `bucket` and `scope` are reserved words
in SQL++, and an unquoted projection over `system:keyspaces` fails with error
3000, verified on Server 8.0.2. Quoting is also a security boundary here: SQL++
has no bind parameter for an identifier, so keyspace paths are assembled by
concatenation and `quoteIdentifier()` doubles any embedded backtick, so an
identifier cannot terminate its own quoting.

## Why the grid offers no editable cell here

Now the cost. **Inline row editing is not offered on Couchbase, and the reason is
the alias above.** The obstacle is not that SQL++ lacks an update statement - it
has `UPDATE <keyspace> SET ... WHERE ...`. The obstacle is that the shared
editor's primary-key heuristic reads the result's key column and builds
`WHERE <pk> = <value>` from it. On this engine that column is `__id`, a
projection alias no document actually contains. The generated predicate would be
`WHERE __id = 'hotel::1'`, which matches zero documents, and an `UPDATE` that
matches zero documents does not fail. It reports success. A user would edit a
cell, see the write confirmed, refresh, and find the old value.

That failure mode - silent, confirmed, wrong - is worse than a missing button,
so the capability is declared `supportsInlineRowEdit: false` and the control is
absent rather than offered and then quietly useless. Addressing a document needs
`META(d).id` or `USE KEYS`, which is per-dialect statement building rather than
a shared template. Until that exists, a document is edited with a hand-written
SQL++ statement. The same rule governs every other absent control across
[the capability surface](/features): a control that cannot work on the connected
engine is absent rather than present and broken.

Knowing the key also buys you something. `USE KEYS` reads a document with no
index at all:

```sql
SELECT META(d).id AS __id, d.* FROM `travel`.`inventory`.`hotel` AS d
USE KEYS ["hotel::1"];
```

That succeeds on a keyspace with no index whatsoever. What still needs an index
is discovering keys you do not already know.

## Read-your-own-writes, and what it costs

There is a second default worth stating with its price. The Query Service ships
`scan_consistency: not_bounded`, which reads the index in whatever state it
happens to be in. Verified against Couchbase Server 8.0.2: immediately after an
`INSERT`, a `SELECT` returned zero rows while `COUNT(*)` already returned three,
and the same `SELECT` returned three rows seconds later.

For an interactive editor that is not a trade-off, it is a bug report waiting to
be filed. So every statement goes out with `scan_consistency: "request_plus"`.

The cost is real and it is latency. `request_plus` makes the query wait for the
index to catch up with the mutations issued before it, so on a write-heavy
cluster every statement in the editor waits on an index that is being pushed
hard. Correctness in an editor is worth more than those milliseconds, but the
price is not zero.

## Opting out per statement

Freshness is the default, not a rule. A caller that would rather have the latency
back sets the consistency for one statement:

```ts
await transport.query('SELECT ...', { scanConsistency: 'not_bounded' });
```

That is the whole opt-out. It is per statement, so a monitoring read or a
throwaway count can be cheap without changing what the editor does when you press
Run.

A document store keeps identity in metadata rather than in a column, and an index
has to catch up with a write before a scan can see it. The other boundaries those
two facts produce here - no transactions over stateless HTTP, no foreign keys to
draw an ER diagram from, EXPLAIN without an analyze mode - are listed on
[the Couchbase entry in the engine grid](/databases). Agent AUTO mode is a
separate absence: an auto run ends engine-unsupported on Couchbase, because the
read-only profile it needs is database-native and exists only on PostgreSQL,
SQLite and DuckDB. Plan mode opens here, drafts statements and runs none of
them.
