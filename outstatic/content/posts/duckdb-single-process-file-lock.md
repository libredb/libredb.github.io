---
title: One DuckDB file admits one process, readers included
status: published
author:
  name: LibreDB
  picture: ''
slug: duckdb-single-process-file-lock
description: A second read-only process is refused with the same lock error as a second writer, which makes two Studio replicas on one file a broken configuration.
coverImage: ''
tags:
  - value: engineering
    label: Engineering
  - value: databases
    label: Databases
publishedAt: 2026-06-22T09:00:00.000Z
---

Scale the deployment to two replicas, point both at the same warehouse file, and
one of them stops working. The message it prints is `IO Error: Could not set lock
on file`, which reads like a writer conflict. The summary most people carry says
one writer and many readers, so the second replica should have been fine. It was
only reading. It was refused anyway.

## A connection is a path on the server, not an endpoint

DuckDB has no daemon, no listener and no login. The engine is linked into the
process that opens the file. In Studio that means the `database` field holds a
server-local filesystem path, or `:memory:`, and the connection dialog offers no
port, because `defaultPort` is `null`. There is no host, no user and no password -
the filesystem is the access control. There is also no connection
string: `supportsConnectionString` is false, since DuckDB publishes no URI scheme
and a `duckdb://` prefix would be a scheme on a field that can only ever hold a
path.

The engine ships inside the driver package, `@duckdb/node-api` 1.5.5-r.4, a native
N-API binding rather than a pure-JS client, so there is no image to pull and no
service to health-check. To try it by hand, create a directory and point a
connection at a file inside it - `mkdir -p /tmp/libredb-duckdb`, then
`database = /tmp/libredb-duckdb/warehouse.duckdb`.

The word "server-local" is the load-bearing part. The path is resolved on the
machine Studio runs on, not on the machine holding the browser. A remote user of a
hosted deployment cannot point Studio at a file on their own laptop, because there
is nothing to connect to over a network. That constraint is inherited from the
engine being embedded, and it is the same one the SQLite provider carries.

## What a second process actually gets

The behaviour was measured against DuckDB v1.5.5, case by case, while a writer
held the file open:

| Scenario | Result |
| --- | --- |
| Second read-write handle, **same process** | Allowed |
| `DuckDBInstance.fromCache` on the same file, same process | Allowed |
| Second `access_mode: 'READ_ONLY'` handle, same process | Allowed, and genuinely read-only |
| Second read-write **process** | `IO Error: Could not set lock on file ...: Conflicting lock is held in ... (PID nnn)` |
| Second **read-only process** | Refused, with the same lock error |
| `READ_ONLY` open of a file that does not exist | `IO Error: Cannot open database ... in read-only mode: database does not exist` |

Read the fifth row twice. The read-only process is not degraded, not stale, not
serialised behind the writer. It is refused, and the error it gets is the writer's
error. That is why the provider's `singleWriterFile` flag is set to `true` here as
a measurement rather than as a cautious default, and why a blocked reader and a
genuine second-writer conflict produce the same line in a log.

The third row matters for the opposite reason: a second read-only handle in the
*same* process is allowed, and it is really read-only. Under it,
`current_setting('access_mode')` answers `read_only`, `duckdb_databases().readonly`
is true, and `INSERT` is refused. Same-process handles are fine. Process number two
is the boundary.

## Why the usual summary does not hold

The one-writer-many-readers shape is a real and common arrangement, and it is what
"single writer" usually describes: an engine that takes a write lock on the file
and lets separate reader processes take shared locks alongside it. DuckDB, as
measured on 1.5.5, does not do the second half. The
lock it holds excludes every other process regardless of the access mode that
process asked for.

The practical consequence is that a habit built on the usual summary quietly
produces a broken configuration. Opening a `duckdb` CLI session against the file
Studio has open will fail. So will a cron job that opens the same file read-only to
export a nightly extract. So will a second Studio container. None of these are
misconfigurations in the sense of a wrong flag - they are correct under a rule this
engine does not follow.

**The limit, stated plainly: a DuckDB file admits exactly one operating-system
process. A second read-write process and a second read-only process are both
refused with a lock error, so two Studio replicas pointed at one file is a broken
configuration.** Not a degraded one. One of the two will not open the database at
all.

## Two replicas on one file is a configuration bug

This is the deployment rule that falls out of it, and it applies wherever the
replica count is a number someone can raise: a Helm `replicaCount`, a Compose
`deploy.replicas`, an autoscaler minimum. For the engines that speak over a
network, raising it is the ordinary shape - each replica opens its own connections
to a database built to serve many clients at once. A DuckDB file is not that
database.

So if a deployment holds DuckDB connections, the replica count is one. Not one by
convention: one because the second replica's connection fails at open, and the
failure surfaces to whichever user happened to be routed to it. Two containers on
one file is not a capacity decision that trades consistency for throughput; it is a
configuration bug that presents as intermittent connection errors, because a load
balancer will send some requests to the replica that holds the lock and some to the
one that cannot get it.

Mixed deployments are the case to watch. An instance holding only the networked
engines on [the engine list](/databases) puts no limit of its own on the replica
count. Add one DuckDB connection to it and the whole deployment inherits the
constraint, because the DuckDB connection lives wherever the replica lives.

A related boundary belongs in the same breath. Anyone who can create a DuckDB
connection is choosing a path on the server's filesystem, and on a writable editor
connection the engine will read a CSV, Parquet or JSON file sitting next to it. On
a shared deployment that permission is closer to a shell on the Studio host than to
a database login. Grant it accordingly.

## Why the read-only agent handle works anyway

Given all of the above, the agent's read-only access looks like it should be
impossible. It is not, and the reason is exactly the distinction the table draws.

Agent AUTO mode runs on DuckDB, alongside PostgreSQL and SQLite, because the
provider implements a read-only query path. What it opens is a second handle in the
**same process** as the writer, with two engine options fixed at open time:

```ts
access_mode: 'READ_ONLY',
enable_external_access: 'false',
```

Row three of the table is what makes that legal. It is not a second process, so no
lock is contested.

The second option is the one doing the security work, and it is separate from the
lock question. `access_mode: 'READ_ONLY'` bounds the *database*, not the *process*.
Measured under it alone, with `INSERT` genuinely refused in the same session,
`COPY ... TO`, `EXPORT DATABASE`, `INSTALL httpfs`, `read_text('/etc/hostname')`
and `glob('/etc/*')` all succeeded. `enable_external_access: 'false'` is what closes
that: every one of those forms then answers

```
Permission Error: Cannot access file "/etc/hostname" - file system operations are disabled by configuration
```

and it cannot be turned back on from inside a session. Both `SET` and
`SET GLOBAL enable_external_access = true` answer `Invalid Input Error: Cannot
enable external access while database is running`, while `SET memory_limit` in the
same session is accepted - so a refusal to be reconfigured was not a given, it was
tested. The SQL denylist in the provider stays as defence in depth, naming the
construct and the reason, but it is not the boundary. Three measured bypasses are
recorded as the reason a text guard cannot be one.

Agent PLAN mode is unaffected by any of this. It is toolless, executes nothing, and
drafts a statement for a person to run, so it opens on every connection regardless
of engine.
