---
title: Four other servers behind one Redis connection
status: published
author:
  name: LibreDB
  picture: ''
slug: redis-compatible-servers-one-type-id
description: There is no separate connection type and no per-server branch, so the version panel shows the compatibility level a server publishes, not its product release.
coverImage: ''
tags:
  - value: engineering
    label: Engineering
  - value: databases
    label: Databases
publishedAt: 2026-04-08T09:00:00.000Z
---

To reach Valkey, DragonflyDB, KeyDB or Garnet you pick Redis in the connection
dialog, because there is no other entry to pick. That is the documented route,
not a workaround: `ioredis` speaks the protocol the whole family shares, and the
provider behind the `redis` type id is what a Valkey connection uses. The
overview panel then reports a Valkey 9.1.1 server's version as 7.2.4.

Neither of those is a bug. Both are the same decision, and it decides which
numbers on that screen you can trust.

## One connection type, four more servers

`src/lib/db/compatibility.ts` lists four Redis-protocol relatives at the `full`
tier, each against the version it was probed on: Valkey 9.1.1, DragonflyDB
df-v1.40.1, KeyDB 6.3.4 and Garnet 2.1.5. `full` there means every introspection
surface answered - and the tier definition in that same file says caveats may
still record data that is present but inaccurate, which is why a `full` engine
can carry them. There is no `valkey` type id, no `dragonfly` one, and no branch
anywhere in the provider that asks which of the five it is talking to.

So a DragonflyDB session and a Redis one run identical code. Schema discovery is
the same bounded `SCAN` with `COUNT 100`, capped at 1000 keys, that groups
`user:123` and `user:456` into a `user:*` row. The editor dispatches the same
generic `client.call()`. Monitoring reads the same `INFO`, `SLOWLOG GET 10` and
`CLIENT LIST`. Nothing renames the server and nothing reads a vendor-specific
field, because the alternative is asserting a product the server's own `INFO`
reply never claimed.

## Why the version shown is a compatibility number

`getOverview()` reads one field, `parsed.redis_version`, and passes it through as
the server gave it. That field is the only version line the whole family
publishes, which is exactly why it is the one that gets read - and exactly why
what it reports is a compatibility level rather than a release.

| Server (probed version) | `redis_version` in `INFO` | What the panel shows |
| --- | --- | --- |
| Valkey 9.1.1 | `7.2.4` | 7.2.4 |
| DragonflyDB df-v1.40.1 | `7.4.0` | 7.4.0 |
| KeyDB 6.3.4 | absent | indistinguishable from a Redis 6 server |
| Garnet 2.1.5 | `7.4.3` | 7.4.3 |

Valkey is the clean case: the server declares the Redis level it implements, the
panel repeats it, and the caveat is recorded in `compatibility.ts` beside the
entry rather than left for you to discover. KeyDB is the thin case - it
publishes no version field of its own, so there is nothing to distinguish its
overview from a Redis 6 server.

Garnet is the case where the choice is visible. Its `INFO` carries
`garnet_version:2.1.5` and `server_name:garnet` sitting right beside
`redis_version:7.4.3`, so the real product and release genuinely were available
and go unread. The branch that would read them stays unwritten for the reason
the provider gives everywhere else: the moment one field is special-cased, the
panel starts making a claim about the server's identity instead of reporting the
reply the server sent. The reading it gives now is narrow and consistent: this
is the compatibility level the server published.

## What each server publishes, and what it omits

The same read-it-as-given rule governs the session list, and there the
divergences are wider than one field. Every `CLIENT LIST` field is optional, and
`getActiveSessions()` substitutes a default for anything absent: user falls back
to `default`, pid to `0`, state to `N`, command to `idle`. A server that omits a
field therefore produces a plausible-looking row rather than an error.

- **DragonflyDB** fills `name` with the connection id, so the user column shows
  a number rather than reaching the `default` fallback at all. Its line carries
  no `cmd=` and no `flags=`, so every session reads `idle` and `N` whatever that
  session is doing.
- **KeyDB** reports a command without its subcommand - `cmd=client` where Redis
  and Valkey both send `cmd=client|list` - and the query column shows it
  verbatim.
- **Garnet** answers `CLIENT LIST` in full. Its session rows are complete and
  correct.

One field on that list is not a relative's quirk at all: the user column reads
`name`, not the `user` field Redis also publishes, and `name=` is empty until a
client calls `CLIENT SETNAME`. Every engine here shows `default`, Redis
included.

## Dashboard numbers that are absences wearing a value

`maxclients` is not universal. Redis, Valkey and KeyDB each publish
`maxclients:10000`. Neither DragonflyDB's nor Garnet's `INFO` carries the line,
so max connections reads 0 - an absent limit shown as a zero, not a measured
one.

Garnet is where that goes furthest, and this is the limit to carry away from the
post. On one of these servers three dashboard numbers are absences wearing a
value: no memory figure, so size reads zero bytes on a populated server, no hit
counters, so the cache ratio falls back to a full score, and a client count that
stays zero. In fields: Garnet publishes no `used_memory`, so database size and
the memory storage panel read `0 B` on a populated server; it publishes neither
`keyspace_hits` nor `keyspace_misses`, so the cache hit ratio takes the `: 100`
fallback the provider uses when there has been no traffic, and the dashboard
rates that a full score, Excellent; and `connected_clients` stays 0 with a
client attached, even though `CLIENT LIST` answers correctly, so the session
list below the counter is right while the counter above it is not.

None of those three is a failure the panel can see. A zero is a legal reading of
a metric that exists, and 100 percent is a legal hit ratio. The dashboard is
faithfully reporting a reply that does not contain the number it is asking for.

## When to trust a gauge on a compatible server

The rule that falls out of this is narrow and usable: trust the surfaces that
read a list, and check the surfaces that read a scalar.

The list-shaped reads carry their own evidence. `CLIENT LIST` produces one row
per client and you can count the rows. `SLOWLOG GET 10` produces entries or it
produces none. The key browser scans real key names and shows you what it found.
When those disagree with a counter, the list is the one that was measured.

The scalar reads - version, memory, hit ratio, client count, max connections -
come from single `INFO` fields, and a missing field is indistinguishable from a
zero once it reaches a gauge. The check takes one line in the editor: run `INFO`
and read the section yourself. `parseInfoResult()` renders the bulk reply as one
row per metric, each tagged with its `# Section` header, so an absent
`used_memory` is visibly absent rather than rounded to `0 B`. That is also what
the single maintenance operation does, for the admins who have the Operations
page - `analyze` runs `INFO` and reports a line count, and there is nothing else
in the maintenance list here.

Two more boundaries travel with the family, not with any one relative. Agent
AUTO mode does not run on any of these servers: the read-only profile is
database-native and only PostgreSQL, SQLite and DuckDB implement it, so an auto
run ends `engine-unsupported`. Agent PLAN mode does open, toolless, executing
nothing, and it is told in one sentence that a `user:*` row is a grouping this
server derived from a bounded scan rather than a key any command can be given.
That same fact is why the schema explorer offers no per-row Profile Table,
Generate Test Data or maintenance action here.

The [engine list](/databases) publishes what each engine deliberately cannot do
next to its transport and port, and the [capability pages](/features) publish
the limit beside each feature.
