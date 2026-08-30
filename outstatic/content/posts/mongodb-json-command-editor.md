---
title: The MongoDB editor takes a JSON command, not shell syntax
status: published
author:
  name: LibreDB
  picture: ''
slug: mongodb-json-command-editor
description: A statement beginning db. cannot run here at all, and the two operations that look alike have very different default bounds on the result set.
coverImage: ''
tags:
  - value: engineering
    label: Engineering
  - value: databases
    label: Databases
publishedAt: 2026-07-04T09:00:00.000Z
---

Paste `db.orders.aggregate([{ $group: { _id: "$status", n: { $sum: 1 } } }])` into
the editor and nothing runs. That is correct MongoDB, and this editor cannot run
it: the MongoDB provider parses a JSON command object and nothing else. The
parser wants two keys, `collection` and `operation`, and a shell line offers
neither.

This is not a gap waiting to be closed by a translation layer. It is the whole
shape of the provider, and the same shape is what the confirmation gate reads
before a delete is allowed to run.

## Why the editor takes a command object

The MongoDB provider extends `BaseDatabaseProvider` directly rather than the SQL
base class, and it declares `queryLanguage: 'json'`. `query()` parses the string
as an MQL object and dispatches on `operation`. Eleven operations are supported:
`find`, `findOne`, `aggregate`, `count`, `distinct`, `insertOne`, `insertMany`,
`updateOne`, `updateMany`, `deleteOne`, `deleteMany`.

```json
{ "collection": "users", "operation": "find", "filter": { "age": { "$gt": 18 } }, "options": { "limit": 10 } }
```

A missing `collection` or `operation`, or a string that is not valid JSON, is a
`QueryError` that quotes the format it wanted. The engine row on the
[databases page](/databases) states the consequence flatly: no SQL translation
layer is faked, and queries here are MongoDB queries.

The cost of that decision is not hidden either. Because there is no
single-collection `UPDATE ... SET` for the results grid to emit, inline row
editing is not offered on MongoDB at all - `supportsInlineRowEdit: false`, and
the control is absent rather than present and broken.

The one place this rule is stated to a machine rather than a person is the
agent's plan contract, which carries the JSON envelope verbatim and names mongosh
as the excluded form. That sentence exists because a plan run on 2026-08-22
drafted `db.orders.aggregate([...])` - correct MongoDB, unrunnable here. Naming
what the language is did not survive contact with the model's prior; naming what
it is not did. Plan mode opens on a MongoDB connection and drafts statements for
a human to run. Agent AUTO mode does not run here at all: the read-only
execution profile is database-native and exists only on PostgreSQL, SQLite and
DuckDB, so an auto run on MongoDB ends `engine-unsupported`.

## find, aggregate, distinct and their real defaults

The envelope is uniform. What the envelope's `options` object means is not, and
this is the part that surprises people who have read the driver documentation.

| Operation | What `options` does |
| --- | --- |
| `find` | honours `projection`, `sort`, `skip`, `limit`; with no `limit`, capped at 100 documents |
| `findOne` | honours `projection` only; `sort`, `skip` and `limit` are silently ignored |
| `aggregate` | ignored entirely; no `limit` or `skip` reaches the cursor, and there is no default cap |
| `distinct` | ignored entirely; the field comes from a required top-level `field` key |

Two of those rows are the ones that bite. **A `find` is capped at 100 documents
when no explicit `limit` is given, while an `aggregate` has no cap at all. And
`findOne` honours only `projection`, silently ignoring `sort`, `skip` and
`limit` - they are not refused, they are dropped.**

That last one is worth a sentence of its own, because it fails quietly and
plausibly. This does not return the newest document:

```json
{ "collection": "events", "operation": "findOne", "options": { "sort": { "_id": -1 } } }
```

It returns whichever document the server hands back first, and there is no error
to tell you the sort was discarded. Use `find` with `sort` and `limit: 1` when
the order matters.

`distinct` has its own required key, and it is required on purpose. It reads its
field from the top-level `field`, the driver's own parameter name:

```json
{ "collection": "products", "operation": "distinct", "field": "category", "filter": { "active": true } }
```

A missing or non-string `field` is a `QueryError` that names the key it wanted.
It used to read the field from the first key of `options.projection` and fall
back to `_id`, which meant a query asking for categories answered 120 rows of
`_id` against a fixture of 120 products in five categories, measured on
2026-08-22. `options.projection` is not an alias for `field`. An error naming the
missing key is a better answer than a plausible wrong one.

## The pipeline that nothing bounds for you

`supportsExternalQueryLimiting` is `false` on this provider, and that flag is
load-bearing. On the SQL engines the query route can wrap a statement to bound
the result set. Here it cannot, so `prepareQuery()` returns the JSON unchanged
and injects nothing. `find` still gets its 100 because the cap lives inside the
`find` branch of `query()`. `aggregate` passes none of `options` to the cursor,
so the only thing that bounds a pipeline is a `$limit` stage you wrote yourself.

```json
{
  "collection": "orders",
  "operation": "aggregate",
  "pipeline": [
    { "$group": { "_id": "$status", "count": { "$sum": 1 } } },
    { "$sort": { "count": -1 } },
    { "$limit": 200 }
  ]
}
```

An unbounded `$unwind` over a large collection will do exactly what you asked
for, all of it, into a browser grid. There is also no `cancelQuery` on this
provider: a running operation can only be stopped through the maintenance
`killOp`, which needs the opid and the privileges, and the maintenance toolkit is
admin-only. Bounding the pipeline yourself is the mechanism, not a habit.

One related edge: the `unlimited` query option is ignored here. `prepareQuery()`
always returns `limit: options.limit || 100`, and the route computes
`hasMore = rows.length === prepared.limit` from that figure, so an "unlimited"
request can report a `hasMore` that is wrong.

## Which operations ask for confirmation, and how they are recognised

The execution confirmation gate is usually described in SQL terms - it is the
thing that asks before a `DELETE FROM` runs. On MongoDB it reads the same JSON
envelope the editor does, so it is one reader over one shape rather than a
second parser written for this engine.

It asks before running when the parsed document's `operation` is `deleteOne`,
`deleteMany`, `updateOne` or `updateMany`, and when an `aggregate` pipeline
carries a top-level `$out` or `$merge` stage - the two stages that write a
collection rather than return rows.

The interesting branch is the fourth one. A payload the reader cannot read as a
document with a string `operation` also asks for confirmation rather than staying
silent. A half-typed object asks. `db.users.deleteMany({})` asks - not because
the gate understands mongosh, but because it refuses to certify a payload it
could not parse. An unreadable statement is not a safe statement, and the gate
declines to say otherwise. The editor will still reject that line; the gate's
answer just does not depend on the editor rejecting it first.

## Reading values the driver hands back

Every returned document passes through a serializer on the way to the grid, and
it normalises four BSON types: `ObjectId` and `Decimal128` become strings, `Date`
becomes ISO-8601, and `Binary` becomes the placeholder `<Binary: N bytes>` rather
than raw bytes. Nested objects and arrays are walked recursively.

Only those four are special-cased. `Long`, `Timestamp`, `UUID`, `RegExp`, `Code`
and `DBRef` fall through as generic objects and render poorly. If a field is
coming back as an object you did not expect, that list is where to look first.

Writes return an acknowledgement summary rather than documents -
`insertedId`, `modifiedCount`, `deletedCount` - and `rowCount` is the row count
or, for a write, the affected count.

The field names you address in a filter come from a schema that was inferred, not
read from a catalog. `getSchema()` samples the first 100 documents per
collection, expands subdocuments to dotted paths three levels deep, leaves arrays
named and closed, and caps the list at 200 fields per collection. A field that
appears only outside that sample does not appear in the tree. That is a different
kind of knowledge from an `information_schema` read, and writing a filter against
it deserves the same suspicion you would give any sample.
