---
title: What a plan-mode model is told about a LibreDB file
status: published
author:
  name: LibreDB
  picture: ''
slug: libredb-agent-plan-derived-namespaces
description: The grounding read is bounded by the provider itself, and the plan rules say outright that the rows are groupings derived from one scan.
coverImage: ''
tags:
  - value: engineering
    label: Engineering
  - value: databases
    label: Databases
  - value: security
    label: Security
publishedAt: 2026-01-07T09:00:00.000Z
---

The way to mislead a model pointed at an embedded key-value database is to hand
it a table list. Open a `.libredb` connection in Studio and the sidebar shows rows
called `users:*`, `articles:*`, `config:*`. They look like objects the engine
declares. They are not. They are groupings this server derived by scanning the
keyspace once and cutting each key at its first colon.

So a plan run on this engine gets two things before the model's first turn: a
reading of the schema, and a sentence saying what that reading is worth.

## Why AUTO mode does not open on this engine

Agent AUTO mode - the metered run that holds tools and executes statements of its
own - does not open here at all.

The reason is not a policy list. A profiled acquisition is refused unless the
provider exposes `queryReadOnly`, and that method exists on exactly three
providers: `providers/sql/postgres.ts`, `providers/sql/sqlite.ts` and
`providers/sql/duckdb/`. `AGENT_EXECUTION_ENGINES` is `['postgres','sqlite','duckdb']`.
The read-only guarantee is database-native on those three - a read-only
transaction, `PRAGMA query_only`, a `READ_ONLY` handle - and the LibreDB provider
implements no such method. Grep for `queryReadOnly` under the LibreDB provider
and there is no hit. **An agent AUTO run on a LibreDB connection ends
`engine-unsupported`.** That is the whole story of AUTO mode on this engine, and
it is the same sentence the [feature pages](/features) publish for every engine
outside those three.

PLAN mode is a different thing and opens on every connection, this one included.
It is toolless. It executes nothing. It reads context, then drafts a statement
and hands it to a person. Nothing it produces reaches the driver unless someone
types Run.

The two are easy to blur. AUTO does not open here. PLAN does, and it is
grounded.

## What the grounding read covers, and its bound

Since 2026-08-15 the server reads the connection's schema through the provider
before the model's first turn, so a plan run is not guessing at names. The read
is bounded, and the bound is the provider's own: MongoDB stops at 200
collections, Redis scans 1000 keys, LibreDB 10000.

On this engine that number is `LIBREDB_MAX_KEY_SCAN`, and the scan is one
half-open range over the entire keyspace:

```ts
kv.range('', '\u{10FFFF}')   // stops after 10000 keys
```

Each key is cut before its first `:` and the piece becomes a group named
`user:*`; a key with no colon becomes a single-key group under its own name. Keys
in the reserved internal namespace are skipped through the package's own
`isReservedKey` predicate, so the catalog's own bookkeeping never reaches the
model as a pseudo-table. Where the file carries a catalog entry for a namespace,
the group is upgraded to a faithful view: a relational namespace shows its real
declared columns with the primary key marked, a document namespace shows generic
`id` and `document` columns, and an uncataloged raw-kv namespace shows `key` and
`value`.

The bound is not decoration. Prefix groups that appear only past the ten-thousandth
key are not in the reading, and the per-group counts are capped with it. The
monitoring Tables panel refuses outright above the cap with
`LIBREDB_TABLE_STATS_TRUNCATED` rather than publish counts short by an unknown
amount. The plan run's inventory takes the other route - it keeps the namespaces
the scan reached and says so in words, because a list of namespaces is not a
count.

One more thing had to be true before any of this worked. `lib.open({ path })`
takes an exclusive `<path>.lock` sidecar, so a `.libredb` file admits exactly one
handle and a second open throws `LOCKED`. The grounding read used to be a second
open, and it lost: a `ConnectionError` becomes an *unavailable* capture rather
than a failure, so every plan run on a LibreDB connection was silently ungrounded
from the moment anyone browsed the connection in the sidebar. The capture now
calls `findOpenSingleWriterProvider` first and borrows the live handle, keyed by
resolved file path rather than connection id. Two bounds keep the isolation
invariant: only `agent-operations` borrows, since it sends no statement of the
model's, and no borrow happens for a connection that configures an `agentUser`,
because a reuse cannot substitute one principal for another.

## Telling the model what its inventory is

A grounded list of `users:*` and `articles:*` is still a trap if the model reads
those rows as tables. So the capability that produced them is stated to it.

`tablesAreDerivedGroupings` is `true` on exactly two providers - Redis and
LibreDB - and where it is true the plan rules carry one sentence saying three
things: what the rows are (groupings this server derived from a bounded scan),
what a statement may name instead, and that the list is one reading's reach
rather than the database's contents. The plan prompt's noun for a LibreDB row is
**Key Prefix**, not table.

The second half of that sentence earns its place. Measured on 2026-08-22 in plan
mode against the embedded sample, objective *list every entry under the users
prefix and read one user by key*: the run was grounded - three prefixes captured,
`articles:*`, `config:*`, `users:*` - and drafted

```text
GET users:*
```

`dispatchCommand` gives `get` exactly one meaning, `kv.get(parts[1])`, an
exact-key lookup with no glob of any kind. That command answers zero rows and no
error, which on a key-value store reads as *nothing is stored there* rather than
as a mistake. So the plan contract now names all five verbs - `get`, `put`,
`delete`, `prefix`, `range` - and states that a key is matched exactly, with no
wildcard. Every entry under a `users:*` row is reached with `prefix users:`,
which is the same form the schema explorer emits when a person clicks that row.

## What the audit trail does and does not cover on this engine

The AUTO pipeline is often described as the safety story: every statement passes
a policy decision, an audit event and budget accounting before the driver is
touched. None of that applies here. **Because no agent statement ever executes on
this engine, the agent's audited execution pipeline never applies, and the
ordinary query history - admin-only, like every engine's - is the whole trail.**
Commands you run land in it the way any engine's statements do. There is no
LibreDB-specific agent audit path, and this site does not claim one.

That is a narrower guarantee than the AUTO engines carry, and it is narrower in a
specific direction: there is less to audit because there is less that runs. The
[security page](/security) publishes the same boundary from the other side.

Two absences reinforce it. `getActiveSessions()` refuses with
`LIBREDB_ACTIVE_SESSIONS_REFUSAL` - the file is opened inside this server's own
process, and the `<path>.lock` holds only `libredb-lock`, a pid, a hostname and a
nonce, with no user, statement or start time to build a session row from. And
`runMaintenance(type)` always throws, with `supportsMaintenance: false` and
`maintenanceOperations: []`. There is no maintenance surface for a drafted plan
to aim at.

## Who runs the drafted command

A person does. That is the entire handover, and on this engine it has no
alternative branch.

What the drafted command has to survive is the human step, so a few grammar
facts are worth carrying. `range` is half-open: `[start, end)`. A JSON value in a
`put` must be wrapped in single quotes, because the tokenizer treats bare double
quotes as token quoting and would strip them, storing invalid JSON:

```text
put user:3 '{"name":"Grace","age":45}'
```

There is no transaction verb in the grammar, so `supportsTransactions` is `false`
and no sandbox is offered around what you run. There is no `UPDATE ... SET`
either, so `supportsInlineRowEdit` is `false` and the results grid will not edit
a value back for you. What the UI does do is watch what you ran:
`schemaRefreshPattern` is `\b(put|delete)\b`, so a write refreshes the key
groupings the next reading will be built from.
