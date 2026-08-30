---
title: What Redis monitoring reads and what returns nothing
status: published
author:
  name: LibreDB
  picture: ''
slug: redis-monitoring-info-slowlog
description: Health, performance, slow log and clients all derive from Redis introspection commands, while the table and index panels come back empty because Redis has neither.
coverImage: ''
tags:
  - value: engineering
    label: Engineering
  - value: databases
    label: Databases
publishedAt: 2026-07-09T09:00:00.000Z
---

An empty monitoring panel and a broken one look identical. Redis monitoring is
INFO, SLOWLOG, CLIENT LIST, DBSIZE and nothing else; two of its panels come back
blank on every connection, and a reader who cannot tell which command produced a
figure has no way to know whether a blank is a missing feature, a permission
problem, or a fact about the engine. So every figure on the Redis dashboard is
traceable to the command it came from, and the blanks are traceable to the
absence of a command rather than to the failure of one.

## Redis monitoring is INFO, SLOWLOG, CLIENT LIST and DBSIZE

The provider extends the shared base class directly, and inherits the base
class's `getMonitoringData()`, which fans the individual monitoring methods out
in parallel. Each of those methods is a Redis introspection command and a parse:

| Method | Source command | What the panel shows |
| --- | --- | --- |
| `getHealth()` | `INFO` | `connected_clients`, `used_memory_human`, hit ratio |
| `getOverview()` | `INFO` + `DBSIZE` | version, uptime, clients, maxclients, memory, key count |
| `getPerformanceMetrics()` | `INFO` | hit ratio, `instantaneous_ops_per_sec` as queries per second |
| `getSlowQueries()` | `SLOWLOG GET 10` | per entry: id, command text, duration |
| `getActiveSessions()` | `CLIENT LIST` | one session per client: id, addr, db, flags, cmd, idle |
| `getStorageStats()` | `INFO memory` | `used_memory_human`, and a usage percent when `maxmemory` is set |
| `getTableStats()` | none | `[]` |
| `getIndexStats()` | none | `[]` |

`parseRedisInfo()` turns the `INFO` bulk string into a flat key to value map,
and every INFO-derived number above is a lookup in that map rather than a
computation. The slow-log durations are the one conversion: `SLOWLOG` reports
microseconds and the panel reports milliseconds.

`CLIENT LIST` is parsed the same way, per line, into `key=value` pairs - and
every field in that reply is optional, so the parser substitutes a default for
anything absent. The session's user reads `name` falling back to `default`, its
pid `id` falling back to `0`, its state `flags` falling back to `N`, its command
`cmd` falling back to `idle`. Worth knowing before you read the user column: the
`name` field is empty on a client that never set one, so `default` is what most
sessions show. It is the parser's fallback, not a login.

The queries panel's empty state says what is empty: Redis lists what `SLOWLOG`
holds, and nothing has yet run slower than `slowlog-log-slower-than`. That
sentence used to be PostgreSQL's advice about `pg_stat_statements` on every
engine, which is worse than no sentence, because it sends the reader to look for
an extension that does not exist here.

## Cache hit ratio, and what it is a ratio of

The hit ratio is `keyspace_hits / (keyspace_hits + keyspace_misses) * 100`, both
counters read from `INFO`. Two things follow from that formula and both matter
more than the number.

It is cumulative over the counters the server has kept, not a rate over the
refresh interval. A server that spent a long stretch hitting nearly every read
and the last ten minutes missing every one still shows a healthy figure: the
panel refreshes, the counters it divides do not.

And when there has been no traffic at all, both counters are zero, the division
is undefined, and the ratio defaults to `100.0`. A freshly started Redis that has
served nothing reports a perfect cache hit ratio. That default is deliberate -
the alternative is a zero, which reads as a catastrophe rather than as silence -
but it means the figure answers "how have reads gone so far", and on an idle
server the honest answer is "they have not".

