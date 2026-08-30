---
title: A user star row in the Redis tree is not an object
status: published
author:
  name: LibreDB
  picture: ''
slug: redis-key-prefixes-derived-groupings
description: Prefix groups come from a bounded cursor scan, so several per-row actions are hidden rather than offered against something no command can address.
coverImage: ''
tags:
  - value: engineering
    label: Engineering
  - value: databases
    label: Databases
publishedAt: 2026-05-26T09:00:00.000Z
---

Open a Redis connection and the schema tree fills with rows that look like tables:
`user:*`, `session:*`, `queue:*`, each with a key count beside it. They are not tables.
A Redis key prefix browser has to scan keys rather than list them, and what comes back
is a summary computed from the slice the scan reached. Right-click one of those rows
and the menu is shorter than it is on PostgreSQL. That is the same fact, showing up
where you can see it.

## How the Redis key prefix browser builds a row

`getSchema()` walks the keyspace with a cursor and groups the real key names it finds.
The grouping rule is one line long: take everything before the first `:` and append
`:*`. So `user:123` and `user:456` collapse into `user:*`. A key with no colon in it is
its own group.

For each group the provider probes keys with `TYPE` until it has observed up to three
distinct value types, and those sampled types are what the synthetic column metadata is
built from. It may inspect more than three keys when they all share a type. The finished list is sorted by
descending key count, so the busiest prefixes are at the top.

Each of those synthetic rows carries three columns - `key`, `value` and `type` - and
nothing else. `indexes` is always empty, and both `getTableStats()` and
`getIndexStats()` return `[]`, because Redis has no indexes and no table statistics to
report. There is nothing there to hide.

Two things follow immediately. The grouping is a convention the provider applies, not
something Redis declares: nobody told Redis that `user:123` belongs to a family.
And the row name `user:*` is a glob pattern, not a key. Sending `GET user:*` to Redis
reads a key literally named `user:*`, which almost certainly does not exist.

## Why the scan is cursored and capped

Schema discovery uses `SCAN` with `COUNT 100`, never `KEYS *`.

`KEYS *` is O(N) and blocks the whole server until it finishes. Redis is
single-threaded; on a production instance with millions of keys, one browser opening a
schema tree stops every other client. `SCAN` is incremental and non-blocking, and it
hands back a cursor you re-present on the next call.

Incremental is not the same as bounded, though. A cursor loop over a large keyspace
still runs that whole keyspace's worth of round-trips, and the type probe adds one more
round-trip per key until the third distinct type is observed - a uniform prefix pays
that for every key the scan reaches. So there is a second limit on top of the first:

```text
const maxScan = 1000;
while (cursor !== "0" && totalScanned < maxScan) { ... }
```

The loop stops when the cursor comes back `0` or when a thousand keys have been seen,
whichever happens first. On a small keyspace those are the same event. On a large one
they are not, and the second one wins.

## What the cap means for prefixes you cannot see

The tree comes from a cursor scan capped at 1000 keys, so prefixes that appear only
beyond the cap are not listed, and per-row actions are hidden because these rows are
groupings this server derived rather than addressable objects. That cap is a deliberate
bound, not a bug.

Concretely: a keyspace where one prefix holds far more keys than the scan budget and
another holds a handful can show you the crowded prefix and no row for the sparse one,
because the scan spent its budget before the cursor reached it. The key counts on the
rows it does show are counts within the scanned slice, not keyspace totals. `DBSIZE` on
the overview panel knows the real number; the tree does not, and does not claim to.

The editor is where you go instead. It runs any command through the driver's generic
dispatch, so `SCAN 0 MATCH audit:* COUNT 100`, re-run with each cursor the reply hands
back, reaches the prefix the tree omitted. The tree is one bounded reading of the
keyspace; the command line is not bounded by that cap.

## Actions that are hidden because the row is not addressable

The provider declares `tablesAreDerivedGroupings: true`. The interface reads that flag
and removes controls rather than letting them fail, which is the [capability rule the
interface follows](/features): a control that cannot work is absent, with its reason,
instead of present and broken.

Four schema-explorer actions are missing on Redis, all for one reason.

| Action | On Redis | Why |
| --- | --- | --- |
| Profile Table | hidden | Profiles an object; `user:*` is not one |
| Generate Test Data | hidden | Inserts rows into an object; there is nothing to insert into |
| Key Info | not offered | A per-row maintenance action needs an addressable row |
| Memory Doctor | not offered | Names no maintenance operation this provider declares |

The two maintenance items are the interesting pair. Both would need an addressable row
and there is none, but only one of them even names an operation this provider declares.
Redis declares a single maintenance type, `analyze`, which runs `INFO` and reports how
many lines came back; Memory Doctor names no declared operation at all. And `analyze` is
declared global-only: `runMaintenance` takes no target parameter, since `INFO` reports on
the server and cannot be pointed at a key prefix. `POST /api/db/maintenance` reads the
same declaration and answers 400 to a request carrying a target, so
`{type:"analyze", target:"session:"}` is refused. A row menu item that produced
server-wide numbers labelled as one prefix's numbers would have been worse than no item.

Generate Code stays, and the distinction is worth naming. It reads the row's name and
sanitises it into a legal identifier (`user:*` becomes `User`). It never sends the name
to Redis as an argument. Naming a row is fine; addressing it is not.

The same sentence travels into the agent layer. Plan mode opens on a Redis connection -
it is toolless and executes nothing - and its grounding rules carry one line saying the
inventory rows are groupings derived from a bounded scan, so a plan does not draft a
command against `user:*`. Agent AUTO mode does not run here at all: the read-only
profile is database-native and only PostgreSQL, SQLite and DuckDB implement it, so an
auto run on Redis ends `engine-unsupported`.

## Scan Keys is one iteration, not a listing

The row menu's Scan Keys action emits, for a prefix group, exactly this:

```text
SCAN 0 MATCH user:* COUNT 50
```

That is one cursor iteration. `0` is the start cursor and the reply's first row is the
next cursor; you re-run with that value in place of `0` until it comes back `0`. On a
large keyspace an iteration can legitimately return a non-zero cursor and no keys at
all. So Scan Keys can show you a cursor and nothing else while the tree above it says
the prefix has keys - the tree's count came from a loop over up to 1000 keys, and a
one-line command cannot loop. The cheatsheet that Generate Command inserts says so in a
comment above the command rather than leaving you to discover it.

For a bare key the same action is type-aware from the sampled type: `GET`, `HGETALL`,
`LRANGE`, `SMEMBERS` or `ZRANGE ... WITHSCORES`. When the sampled type is unknown or
mixed, it emits `TYPE <key>` instead of guessing, because a wrong reader -
`GET` against a hash - returns `WRONGTYPE` rather than an answer. Glob metacharacters
are escaped in the `MATCH` half of a `SCAN` and nowhere else, since a key argument
containing a literal `*` is a real key name.

The [engine page for Redis](/databases) states the top half of this before you connect:
no SQL, and none is pretended. The prefix rows are the bottom half - no tables either,
and the rows that stand in for them are labelled as the groupings they are.
