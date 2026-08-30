---
title: Plan mode on MongoDB, where the safety checks decline
status: published
author:
  name: LibreDB
  picture: ''
slug: mongodb-agent-plan-declining-checks
description: The read-only guard and the identifier reader are SQL readers, so on a MongoDB draft they record that they do not apply instead of passing it.
coverImage: ''
tags:
  - value: engineering
    label: Engineering
  - value: databases
    label: Databases
  - value: security
    label: Security
publishedAt: 2025-12-29T09:00:00.000Z
---

A check that cannot read the language it is handed has two options. It can
return a green tick, or it can say it did not look. On a MongoDB connection,
LibreDB Studio's plan mode takes the second one.

Agent AUTO mode — the tool-using, metered run that executes statements itself
— does not run on MongoDB. The read-only execution profile it needs is
database-native, and a provider-native `queryReadOnly` exists only on
PostgreSQL, SQLite and DuckDB, so an auto run on a MongoDB connection ends
`engine-unsupported`. Plan mode opens on every connection, including this one.
It is toolless, it executes nothing, and it drafts one statement for a person
to run.

That much is the same on every engine. What is different here is the two
checks that run after the draft is written: the read-only guard and the
identifier reader are both SQL readers, so on a MongoDB draft both record that
they do not apply rather than passing it.

## What plan mode reads before its first turn

Before the first turn the server grounds the run, and on a document engine
that grounding goes through `db.schema.read` — an operation descriptor whose
entire input is empty. It acquires `agent-operations`, calls this connection's
own `provider.getSchema()`, and returns structure. It is the inspection the
sidebar performs when it lists your collections, taken through
`runAuditedAgentCall`, so it meets the same mode check, deadline, budget
clamp, audit record and artifact as any other agent read. There is no second,
unaudited path to the database.

What comes back is inferred, not read from a catalog. `getSchema()` lists
collections, skipping `system.*` and capping at 200, and for each one samples
the first 100 documents to derive field types. Subdocuments expand to dotted
paths to a depth of three, so `shipping`, `shipping.city` and
`shipping.geo.lat` are all named and `shipping.geo.deep.tooFar` is not. Arrays
are named and left closed, because `items.sku` addresses one value per array
entry and does not mean there what it means on a subdocument. The field list
caps at 200 fields per collection.

So the inventory the model is grounded on is a description of a sample. The
preface says as much: the inventory is what the inspection found, not proof
that nothing else exists. A plan run on 2026-08-22 grouped by
`$shipping.region`, a path that database did not have, and MongoDB answers a
missing path with one null group rather than an error — the draft read as
runnable and was quietly wrong. That is why the depth-3 expansion names the
container at each boundary instead of stopping at `shipping: object`.

## Why the draft is a JSON command and not shell syntax

The provider extends `BaseDatabaseProvider` directly rather than the SQL base,
and its query language is `json`. A statement here is a command object with a
required `collection` and a required string `operation`, drawn from `find`,
`findOne`, `aggregate`, `count`, `distinct`, `insertOne`, `insertMany`,
`updateOne`, `updateMany`, `deleteOne` and `deleteMany`:

```json
{
  "collection": "orders",
  "operation": "aggregate",
  "pipeline": [{ "$group": { "_id": "$status", "count": { "$sum": 1 } } }]
}
```

The plan contract states that envelope to the model verbatim, and states the
negative with it: this is not mongosh shell syntax, and a statement that
starts with `db.` cannot be run here. The rule is there because a live plan
run on 2026-08-22 drafted `db.orders.aggregate([...])` — correct MongoDB, and
not something the editor can execute. Handing a user a statement the product
cannot run is a worse failure than refusing to draft one, because it looks
like success.

## The two post-checks, and why both decline on this engine

Two checks run on a drafted statement before it is offered anywhere. Neither
is more than it says it is.

**Identifiers.** Every table name the statement reads is compared against the
captured inventory and unknown names are recorded on the event. It is a
reader, not a parser: it prefers a miss to a false alarm, so an empty unknown
list means "nothing recognised was missing", never "the statement is sound".
It checks no columns. With no inventory it records `no-inventory`, because an
empty list would be a claim that every table exists.

**Read-only classification**, through the same statement guard the rest of the
[agent surface uses](/features). A statement that is not read-only is not
blocked — that was ruled on deliberately — but it is marked on the event and
visibly in the rail, so a hand-off never quietly gives someone a delete.

Both are SQL readers. Point them at a correct MongoDB draft and they are wrong
at once, in opposite directions. The guard reads every string as SQL:
`db.orders.aggregate([...])` leads with the word `DB`, which is not in its
read allowlist, so every correct MongoDB draft came back `NON_READ_STATEMENT`
— structurally, since no command of this engine can lead with `SELECT`,
`VALUES`, `TABLE` or `EXPLAIN`. The identifier half fails the other way: its
table reader finds no table keyword, answers with an empty list, and the
affirmative branch then reports that every table the statement names is in the
inventory. That is a vacuous claim about names nothing looked at, and it is
the more dangerous of the two, because it reads as a pass.

So `validatePlanStatement` takes the language into account and writes down
what actually happened. `guardApplicable: false`, with no violation recorded,
because there was no objection. `readOnly: false`, because a guard that read
nothing has vouched for nothing. And `identifiers: { kind: "not-applicable" }`
— its own variant, distinct from `no-inventory`, because an inventory usually
was read on this path and what is missing is a reader, not a reading.

## Reading a rail that blames the check rather than the draft

Three surfaces render that state: the timeline headline and its detail, the
statement card, and the accessible name of the control that applies a draft to
the editor. All three read the not-applicable state first and word it against
the check's reach, not against the statement. "We did not verify this" and
"this failed verification" call for different actions from the person reading,
and a rail that collapses them trains people to ignore it.

One more sentence belongs on the same card, on every engine: a statement
validated against the inventory is still not a statement that will run. The
inventory records what exists in this database, not what your role is
permitted to read.

## What is left for the person who runs it

What you still get: collection and field names captured from this connection
at the start of the run rather than from the model's memory of MongoDB in
general; a statement in the envelope the editor actually parses; an audited
record of the read that grounded it; and a run that ran no statement of yours
and wrote nothing.

What you do not get, and must supply yourself:

| Check | On PostgreSQL or SQLite | On MongoDB |
| --- | --- | --- |
| Read-only classification | Guard runs; writes are marked | Declines: `guardApplicable: false`, `readOnly: false` |
| Identifier check | Names compared to inventory | `not-applicable`; no reader for this language |
| Execution | Auto mode may run it under a read-only profile | Auto mode ends `engine-unsupported` |

Read the operation key first, because that is where the destructiveness lives.
The execution confirmation gate reads the same JSON shape and treats
`deleteOne`, `deleteMany`, `updateOne`, `updateMany` and top-level `$out` or
`$merge` aggregate stages as destructive, so those ask before they run,
exactly as a `DELETE FROM` does on a SQL engine. A payload it cannot read as a
document with a string `operation` asks as well, rather than staying silent.
That gate is a runtime control on your own execution, not a verdict on the
draft; the [published boundaries](/security) say what it does not cover.

Then check the result size, because the provider's defaults are asymmetric. A
`find` with no explicit `options.limit` is capped at 100 documents. An
`aggregate` passes none of `options` to the cursor and has no default cap, so
a pipeline with no `$limit` stage can return an unbounded result set. A
drafted pipeline is exactly the shape where that bites.

A check that reports its own reach is one you can plan around. A check that
returns a tick it did not earn is one you find out about later, holding a
result you believed twice.
