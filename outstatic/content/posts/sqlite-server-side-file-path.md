---
title: A SQLite connection is a path on the server
status: published
author:
  name: LibreDB
  picture: ''
slug: sqlite-server-side-file-path
description: There is no network protocol, so the form collapses to one input and a remote user of a hosted deployment cannot open a file from their own machine.
coverImage: ''
tags:
  - value: engineering
    label: Engineering
  - value: databases
    label: Databases
publishedAt: 2026-07-20T09:00:00.000Z
---

Most people looking for a browser SQLite database viewer arrive with a file in
mind and one unstated assumption: that the browser will open it. It will not.
Most of the engines LibreDB Studio speaks to answer on a socket. SQLite answers
on a filesystem, and the filesystem in question belongs to the process serving
the page. That difference decides the connection form, the deployment shape, and
where read-only access has to come from.

## Why the connection form has one field

SQLite's `connectionFields` entry in `src/lib/db-ui-config.ts` is `["database"]`.
`isFileBased()` reads that and collapses the modal to one input labelled
**Database File Path** - no host, no port, no user, no password. The provider's
`getCapabilities()` reports `defaultPort: null`, because there is no listener to
give a number to.

It also reports `supportsConnectionString: false`, which is narrower than it
sounds. The flag means there is no network DSN for this engine; it does not mean
the field is ignored. `getDatabasePath()` still accepts a `file:` string or a
bare path there, strips the prefix, and treats it as a path like any other.

The missing fields are the interesting part. On a networked engine, the
credentials in the form are the access control. Here there are none, so the
access control is whatever the operating system says about the file. The
connection is not authenticated; it is permitted.

## What the process opens, and which pragmas it sets

`getDatabasePath()` resolves the target in a fixed order: `connectionString`
with any `file:` prefix removed, else `database`, else `:memory:`. A non-memory
path is run through `path.resolve()` to an absolute path, and the only
validation applied is rejection of a NUL byte. `../` segments are legal and
simply resolve. Parent directories are created on connect.

`connect()` then opens the file with `{ create: true, readwrite: true }` and
issues three pragmas:

```sql
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
PRAGMA synchronous  = NORMAL;
```

Foreign key enforcement on, WAL for concurrency, `NORMAL` sync for a
speed-against-durability balance. Three consequences follow from those open
flags and those pragmas.

`create: true` means a mistyped path does not fail. It produces a new, empty
database at the typed location, and the object browser shows you an empty
schema, which reads exactly like a broken connection. If the tree is empty,
check the path before you check anything else.

`journal_mode = WAL` writes. It creates `-wal` and `-shm` files beside the
database, which is why the storage panel runs `fs.statSync` on all three, and
why the *directory* holding the database has to be writable, not just the file.

And the whole thing is an embedded handle. The provider exposes no
`beginTransaction`/`commit`/`rollback` and no `cancelQuery`, so
`supportsTransactions: false` withholds the BEGIN/COMMIT/ROLLBACK controls and
the auto-rolled-back sandbox toggle from the editor toolbar rather than showing
them and failing the call.

Which driver does the opening depends on the runtime. The `sqlite-driver`
adapter selects `bun:sqlite` under Bun and `node:sqlite` under Node; every
packaged channel - the Docker image, `npx @libredb/studio`, the Homebrew tap,
the `.deb` and `.rpm` packages, the standalone tarballs - runs the built app
with `node server.js`, so in a deployment you are on `node:sqlite`.
`LIBREDB_SQLITE_DRIVER=bun|node` forces one. On a runtime with neither,
`connect()` throws a `DatabaseConfigError`. This matters for one published
number: per-table size is read from the `dbstat` virtual table, which
`node:sqlite` is compiled with and `bun:sqlite` is not, so the same file reports
sizes under one driver and `N/A` under the other.

## What a hosted deployment cannot do for a remote user

State it plainly, because it is the boundary of the feature. SQLite has no
network protocol. A remote user of a hosted deployment cannot point Studio at a
file on their own machine - there is nothing on that machine to connect to, and
the path they type is resolved in the Studio process on the server. `/data/app.db`
means that path on the machine running Studio, always.

So SQLite as a target fits self-hosted installs, Docker, local development, edge
deployments and zero-configuration trials, where the file already sits beside
the app. It is not a multi-tenant SaaS target, and the
[engine list](/databases) is where to look if the database you need to reach is
somewhere else.

There is a second consequence for shared instances, and it is not a corner case.
Path resolution has no base-directory sandbox: any authenticated user of that
instance can open any SQLite file the Studio process can read. The trust model
is deliberate - pointing Studio at a server-side file is the capability, not
attacker-controlled input - but it is an assumption to check against your threat
model rather than one to inherit. An optional allowlist is tracked as issue #125.
Until it lands, the controls are the ones below.

## Which volume you mount, and as which user

Because the path is resolved in the process and nowhere else, the deployment
question is not a connection string. It is which volume you mount and which user
the process runs as. Mount the directory, not the file, so the `-wal` and `-shm`
sidecars have somewhere to live:

```yaml
services:
  libredb-studio:
    image: ghcr.io/libredb/libredb-studio:latest
    ports:
      - "3000:3000"
    volumes:
      - ./databases:/data
```

The path you then type into the form is `/data/app.db` - the container-side
path, not the host path you can see in your editor. Mount only the directories
that hold databases this instance should serve; the reachable set of files is
exactly the set the process user can read, so a narrow read scope is the control
that actually holds.

The connection form is not where you ask for read-only. `connect()` opens the
file `readwrite` and sets `journal_mode = WAL`, which is itself a write. The
read-only handle belongs to agent mode instead. SQLite is one of the three
engines - with PostgreSQL and DuckDB - where an agent run executes statements at
all, and its execution profile opens a second, physically separate handle to the
same file with the driver's read-only flag, then sets and verifies
`PRAGMA query_only` at open and before every statement, because a read-only open
alone reads `query_only` back as 0. Plan mode opens on every connection, is
toolless, and drafts statements for you to run yourself. Each packaged channel
puts its data directory in a different place, so check the
[deployment channels](/deploy) for the one you use.

## In-memory databases, and what they are for

`:memory:` is accepted in the same field, which makes the modal a zero-setup way
to get a scratch database and try the editor. It is discarded on disconnect.
Nothing is written anywhere, nothing survives a restart, and there is no file to
back up. That is the intended use, not a caveat attached to a real one.

It also cannot be an agent target. Under the read-only execution profile an
in-memory database is refused with `ExecutionProfileError` reason code
`PROFILE_UNSUPPORTED_TARGET`, because a read-only open of an anonymous database
can only yield an empty one or fail outright.

For a first look that persists, standalone startup already seeds one: the
vendored employees database is copied to `<data dir>/sample-employees.db` and
advertised as an editable, dismissable **Sample (Employees)** connection. The
copy is asynchronous and fail-open, so a failure logs a warning and the sample
is simply absent. `SQLITE_EMBEDDED_SAMPLE=false` disables it.
