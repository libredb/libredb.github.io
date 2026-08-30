---
title: Connecting to MySQL in a container, and what the pool honours
status: published
author:
  name: LibreDB
  picture: ''
slug: mysql-connect-docker-pool-limits
description: Port 3306 with the fixture credentials, the container-network case, and the pool settings that are quietly ignored because the driver model differs.
coverImage: ''
tags:
  - value: engineering
    label: Engineering
  - value: databases
    label: Databases
publishedAt: 2026-03-09T09:00:00.000Z
---

Two things go wrong when people connect to MySQL in Docker for the first time. The
first is the host: `localhost` means the container it is typed in, not the machine
running it. The second is slower and quieter - a pool tuned with four settings
copied from advice written for a different driver, three of which this provider
never reads.

## The fixture, the port and the credentials

MySQL reaches LibreDB Studio through `MySQLProvider`, built on `mysql2/promise`,
extending the same `SQLBaseProvider` the PostgreSQL provider extends. Default port
3306. Connection strings are supported and passed to the pool as its `uri` option.

The studio repository ships a fixture so there is nothing to guess. The `mysql`
service in `database-compose.yml`:

```yaml
mysql:
  image: mysql:latest
  container_name: libredb-mysql
  restart: unless-stopped
  environment:
    MYSQL_ROOT_PASSWORD: root
    MYSQL_DATABASE: mysql
  ports:
    - "3306:3306"
```

Start it on its own:

```sh
docker compose -f database-compose.yml up -d mysql
```

Then, in the connection dialog: host `localhost`, port `3306`, user `root`,
password `root`, database `mysql`. That is the whole recipe. If you would rather
not clone the fixture, the standalone equivalent is one line:

```sh
docker run --rm -e MYSQL_ROOT_PASSWORD=root -e MYSQL_DATABASE=app \
  -p 3306:3306 mysql:8
```

and the connection is then `localhost:3306`, database `app`, user `root`.

One scope note before you go looking for a schema tree that is not there. Every
introspection query binds `TABLE_SCHEMA = ?` to the connected database, so a
connection sees one database and table names render bare, without a
`schema.table` prefix. To read a second database you make a second connection.

## When localhost is the wrong host

The recipe above assumes Studio is running on your machine - `bun dev`, or a
desktop build - and MySQL is the only thing in a container. Publishing `3306:3306`
puts the server on the host's loopback, and `localhost` resolves to the same
place your browser does.

Run Studio itself as a container and that stops being true. `localhost` inside
the Studio container is the Studio container. Nothing is listening on 3306 there,
and the driver returns `ECONNREFUSED`, which the error mapper turns into a
`ConnectionError` carrying the host and port it tried. The message is accurate
and looks like a server problem. It is a name problem.

The fix is to put both containers on one network and address the database by its
service name:

```sh
docker run -p 3000:3000 --network libredb-studio_default \
  ghcr.io/libredb/libredb-studio:latest
```

Then connect to host `mysql`, port `3306` - the compose service name, on the
compose network, at the container port rather than the published one. The
published `3306:3306` mapping is irrelevant here; it exists for traffic arriving
from the host. Two containers on the same user-defined network reach each other
by service name whether or not anything is published at all.

Every provider funnels its driver's errors through the same shared
`mapDatabaseError()`, so this mistake reads the same whichever engine you point
at, which is why it is worth naming once. The [engine pages](/databases) print
each engine's transport and default port next to its name for exactly this
moment.

## Which pool settings are mapped, and which are dropped

`connect()` builds a `mysql2` pool and validates it by acquiring and releasing one
connection. The pool is configured like this:

| mysql2 option | Value | Where it comes from |
| --- | --- | --- |
| `connectionLimit` | pool `max`, default 10 | `ProviderOptions.pool.max` |
| `waitForConnections` | `true` | fixed |
| `queueLimit` | `0`, an unbounded queue | fixed |
| `enableKeepAlive` | `true` | fixed |
| `keepAliveInitialDelay` | `10000` ms | fixed |
| `timezone` | `ProviderOptions.timezone ?? 'Z'` | discrete-fields form only |

**Only `max` is honoured as the driver connection limit; `min`, `idleTimeout` and
`acquireTimeout` are ignored, and this provider exposes no pool statistics at
all.** The reason the provider documents is that the mysql2 pool model differs
from `pg`'s; those three options are not passed through, and nothing above the
driver emulates them. Set `min` to 4 and nothing keeps four connections warm. Set
`acquireTimeout` and nothing times an acquisition out at that boundary. A
connection-acquire failure still surfaces - the shared error
mapper reads *timeout* or *timed out* in the driver's own message and raises
`TimeoutError` - but it arrives on the driver's schedule, not on the number you
typed.

`queryTimeout` is in the same category and worth stating separately, because its
absence has teeth. The provider configures no server-side statement timeout, so a
runaway query is not killed for you. Cancellation is explicit: a statement issued
with a `queryId` records its connection's `threadId`, and `cancelQuery()` issues
`KILL QUERY <threadId>`, which reaches the caller as `QueryCancelledError`. That
call returns `true` when the `KILL` succeeded, without confirming the target was
still executing.

One more trap in the same function. When you supply a connection string,
`buildPoolConfig()` returns the base config plus `uri` and skips the
discrete-fields branch entirely. `timezone`, `connection.ssl` and cloud SSL
auto-detection are therefore ignored on that path. If you paste a URI, encode
those in the URI.

## Why there are no client-side pool numbers here

The PostgreSQL provider implements `getPoolStats()`, which exposes live `total`,
`idle`, `active` and `waiting` counts for its own pool. The MySQL provider
implements no `getPoolStats()`, so there is no client-side pool reading to render
and none is invented.

That is the general rule of the monitoring surface, applied here. Where MySQL's
`performance_schema` is off, `getPerformanceMetrics()` omits every field rather
than defaulting it - cache-hit ratio, queries per second and buffer-pool usage are
reported as absent, not as zero - and where the `performance_schema` database is
missing outright the method answers an empty object. A zero is a measurement. An
absence is not, and printing one as the other is how a dashboard starts lying.

So the honest answer to "how loaded is my pool" on MySQL is: ask the server, not
the client. `information_schema.PROCESSLIST` backs the active-sessions panel, and
`SHOW STATUS` backs the overview. Those are the server's own numbers about the
connections it is holding, which is the question you were really asking.

## Checking the connection before you trust it

Test Connection runs `getHealth()`, and `getHealth()` is a real read rather than a
socket check: `SHOW STATUS`, `information_schema.TABLES` and `PROCESSLIST`, and
the `performance_schema` digest table for the slow-query list. A green badge
therefore means the account can read the catalog, not merely that TCP opened.

The failures separate cleanly, which is the point of testing before you work:

| What you see | What it means |
| --- | --- |
| `ConnectionError` with host and port | Nothing answered there - usually the `localhost` case above |
| `AuthenticationError` | The server answered and refused the credentials |
| `DatabaseConfigError` | `host` and `database` are required when no connection string is given |
| `QueryError` carrying the server's message | Connected and authenticated; the statement is the problem |

Two last expectations to set while you are looking at a fresh connection. Row
counts in the browser come from `information_schema.TABLES.TABLE_ROWS`, which is
an InnoDB estimate rather than an exact count, and index `scans` is `CARDINALITY`,
an estimate of distinct values rather than a usage counter, because MySQL
publishes no equivalent of `pg_stat_user_indexes.idx_scan`. Both are useful for
ordering things by size. Neither is a number to quote in a report.

Once the badge is green, [the setup guide](/get-started) covers the rest of the
first run.
