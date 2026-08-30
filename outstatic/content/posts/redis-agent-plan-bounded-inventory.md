---
title: Telling a plan-mode model what its Redis inventory really is
status: published
author:
  name: LibreDB
  picture: ''
slug: redis-agent-plan-bounded-inventory
description: Because the rows are groupings from a bounded scan, the plan rules carry a sentence saying so, what a command may name instead, and how far the list reaches.
coverImage: ''
tags:
  - value: engineering
    label: Engineering
  - value: databases
    label: Databases
  - value: security
    label: Security
publishedAt: 2026-02-20T09:00:00.000Z
---

A plan run against a seeded local Redis read seventeen real key prefixes through the
provider, was shown them under a heading that called them tables, and drafted
`KEYS user:*`. The grounding worked. The noun was wrong, and the model read the
sentence it was given correctly. On a key-value store the inventory a plan run is
handed is not a list of keys; it is a summary this server computed.

## What grounding means on a key-value store

Before a plan run's first turn, the server reads the connection's schema through the
provider and writes it into the prompt. On PostgreSQL that is catalog reads plus a
statistics read. On Redis it is one call, because there are no statistics this run
knows how to read here, and it comes out of the same per-run statement budget and is
audited the same way as every other read.

What that call returns is built by `getSchema()`, and every step of it is a decision
rather than a lookup. Discovery uses cursor-based `SCAN` with `COUNT 100`, never
`KEYS *`, because `KEYS *` is O(N) and blocks the whole server. Each key found is
grouped by everything before its first colon plus `:*`, so `user:123` and `user:456`
collapse into one row named `user:*`. Each group is probed with `TYPE` until three
distinct value types have been observed. The result is sorted by descending key count
and emitted as one synthetic table schema per prefix, each with three columns: `key`,
`value` and `type`. Indexes are always empty, and table statistics return an empty
list, because Redis has neither.

None of that came off the server as an object. Redis has no schema to read. The row
`user:*` exists because this code made it.

## The sentence the plan rules add, and why

Two things were wrong in that first run, and they sit on different axes. Both are
driven by what the provider declares, not by a check on the connection's type.

The first is the noun. This product records every schema in one shape, `TableSchema`,
and the prompts had been using that shape's name as a word. `ProviderLabels.entityName`
has carried the right word all along - "Table" on the SQL engines, "Collection" on
MongoDB, "Datasource" on Druid, "Key Pattern" on Redis - and only the browser was
being shown it. The fenced inventory header now takes it, so a Redis run reads
"17 key pattern(s)".

The second is that a noun alone still does not tell a model that a key pattern is not
addressable. No fact about Redis could, either, because the grouping is not Redis's.
So the capability `tablesAreDerivedGroupings` carries it. It is `true` on Redis and on
the embedded LibreDB store and nowhere else, and where it is true the plan rules carry
one extra sentence. That sentence says three things: the rows are groupings this
server derived from a bounded scan, a statement may instead name a whole key or a
pattern scan in whatever form the engine offers, and the list is one reading's reach
rather than the database's contents.

What the sentence deliberately does not contain is any command, any command name, or a
prohibition on one. A rule reading "never use KEYS" would be engine trivia in a
prompt. It goes stale, it teaches nothing about the next command, and a run that knows
what the rows are can choose for itself.

## Prefixes are one reading's reach, not the database contents

The bound is a number in the source: `maxScan = 1000`, and the scan loop stops when
the cursor comes back to `0` or when a thousand keys have been seen, whichever happens
first. A prefix whose keys all live beyond that cap does not appear in the inventory at
all. The provider doc calls that a deliberate bound rather than a bug, and the plan
rules repeat it in words to the model, because the failure mode of an unstated bound
is a model that treats the list as exhaustive and reports an absence it never measured.

The same bound explains a discrepancy a person can see in the browser. The schema
tree's key count for a prefix comes from `getSchema()`, which loops the cursor over up
to a thousand keys. The Scan Keys action emits `SCAN 0 MATCH user:* COUNT 50`, which is
one cursor iteration, not a listing. An iteration can legitimately return a non-zero
cursor and no keys, so the panel can show a cursor and nothing else while the tree says
the prefix has keys. Neither number is wrong. They have different denominators.

## What the model is asked to name instead

A plan run's deliverable is one runnable statement in a single fenced block tagged with
the connection's canonical type id, with the rationale after the block and no name in
it that is not in the inventory. On an engine whose query language is `json` the
wording changes and the tag does not: the run is asked for one statement or command in
the engine's own language and told the engine speaks no SQL.

The shape of that command is its own constraint here. `executeRedisCommand` reads the
whole body as one command, so a plan run on 2026-08-22 that drafted

```text
1) KEYS session:*
2) GET session:1
```

produced `ERR unknown command '1)'` when someone ran it. The provider's
`statementLanguage` label now names the two things that made it unrunnable, the list
numbering and the second command, alongside the two accepted forms: a plain command,
and the lossless JSON command object `{"command": ..., "args": [...]}`.

The same withholding runs through the schema explorer, for the same reason and without
the agent involved. `Profile Table` and `Generate Test Data` are hidden wherever
`tablesAreDerivedGroupings` is true rather than left to answer HTTP 400, and Redis
offers no per-row maintenance action at all. `Generate Code` stays, because it names
the row rather than addressing it. A run that cannot answer from the inventory has a
second legitimate ending: a line beginning `NO STATEMENT:` that says what is missing
and asks the one question that would unblock it.

## Who runs the command that comes out

Nobody in this loop does. Agent AUTO mode - the tool-using run - does not open on
Redis at all. The read-only profile that mode depends on is database-native,
and `queryReadOnly` exists on the PostgreSQL, SQLite and DuckDB providers only. It
appears nowhere in `redis.ts`, so a Redis agent run ends `engine-unsupported`. Plan
mode opens on every connection instead, and it is toolless: it executes nothing, and
its inventory is that bounded thousand-key scan whose rows are derived groupings rather
than objects a command can be given. Those are two different modes, and the distinction
is published on the [features page](/features).

That leaves a person holding a drafted command. Two things meet them there. The
provider has no read-only guard - the generic `call()` dispatch executes `SET`, `DEL`
and `FLUSHALL` exactly as it executes `GET`, and access control is expected to come
from the Redis ACL, which is what the connection dialog's Username field selects. And
the execution confirmation gate reads the buffer the same way the provider does,
dropping comment lines and taking the first block, then asks before running anything in
its destructive vocabulary. A body it cannot parse asks rather than staying silent.

The drafted statement is also recorded, as a `plan-statement-drafted` event carrying
the command, the dialect, whether it is read-only and what the identifier check found.
The audit trail is admin-only, which is stated with the rest of the boundaries on the
[security page](/security). A plan run leaves a record of what it proposed. What
happened next is on the person who pressed Run.
