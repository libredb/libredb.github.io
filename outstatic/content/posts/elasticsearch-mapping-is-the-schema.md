---
title: The mapping is the schema, and selecting everything is not
status: published
author:
  name: LibreDB
  picture: ''
slug: elasticsearch-mapping-is-the-schema
description: An index that maps container fields answers a select-everything statement with no columns at all, so the schema tree is built from the mapping instead.
coverImage: ''
tags:
  - value: engineering
    label: Engineering
  - value: databases
    label: Databases
publishedAt: 2026-04-17T09:00:00.000Z
---

Point a schema tree at an index and the obvious way to learn its columns is to ask
the engine for them. Here that is the wrong way round. The Elasticsearch SQL schema
columns come from the index mapping, not from a statement, because a statement only
ever describes itself while the mapping describes the index. The provider reads
`GET /_cat/indices?format=json&bytes=b` for the indices and `GET /<index>/_mapping`
for the fields, and never builds a `SELECT` to find out what exists.

That decision was forced by a measurement.

## What a select-everything statement returns on a mapped index

Measured on Elasticsearch 9.1.4, against an index whose mapping declares one
`flattened` field and one `nested` field, `POST /_sql?format=json` answers a
select-everything statement like this:

```json
{ "columns": [], "rows": [[]] }
```

A table with no columns and one empty row. Nothing failed. The statement was
accepted, executed and answered; it is simply that the projection this grammar
expands does not include a container, so there was nothing left to declare. A tree
built from that answer would render the index as having no fields, which is a
fabricated schema and the worst of the available outcomes: it looks like data.

Two smaller traps sit next to it. A container is not merely skipped, it breaks the
whole statement - `SELECT address FROM probe_shapes` is HTTP 400,
`verification_exception`, "line 1:8: Cannot use field [address] type [object] only
its subfields", while `SELECT note, note.keyword, address.city` is HTTP 200 for all
three. And a trailing semicolon is a syntax error on this grammar
("extraneous input ';' expecting <EOF>"), which is why the generated Select Top 50
Documents statement ends at `LIMIT 50` and nothing further.

`DESCRIBE` would answer better than `SELECT *` does, but it is still a SQL surface,
and the availability of the SQL surface is the one thing an object browser must not
depend on. The mapping is readable on a closed index, measured. A statement is not.

## Where the columns come from: the mapping, flattened to dotted paths

The flattening rule is not invented. It is copied from this product's own
`DESCRIBE`, measured on a probe index holding an object field and a multi-field:

| field | SQL type | mapping type |
| --- | --- | --- |
| `address` | `STRUCT` | `object` |
| `address.city` | `VARCHAR` | `keyword` |
| `note` | `VARCHAR` | `text` |
| `note.keyword` | `VARCHAR` | `keyword` |

Containers appear, leaves appear, and a multi-field appears as a child. The
provider's flattener descends both `properties` (objects) and `fields`
(multi-fields) and reproduces exactly that set. Nothing outside `properties` is
read, because a mapping carries siblings such as `_meta` that are metadata about
the mapping rather than fields in it.

Then one subtraction. `object` and `nested` are dropped from the column list,
because the starter query enumerates every declared column and a container makes
the whole statement fail. A `text` field with a `keyword` sub-field is kept, since
both `SELECT note` and `SELECT note.keyword` answer 200 - so "has sub-fields" is
the wrong test and the field's own type is the right one.

Columns are sorted by path, by code unit. This engine happens to normalize mapping
properties alphabetically even for a dynamically mapped index, but that is its
normalization and not a promise, and a mapping has no declaration order to preserve
in the first place because documents are unordered JSON. Sorting by path also keeps
`address.city` beside its siblings once the container above it is gone.

The tree makes one mapping read per index, at most four at a time. A per-index
failure costs one index's columns rather than the tree, and only for two causes: a
permission refusal, because a security plugin grants index privileges per index and
a role that lists twenty indices and may describe nineteen is an ordinary
configuration, and a missing index, because an index deleted between the listing
and the mapping read is a race. Everything else propagates. An unreachable cluster
rendering every index with zero columns would read as "these indices have no
fields", which is the same fabricated schema in a different costume.

## Types in the mapping vocabulary, not SQL names

The result grid labels columns with the mapping's own type names. Measured,
`SELECT customer, total FROM probe_orders` declares `keyword` and `double`, not
`VARCHAR` and `DOUBLE`, and `SELECT note` declares `text`.

That is the same vocabulary the mapping read reports, so the tree and the grid
speak one language: the word beside a field in the sidebar is the word above the
column in the results. It is also the vocabulary the user wrote themselves, in the
document they actually edit, which is the mapping.

A column whose declaration carried no type name is left out of the type list rather
than given a placeholder. An invented type would be indistinguishable from one the
engine sent.

## Why no column is primary and every column is nullable

**No column is ever reported as primary and every column is nullable, because
nothing a mapping declares is unique.** Indexing the same document body twice
yields two documents. The only unique thing in an index is `_id`, which is
metadata rather than a mapped field and is not even selectable through this SQL
surface - measured,
`SELECT _id FROM probe_orders` answers `verification_exception`, "Unknown column
[_id], did you mean [id]?".

`nullable: true` is a measurement, not a hedge. A mapping declares how a field is
indexed *if* a document carries it. There is no `NOT NULL` in the model, and a
document indexed without `note` really does come back as null. A mapping's
`null_value` is the closest thing to a default and is not one: it is the term
substituted into the index so an explicit null becomes searchable, and it changes
no value any document carries.

The primary-key flag is worth stating plainly because of where it is read. It is
consumed as fact: completions append "(PK)" to the field name, the agent's schema
context puts " PK" into what a model reasons from, and schema diffing reports
"Primary key changed". A key invented in the introspector becomes a key the product
asserts, in a prompt, to a model that will then write a statement around it.

Foreign keys are always empty and the provider declares that it does not declare
them, so the empty list means "impossible here" rather than "none found". Secondary
indexes are always empty and the index count is zero and stays zero: every mapped
field is inverted-indexed as a property of being mapped, so there is no index object
to name.

## What the tree deliberately leaves out

Aliases and data streams are not listed in the sidebar, even though SQL statements
accept them. They come from `_alias` and `_data_stream`, and the transport seam
carries neither, so a perfectly queryable alias can be typed into the editor and
run while never appearing in the tree. That is a gap, stated rather than papered
over.

Dot-prefixed system indices are hidden by default. A closed index is kept, with its
row count and size omitted rather than zeroed, because the listing returns JSON
null for both while the mapping still answers in full - dropping the index would
report it as gone when it is merely closed.

One number reads differently from what the word suggests. An index whose mapping
has `nested` fields reports more documents in the monitoring panels than a
`SELECT COUNT(*)` returns in the editor, because every nested element is stored as
its own document.

None of this is a browser waiting for write support. This grammar has no `INSERT`,
`UPDATE`, `DELETE`, `CREATE TABLE` or `ALTER TABLE` - each one is HTTP 400 with the
parser listing everything it would have accepted - so inline row editing and the
create-table toggle are not offered rather than offered and failed, which is the
same rule that governs
[every capability this interface shows or hides](/features).

A grammar that cannot write is still not the guarantee agent auto mode asks for.
Auto mode runs only where the provider implements a database-native read-only
profile, which is PostgreSQL, SQLite and DuckDB and no other entry in the
[supported engine list](/databases); on this engine an auto run ends
engine-unsupported. Plan mode opens on the connection, is toolless, runs nothing,
and drafts a statement for a human to run.