This surfaces sharply on one of the Redis-compatible relatives. Garnet 2.1.5
publishes neither `keyspace_hits` nor `keyspace_misses` in its `INFO`, so the
ratio takes the `100` fallback and the dashboard rates it Excellent on a server
that is doing work. Same for memory: Garnet publishes no `used_memory`, so the
overview's database size and the memory storage panel read `0 B` on a populated
instance. These are absences wearing a value, and they are recorded as such
rather than presented as measurements.

## Panels that are empty because Redis has no such object

**Table statistics and index statistics return empty on Redis, because Redis has
neither.** `getTableStats()` and `getIndexStats()` return `[]` - not an error, not
a partial answer, an empty list - and the `indexes` array on every synthetic
schema entry is empty for the same reason. There is no query to write that would
fill them.

That is also why the "tables" those panels would describe are not tables. Schema
discovery runs a cursor-based `SCAN` with `COUNT 100`, capped at 1000 keys, and
groups the key names it found by everything before the first `:`, so `user:123`
and `user:456` collapse into a row called `user:*`. That row is this server's own
summary of a bounded scan. It is not a key any command can be given, and it has
no statistics of its own to report, because Redis does not keep any.

The stated limit on [the monitoring feature](/features) is that what each panel
can show is bounded by what the engine reports, and Redis is that sentence at its
plainest: the tab renders the list the provider returned, and the list is empty,
so nothing fills it with plausible zeros. The engine's line on [the databases
page](/databases) makes the same point one level up: no SQL, and none is
pretended.

## Degrading under a restricted ACL instead of breaking

The connection dialog's Username field is the Redis 6 ACL user, passed to the
driver as `username` and omitted entirely when empty. A least-privilege user is
the normal case for a monitoring connection, and it splits the dashboard in two.

**The `SLOWLOG` and `CLIENT LIST` reads are wrapped in try/catch and degrade to
`[]`.** An ACL that forbids either command produces an empty queries panel and an
empty sessions panel, not a failed dashboard. That is the same empty list the
table and index panels return, arrived at for a different reason - which is
precisely why the panel has to name its command rather than just render blank.

The INFO-derived surfaces behave differently on purpose. `getHealth()`,
`getOverview()` and `getPerformanceMetrics()` all read `INFO`, and for a user
without `+info` they raise the server's own `NOPERM` sentence rather than
answering with fabricated zeros. The connection still opens and keys still
browse: the driver's own ready check calls `INFO`, logs that it is skipping the
ready check on `NOPERM`, and connects anyway. `POST /api/db/test-connection`
reports that combination as degraded - amber, not a green tick and not a failure.
The connection is real. The health read is not.

Measured against `redis:latest` with a second ACL user defined
`on >probepw ~* +@all -info`:

```text
{host, port, password}            -> ACL WHOAMI = default | INFO succeeds
{host, port, username, password}  -> ACL WHOAMI = probe   | INFO refused: NOPERM
```

To reproduce the restricted arm:

```bash
docker run --rm -d --name redis-acl -p 6389:6379 redis:latest
docker exec redis-acl redis-cli ACL SETUSER probe on '>probepw' '~*' +@all -info
```

Grant `+info`, or expect those three panels to stay unanswered for that user.

## Reading the storage figure for what it is

`getStorageStats()` reads `INFO memory`. It reports `used_memory_human`, and a
usage percent only when `maxmemory` is set - because a percentage needs a
denominator, and an unbounded Redis has none. No `maxmemory`, no percentage.

The same rule catches the connection count. `maxConnections` comes from
`maxclients` and falls back to `0`. Redis, Valkey and KeyDB each publish
`maxclients:10000`; neither DragonflyDB's nor Garnet's `INFO` carries the line at
all, so the panel shows 0 - an absent limit rendered as a zero rather than a
measured one. On Garnet, `connected_clients` stays 0 with a client attached while
`CLIENT LIST` answers correctly, so the session list is right and the count above
it is not.

All four of those relatives connect through the same `redis` type id; there is no
per-engine branch and nothing renames the server, because the alternative is
asserting a product the `INFO` reply never claimed. What the overview shows is
the compatibility level the server published in `redis_version`, which is why a
Valkey 9.1.1 instance reads 7.2.4.
