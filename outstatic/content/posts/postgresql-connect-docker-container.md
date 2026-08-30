---
title: Connecting Studio to PostgreSQL running in Docker
status: published
author:
  name: LibreDB
  picture: ''
slug: postgresql-connect-docker-container
description: 'The container-to-container case is the one that breaks: when Studio is itself a container, localhost is its own loopback and the service name is the fix.'
coverImage: ''
tags:
  - value: engineering
    label: Engineering
  - value: databases
    label: Databases
publishedAt: 2026-03-06T09:00:00.000Z
---

Three facts are enough to connect to Postgres running in Docker: a host, a port and
a database name. Getting the fixture up takes one command. What costs an afternoon
is the second container - the one Studio itself is running in, where `localhost`
means something different than it did on your laptop.

## A connection is a host, a port and a database, and nothing else

The PostgreSQL provider is built on `pg` (node-postgres), and its
`getCapabilities()` declares `defaultPort: 5432` and `supportsConnectionString: true`.
Two forms of configuration are accepted, and they are not additive.

**Discrete fields.** `validate()` requires `host` and `database`; `port`, `user`
and `password` fill in the rest. That is the whole form.

**A connection string.** `postgres://` and `postgresql://` both parse, and supplying
one bypasses the host/database requirement entirely.

The trap in between is worth knowing before you fight it: `validate()` does not
reject supplying both. If a connection carries a string *and* discrete fields,
`buildPoolConfig()` uses the string and ignores the fields. Editing the host box on
a connection you originally pasted a URL into changes nothing.

Behind the form, `connect()` builds a `pg.Pool` and validates it by acquiring and
releasing one client. The pool defaults are min 2, max 10, a 30-second idle timeout
and a 60-second acquire timeout; the statement timeout is separate, defaults to
60 seconds, and is applied as the pool's `statement_timeout`. None of that changes
between a local fixture and a managed instance. What changes is only ever the host.

## The one-command fixture: connect to Postgres running in Docker

This is the recipe in the provider doc's own smoke-test section:

```sh
docker run --rm -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:18
```

Then point a connection at host `localhost`, port `5432`, database `postgres`,
user `postgres`, password `postgres`. The E2E suite is verified against
PostgreSQL 18.x, so this is the same server the tests run against.

The repository keeps a longer-lived version of the same thing. `database-compose.yml`
defines a `postgres` service on `postgres:18` with `POSTGRES_USER`, `POSTGRES_PASSWORD`
and `POSTGRES_DB` all set to `postgres`, published on 5432:

```sh
docker compose -f database-compose.yml up -d postgres
```

If Studio is running on your machine rather than in a container - the npx package,
the desktop build, a dev server - you are done. The [get started
walkthrough](/get-started) picks up from the connection dialog. If Studio is a
container, read on, because the next thing you will see is a connection error.

## Why localhost fails from inside a container

`-p 5432:5432` publishes the database's port on the Docker *host*. It does not put
anything on port 5432 inside any other container.

So when Studio runs as a container and you type `localhost`, the driver resolves it
inside Studio's own network namespace and dials Studio's own loopback interface.
Nothing is listening there. The connection is refused before a single byte of the
PostgreSQL protocol is exchanged, and `connect()` fails with a `ConnectionError`
carrying the host and port it tried.

That last detail is the fastest way to tell this failure apart from the ones it gets
confused with. `pg` errors are normalised by `mapDatabaseError()` into distinct
classes: bad password gives you an `AuthenticationError`, an exhausted pool or a server
refusing further connections gives you `PoolExhaustedError`, a bad statement gives you
`QueryError`. A `ConnectionError` on `localhost:5432` means the driver never reached a
server at all. There is no
credential to fix and no `pg_hba.conf` line to add - the packet had nowhere to go.

The same reasoning covers the other two shapes of this. `127.0.0.1` is the same
loopback under a different spelling. And a database on the host machine rather than
in a container is not reachable at `localhost` from inside Studio either; that case
needs whatever address your Docker installation gives the host, which is a property
of your Docker setup and not of this application.

## Joining the network and using the service name

Put both containers on one network and address the database by its service name.
Compose gives you the network and the DNS for free:

