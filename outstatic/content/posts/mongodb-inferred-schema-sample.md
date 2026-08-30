---
title: The MongoDB field list is inferred from a hundred documents
status: published
author:
  name: LibreDB
  picture: ''
slug: mongodb-inferred-schema-sample
description: There is no catalog to read, so the sidebar samples each collection and states its own reach - three levels deep, arrays closed, two hundred fields.
coverImage: ''
tags:
  - value: engineering
    label: Engineering
  - value: databases
    label: Databases
publishedAt: 2026-05-20T09:00:00.000Z
---

Open a PostgreSQL connection and the field list under a table is a read: the tree
asks `information_schema` what the columns are and the answer is the definition
itself. Open a MongoDB connection and there is nothing equivalent to ask. A
collection has no declared shape, so the field list has to come from the
documents themselves rather than from metadata, and every field in the tree is a
summary of the documents that were read.

That difference matters at one specific moment: when a field you know exists is
not in the tree. On a relational engine that is a bug. Here it is usually a
reading, and telling the two apart means knowing how far the read went.

## Sampling documents, because there is no catalog to read

`getSchema()` on the MongoDB provider builds that list in two steps. It lists
collections with `listCollections()`, skipping `system.*` and stopping at 200.
Then, for each one, it reads the first 100 documents and derives field names and
types from what it finds.

The boundary is one sentence: **the schema is inferred from the first 100
documents per collection, expands subdocuments to a depth of three, leaves arrays
closed, caps at 200 fields per collection and lists at most 200 collections.**
Nothing in the tree is read from a definition, because there is no definition.
`_id` is marked primary; everything else is an observation.

Three consequences follow:

- A field that appears only in document 4,000 does not appear in the tree. The
  data is fine. The sample did not reach it.
- A collection numbered 201 in the listing is not shown at all.
- The read is not free. Each collection costs up to four serial round-trips - an
  `estimatedDocumentCount()`, a `collStats`, the 100-document sample and
  `indexes()` - across up to 200 collections, with no batching. On a large or
  remote cluster the schema panel can be slow, and that is the reason.

Views are sampled by exactly the same rule. MongoDB refuses `count`,
`listIndexes` and `collStats` on a view with `CommandNotSupportedOnView`, so a
view arrives with no row count, no size and an empty index list, but its fields
come from the same 100 documents any collection gets. Before those three calls
were guarded, a single view in the database aborted the entire schema read and
the user lost every collection, not just the view.

## Nesting is flattened into dotted paths, and it stops at three

A subdocument is not shown as one opaque `object` row. It is expanded into the
dotted paths MQL actually addresses, counting the top level as depth 1. So for a
document shaped like an order with a shipping block:

```json
{
  "_id": "...",
  "shipping": { "city": "Ankara", "geo": { "lat": 39.9, "deep": { "tooFar": 1 } } }
}
```

the tree lists `shipping`, `shipping.city` and `shipping.geo.lat`. It does not
list `shipping.geo.deep.tooFar`. The container at the boundary - `shipping.geo.deep`
- is still named, so the tree shows you that the nesting continues past where the
reading stopped rather than pretending the branch ends there.

The reason it expands at all, rather than stopping at `shipping: object`, is a
concrete failure. `shipping.city` is a field name in MQL. A schema that named only
`shipping` did not name it, and a plan-mode draft on 2026-08-22 grouped by
`$shipping.region` - a path the database does not have. MongoDB answers an unknown
path in `$group` with a single null group rather than an error, so the plan read as
runnable and was silently wrong. Depth 3 is where the expansion stops, and the
field cap below is what makes going further expensive.

## Arrays are named and left closed

An array field appears in the tree by name. Its elements are never descended into.
This is deliberate, and the reason is that dotted syntax does not mean the same
thing on both sides.

On a subdocument, `shipping.city` addresses one value in one document. On an array,
`items.sku` addresses one value *per array entry* - a set, not a scalar, with
different behaviour in a filter, a projection and a `$group`. Listing `items.sku`
in a flat field list next to `shipping.city`, in the same font, with the same type
label, would invite a reader to treat them as the same kind of path. So the array
is named, its type is reported, and the tree stops.

Date, ObjectId, Binary and Decimal128 are scalars for this purpose and are never
descended into either, even though they are objects in BSON.

## A field with two observed types is reported as both

Documents in one collection do not have to agree. When the sample shows `price` as
a number in some documents and a string in others, the type column reads
`mixed(number|string)` rather than picking a winner.

That reading is worth trusting in one direction and not the other. `mixed` is
evidence: two shapes really are in your data, within the first 100 documents, and
whatever reads that field downstream is going to meet both. A single type is
weaker evidence, because it is a statement about the sample. One hundred uniform
documents do not prove the hundred-thousandth agrees.

The 200-field cap interacts with this. It is applied after the sort, so what
survives is a deterministic prefix rather than an arbitrary 200, and `_id` always
survives. But nesting multiplies fast: 60 subdocuments of 10 fields each is 661
candidate rows for one collection, more than three times the cap, and every row
that survives is also a line in a plan-mode run's context window. A wide, deeply
nested collection can hit the cap on structure alone, before any variation is
considered.

## Plan mode opens here; auto mode does not

Agent AUTO mode - the tool-using, metered run - does not run on MongoDB. The
read-only execution profile it depends on is database-native and exists only on
PostgreSQL, SQLite and DuckDB, so an auto run here ends `engine-unsupported`. That
rule is published in the [feature limits](/features).

PLAN mode does open on a MongoDB connection. It is toolless, executes nothing, and
drafts a statement for a human to run. Its grounding is `getSchema()` - the same
inferred field list, bounded at the same 200 collections - so every bound in this
post is also a bound on what the model was told. A field outside the sample is a
field the draft does not know about.

Two things keep that from being worse than it sounds. The plan contract states
MongoDB's statement language verbatim, including what it is not: a JSON command
envelope, and explicitly not mongosh shell syntax, because a statement starting
with `db.` cannot be run in this editor at all. And on a MongoDB draft both
post-checks decline rather than judge - the read-only guard and the identifier
reader are SQL readers, so the run records `guardApplicable: false` and
`identifiers: not-applicable`, and the rail blames the check's reach rather than
awarding the draft a pass it never earned.

Which leaves the reader with the job of checking a draft's paths against the tree
before running it. A `$group` on a path the sample never saw is syntactically fine,
runs, and returns one null bucket. The tree cannot warn you about a field it did not
read; it can only tell you how far it read.
