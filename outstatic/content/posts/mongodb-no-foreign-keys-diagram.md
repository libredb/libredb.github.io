---
title: MongoDB has no constraint for a diagram to discover
status: published
author:
  name: LibreDB
  picture: ''
slug: mongodb-no-foreign-keys-diagram
description: The empty relation list here means impossible rather than none found, and the relationships a document model leaves for you to know live in the shape and in the pipeline.
coverImage: ''
tags:
  - value: engineering
    label: Engineering
  - value: databases
    label: Databases
publishedAt: 2026-07-31T09:00:00.000Z
---

Open the ER diagram on a MongoDB connection and you get boxes and no lines. The
question that follows is always the same one: did the read fail, or are there
really no relationships between the collections in this database? Neither.
The read succeeded, the relationships are almost certainly there, and the engine
has no place to record them.

## What a discovered diagram is discovered from

The diagram in LibreDB Studio is not drawn by hand and is not inferred. It is
discovered: `getSchema()` returns a `foreignKeys` list per table, and every edge
on the canvas is one entry from that list, laid out hierarchically by ELK.js.
That is the whole input. The [ER diagram feature](/features) publishes the
consequence next to the claim - a relationship your application enforces in code
but never declares in the schema has nothing to discover, and will not appear.

On a relational engine that list comes from the catalog. The constraint is a real
object the server created when someone wrote `REFERENCES`, and reading it is a
lookup, not an interpretation. The edge on the diagram is therefore a fact about
the database, with the same standing as the column list beside it.

MongoDB has no such object. `getSchema()` on this provider returns `foreignKeys:
[]` for every collection, always, and it is not a degraded read.

## Why this engine declares no keys at all

An empty list is ambiguous on its own. It can mean the read found nothing, the
read was refused, or the concept does not exist. Three different situations, one
value, and the reader downstream cannot tell them apart.

So the provider does not leave it to the list. `getCapabilities()` on the MongoDB
provider sets `declaresForeignKeys: false` beside `supportsExplain: false` and
`supportsInlineRowEdit: false`. That flag is the sentence the empty array cannot
say: MongoDB has no foreign key constraint at all, so `foreignKeys` is always
empty, the ER diagram has no declared edge to draw, and none is inferred. The
absence is the engine's model, not this database's shape.

**This is the limit, stated plainly: there are no edges on a MongoDB diagram,
there will not be any however the database is organised, and none is inferred
from the field names to fill the gap.** No schema change on your side turns them
on, because there is no constraint to add.

The flag is not decoration. It is what lets the interface distinguish an empty
panel from a broken one, which is the rule the whole [engine
matrix](/databases) is built on. Where a control cannot work, it is absent with
the reason written where it would have been, rather than offered and then failed.

## Inferring edges from names would be a guess

The tempting move is obvious. `orders` has a field called `customerId` holding an
ObjectId; `customers` has `_id` holding ObjectIds; draw the line. It reads as
helpful and it is available - the field list is already in hand.

Consider what that line would assert. On a relational diagram an edge means the
server refuses a row that breaks it. On an inferred MongoDB diagram the same
line, drawn the same way, on the same canvas, would mean a field name looked
like another field name. The two are rendered identically and the reader has no
way to tell which they are looking at.

The guess also has to be wrong sometimes, and the ways it goes wrong are the
ordinary ones:

- `userId` in an audit collection may hold an identifier from a different system
  entirely, which no collection here owns.
- A polymorphic reference - `ownerId` pointing at `users` in some documents and
  `teams` in others - is one field and two edges, and nothing in the field name
  says which.
- An embedded subdocument is a relationship with no reference at all. There is no
  field to match on, so the strongest relationship in the model produces no edge
  while a weaker one does.
- Two collections can share a naming convention and no relationship, which
  produces a confident line between things that were never joined.

There is no reading that separates these, because the information is not in the
database. It is in the application. A diagram that draws an edge from a name is
publishing a hypothesis in a place the reader has learned to treat as a
constraint, and that is worse than an empty canvas.

## What the collection tree gives you instead

The schema panel is not empty, and it is worth knowing exactly what it does
answer, because it is a different kind of read from a catalog lookup.

`getSchema()` lists collections - skipping `system.*`, capped at 200 - and for
each one samples the first 100 documents to derive field types. Views are listed
alongside collections; MongoDB refuses `count`, `listIndexes` and `collStats` on
a view, so a view arrives with its fields sampled but no row count, no size and
an empty index list, rather than aborting the read for everything else.

What the sample produces:

| Panel content | How it is derived |
| --- | --- |
| Field names and types | inferred from the first 100 documents |
| Nested fields | subdocuments expanded to dotted paths, to depth 3 |
| Arrays | named and left closed, never expanded |
| Mixed fields | reported as `mixed(a\|b)` when the sample saw more than one type |
| `_id` | marked primary |
| Indexes | `collection.indexes()`, with the unique flag and key fields |
| Foreign keys | always `[]` |

Two caveats travel with that. A field absent from the sample does not appear, and
the field list is capped at 200 per collection - which nesting reaches faster
than it sounds, since 60 subdocuments of 10 fields each is 661 rows for one
collection. The tree describes the documents that were sampled. It does not
describe the collection.

The index list is the closest thing here to a structural hint, and it is worth
reading as one. An index on `customerId` is evidence that something joins on
`customerId` often enough for someone to have paid for the index. That is a
person's decision recorded in the database, which is more than a name match, and
still not a constraint.

## Where the relationship actually lives

It lives in two places, and both are outside the engine.

The first is the document shape. A choice to embed line items inside an order, or
to keep them in their own collection and store an ObjectId, is a modelling
decision made once and enforced by the code that writes. The database accepts
either on any given document. Nothing stops one order from embedding and the next
from referencing.

The second is the query. On this provider you write the join as an aggregation
pipeline - `aggregate` is one of the supported operations, sent as a JSON command
object with the pipeline in it. The `$lookup` stage names both collections and
both fields explicitly, which means the relationship is stated at the moment it
is used, by the person using it.

```json
{
  "collection": "orders",
  "operation": "aggregate",
  "pipeline": [
    { "$lookup": { "from": "customers", "localField": "customerId",
                   "foreignField": "_id", "as": "customer" } },
    { "$limit": 50 }
  ]
}
```

Two things about that payload. It is a JSON command object, not mongosh: a
statement beginning `db.orders.aggregate(...)` is correct MongoDB and cannot run
here, because the provider parses the JSON envelope and nothing else. And the
`$limit` stage is doing real work - `aggregate` passes no options to the cursor
and has no default cap, so a pipeline without one can return an unbounded result
set. `find` is capped at 100 by default; `aggregate` is not.

So the diagram stays empty, and the join stays in the pipeline where someone
wrote it down.