```yaml
services:
  postgres:
    image: postgres:18
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: postgres

  studio:
    image: ghcr.io/libredb/libredb-studio:latest
    ports:
      - '3000:3000'
    depends_on:
      - postgres
```

Open Studio on port 3000 and fill the connection in with host `postgres`, port
`5432`, database `postgres`, user `postgres`, password `postgres`. As a string, the
repetition looks like a typo and is correct:

```
postgresql://postgres:postgres@postgres:5432/postgres
```

Two things about that port. It is the *container* port, not a published mapping -
5432 is where the server listens inside its own container, and the `ports:` block
above is absent from the database service on purpose, because container-to-container
traffic never goes through it. Keep `ports:` only if you also want a client on your
laptop to reach the database.

If the database is already running from `database-compose.yml` and you would rather
not merge the two files, attach Studio to the network that compose already created:

```sh
docker network ls                       # find the project's default network
docker run --network <project>_default -p 3000:3000 ghcr.io/libredb/libredb-studio:latest
```

One quiet consequence of using a service name: SSL stays off. `shouldEnableSSL()`
auto-enables TLS when the host matches a managed provider (`supabase`, `neon`,
`render`, `planetscale`, `aws`, `azure`, `gcp`, `cloud`), and `postgres` matches
none of them. That is the right outcome for a fixture on a private bridge network,
and it is worth knowing in the other direction too: when the heuristic does fire it
uses `rejectUnauthorized: false`, so the connection is encrypted but the server
certificate is not verified. Verified TLS to a managed host needs an explicit SSL
mode of `verify-system`, `verify-ca` or `verify-full`.

The same reasoning scales past one machine. Among the [deployment
channels](/deploy), a Helm release addresses the database by its Kubernetes service
name for the same reason a compose stack addresses it by its compose service name.
Only a client on your own machine ever addresses `localhost`.

## What the schema tree shows you first, and how exact those numbers are

The tree loads in two calls, on purpose. `getSchemaList()` returns tables, columns,
primary keys, row counts and sizes, and returns `indexes: []` and `foreignKeys: []`;
`getSchemaRelations()` returns the foreign keys and indexes separately and the client
merges them in. So the table list renders before the relationships exist, and the ER
diagram's edges appear a moment after the tables do. A slow relationship query cannot
block the tree.

Every introspection CTE is declared `AS MATERIALIZED`. PostgreSQL 12+ inlines
single-reference CTEs, which lets the planner re-execute an `information_schema` CTE
inside a nested-loop join; on a 122-table schema, forcing materialisation moved the
introspection from about 295 seconds to about 2.6. System schemas (`pg_catalog`,
`information_schema`, `pg_toast`) are excluded and only base tables are listed. Sizes
come from `pg_total_relation_size`.

Now the numbers, because two of them are not what they look like. Table row counts come
from `pg_class.reltuples`, a planner estimate that is stale or `-1` until the table is
analyzed, and column lists stop at the first 100 columns per table.

**The row count beside each table is an estimate, not a count.** It reads
`pg_class.reltuples`, which is a planner statistic maintained by `ANALYZE` and
autovacuum, not a `COUNT(*)`. On a table that has never been analyzed `reltuples` is
`-1`, which the provider clamps to `0`. A table you loaded ten seconds ago will
therefore read as empty, and a table that has churned since its last analyze will
read stale. Run `ANALYZE` against it and the number corrects itself. The maintenance
toolkit that runs `VACUUM ANALYZE` and `ANALYZE` for you is admin-only; the statement
itself is one you can type in the editor.

**Column lists stop at the first 100 columns per table.** The introspection query
carries `ordinal_position <= 100`. A wide table renders its first hundred columns and
says nothing about the rest. Queries against those columns work normally - the cap is
on the tree, not on the engine.

Both are trades made in the same direction: an exact count on every table in a large
schema means a sequential scan per table at every tree refresh. The estimate is free,
because the planner was keeping it anyway. What the estimate cannot answer is how many
rows are in the table right now; for that, type the `COUNT(*)` in the editor. The
[engine grid](/databases) carries the same kind of line for every other engine.
