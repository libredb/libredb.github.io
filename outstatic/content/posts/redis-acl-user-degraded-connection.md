---
title: Connecting to Redis with an ACL user that cannot run INFO
status: published
author:
  name: LibreDB
  picture: ''
slug: redis-acl-user-degraded-connection
description: A Redis ACL user without the INFO grant connects and browses keys, while health, overview and performance raise a permission error and the connection test reports degraded.
coverImage: ''
tags:
  - value: engineering
    label: Engineering
  - value: databases
    label: Databases
  - value: security
    label: Security
publishedAt: 2026-01-04T09:00:00.000Z
---

Hand a Redis ACL user everything except `+info` and the session still works. Keys
browse, commands run, the results grid fills. What stops is the monitoring: the
three reads whose only source is `INFO` come back as the server's own `NOPERM`
refusal. That is not a broken connection and it is not a healthy one, so the
connection test has a third answer for it.

## The connection fields, and which one is the ACL user

The Redis provider consumes discrete fields, not a connection string:
`supportsConnectionString` is `false`. The dialog collects six.

| Field | Required | What it becomes |
| --- | --- | --- |
| `host` | yes | throws `DatabaseConfigError` in `validate()` if missing |
| `port` | no | defaults to `6379` |
| `user` | no | the Redis 6 ACL user, sent as ioredis's `username` |
| `password` | no | ioredis's `password`; omit for an unauthenticated instance |
| `database` | no | logical DB index, parsed as int, defaults to `0` |
| `ssl` | no | mapped onto ioredis's single `tls` option |

The Username box is the ACL user and nothing else. When it is empty the provider
passes no `username` at all, because ioredis authenticates as `default` only when
the field is absent - a plain `requirepass` server has no ACL user to name, and
sending an empty one is not the same as sending none.

A pasted URL fills the same box. `redis://analytics:pw@host:6379/0` is decomposed
by the UI parser into host, port, user, password and database before the provider
sees anything, and the raw string is dropped. Because it is dropped, the scheme's
TLS intent has to travel as a field: `rediss://` arrives as `sslMode: 'require'`
and `redis://` as `'disable'`.

There is a version of this that fails silently, and it is the one this behaviour
replaced. `connectionFields` decides what a save writes, and it omitted `user`
for `redis` until 2026-08-27, so the name a person typed was discarded between
the box and the driver. Sessions ran as `default`, and health went green under
someone else's permissions. Measured against `redis:latest` on 2026-08-26, with
`default` left `on nopass ~* &* +@all` and a second user defined
`on >probepw ~* +@all -info`:

```text
{host, port, password}            -> ACL WHOAMI = default | INFO succeeds
{host, port, username, password}  -> ACL WHOAMI = probe   | INFO refused: NOPERM
```

Both arms are the measurement. One arm alone would only have shown that a request
succeeded.

## What a user without INFO can still do

Everything the key browser is made of, because none of it reads `INFO`.

Schema discovery is a cursor-based `SCAN` with `COUNT 100`, never `KEYS *`, and
it stops at 1000 keys. Each key is grouped by everything before its first colon
plus `:*`, so `user:123` and `user:456` collapse into a `user:*` row, and each
prefix is probed with `TYPE` until three distinct value types have been observed.
The resulting list is sorted by descending key count.

The editor is the other half, and it is equally indifferent to `INFO`. A query is
dispatched through ioredis's generic `client.call()`, in one of two formats
decided by the first character of the first runnable line: a leading `{` is a JSON
command object, anything else a plain command through a quote-aware tokenizer.
Any command the ACL allows works, with no per-command code in the provider.

The connection itself survives by design rather than by accident. ioredis's own
ready check calls `INFO`; on `NOPERM` it logs *Skipping the ready check* and
connects anyway.

Two monitoring surfaces survive as well, and that was deliberate. The
`SLOWLOG GET 10` and `CLIENT LIST` reads behind the Queries and Sessions panels
are wrapped in try/catch and degrade to `[]` rather than throwing, so an ACL that
forbids those two commands does not take the dashboard down with it.

## Why the health reads raise Redis's own NOPERM for the INFO command

Three methods have exactly one source. `getHealth()` reads `INFO`.
`getOverview()` reads `INFO` plus `DBSIZE`. `getPerformanceMetrics()` reads
`INFO`. Connected clients, memory in use, uptime, the server version, the cache
hit ratio and `instantaneous_ops_per_sec` are all parsed out of that one bulk
reply.

Take `INFO` away from the user and there is nothing left to parse. So the limit,
stated plainly: **a user without the INFO grant still connects and browses keys,
but health, overview and performance raise the server's own permission error
rather than answering with fabricated zeros.**

The alternative was available and was refused. Every field those panels want has
an obvious default - clients 0, memory 0 B, hit ratio 100. The cache hit ratio
already carries a fallback of `100.0` for a server that has served no traffic, so
the machinery for a plausible-looking zero exists. Filling the panels that way
would produce a dashboard that reads as a healthy idle server and is in fact a
permission error, and no operator can tell those apart by looking. The `NOPERM` reply is
the server's own answer, and it is the only output here that tells you what to
change.

## Green, amber and failed are three different results

`POST /api/db/test-connection` reports a restricted user as **degraded**, amber:
not a green tick and not a failure. The connection is real. The health read is
not.

Two outcomes would have to lie in one direction or the other. Green would mean
"connected and readable" for a session whose entire monitoring surface is a
permission error, which is the fabricated-zeros dashboard with a nicer icon.
Failed would mean "do not use this connection" about a user who can browse the
whole keyspace and run every command the ACL grants - which sends someone to
debug a network path that works.

Amber says the thing that is actually true, and it is the useful outcome because
it is the only one that carries a next step. The next step is a decision, not a
fix: grant `+info` to this user, or accept that the monitoring panels stay empty
for it and use the key browser and the editor, which are unaffected.

## Choosing the grants a browsing user needs

Work backwards from the commands the app sends. Every surface here names its own.

| Surface | Commands it sends |
| --- | --- |
| Key pattern tree | `SCAN`, `TYPE` |
| Scan Keys and value reads | `SCAN`, `GET`, `HGETALL`, `LRANGE`, `SMEMBERS`, `ZRANGE` |
| Health, overview, performance | `INFO`, `DBSIZE` |
| Queries panel | `SLOWLOG GET` |
| Sessions panel | `CLIENT LIST` |
| Storage panel | `INFO memory` |
| Operations, Server Info | `INFO` |

A user granted the first two rows browses and reads. Adding `+info` turns the
amber to green. The Queries and Sessions panels are the two that are safe to
withhold, because their absence is already handled as an empty list.

The reason to bother getting this right is that the ACL is the enforcement point,
not the provider. The generic `call()` dispatch runs `SET`, `DEL` and `FLUSHALL`
the same way it runs `GET`; there is no read-only guard in the Redis provider, so
access control is whatever the ACL enforces. The [security page](/security) makes
the same point about the controls Studio does apply: masking is display-level,
and a hard guarantee needs database-side grants on the account the connection
uses. A read-only Redis session is an ACL you wrote, or it is nothing.

To reproduce the whole thing locally, including the amber:

```bash
docker run --rm -d --name redis-acl -p 6389:6379 redis:latest
docker exec redis-acl redis-cli ACL SETUSER probe on '>probepw' '~*' +@all -info
```

Connect on port 6389 with username `probe` and password `probepw`: keys browse,
and the connection test reports degraded. Leave the Username box empty and the
session authenticates as `default`, whose `INFO` succeeds and whose test comes
back green.
