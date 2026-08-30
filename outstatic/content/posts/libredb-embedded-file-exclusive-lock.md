---
title: Opening a LibreDB file takes an exclusive lock
status: published
author:
  name: LibreDB
  picture: ''
slug: libredb-embedded-file-exclusive-lock
description: There is no host, no port and no server, and the lock sidecar means command-line tooling cannot hold the same file while a connection is open.
coverImage: ''
tags:
  - value: engineering
    label: Engineering
  - value: databases
    label: Databases
publishedAt: 2026-02-23T09:00:00.000Z
---

Opening a LibreDB file is not a handshake. There is no socket to dial, no
credential to present and no server process to be running first. The
`@libredb/libredb` package opens the file in this process, synchronously, and
takes an exclusive lock on it before the call returns.

## A connection that is a path and nothing else

The provider reuses the `database` field of the connection record for the file
path. Nothing else on the record is read:

```ts
const connection = {
  id: 'libredb-1',
  name: 'App Data',
  type: 'libredb',
  database: '/data/app.libredb',
  createdAt: new Date(),
};
```

No `host`, no `port`, no `user`, no `password`, no connection string. The
declared capabilities say so rather than leaving it to be discovered:
`supportsConnectionString` is `false` and `defaultPort` is `null`. The evidence
is `getCapabilities()` in `src/lib/db/providers/embedded/libredb.ts`.

The consequence is a deployment fact before it is a feature. The `.libredb` file
must sit on the filesystem of the machine running Studio. There is no remote
connection model, because the database has no server and no wire protocol to
carry one; embedded in-process is the only supported mode. Run Studio as a
container beside your data and the file has to be on a volume that container can
see. That is the whole networking story, and it is why this engine appears on
[the engine grid](/databases) as a file rather than a host and port.

## Every open takes a lock, and the second one is refused

`lib.open({ path })` writes a sidecar next to the database: `<path>.lock`. Its
contents, measured, are four lines — the literal `libredb-lock`, the holder's
pid, the holder's hostname, and a nonce. While that sidecar is held, the file
admits exactly one handle. A second `open()` throws `LibreDbError` with code
`LOCKED`, and the provider turns that into a `ConnectionError` saying the file is
already open by another process and naming the fix: close the other writer.

State it plainly, because it is the constraint the rest of your tooling has to be
arranged around: **the open call takes an exclusive lock sidecar, so a LibreDB
file admits exactly one handle and a second open is refused.** Not queued, not
degraded to read-only, not resolved last-writer-wins. Refused.

This is the only engine in the product that declares `singleWriterFile: true`.
The other file-backed engine, SQLite, takes its locks per transaction rather than
at open, so two connections to one file coexist and contend statement by
statement. LibreDB moves that contention forward to `connect()`. You find out at
connection time, once, instead of at an arbitrary write.

The lock is released on `disconnect()`, and locks left by verifiably dead holders
are reclaimed automatically, so a killed process does not permanently strand a
file.

Inside Studio, three callers used to trip over this lock on every request,
because they build a provider outside the writable cache: `POST
/api/db/test-connection`, the agent's grounding read
(`acquireExecutionProfileProvider(connection, "agent-operations")`), and `POST
/api/db/schema-snapshot`. The symptoms were specific. The connection dialog tests
before it saves, so the built-in sample connection could not be edited at all —
the edit came back as a connection error, as if the sample were broken. Every
plan-mode run on a LibreDB connection was silently ungrounded from the moment
anyone clicked the connection in the sidebar. The Schema Diff tab's Snapshot
button answered HTTP 503 for a schema the sidebar was listing on screen.

All three now call `findOpenSingleWriterProvider` first and reuse the handle that
already holds the file. The lookup is keyed by the resolved file path, not the
connection id, because the second opener is usually a different connection record
pointing at the same file. A borrowed handle is never disconnected by its
borrower and never cached under the profiled key. Two bounds keep the agent's
isolation intact: only `agent-operations` borrows, and no borrow happens for a
connection that configures an `agentUser`, because a reuse cannot substitute one
principal for another. Agent AUTO mode is unavailable on this engine regardless —
it requires a provider-level `queryReadOnly`, which exists only on PostgreSQL,
SQLite and DuckDB, so an auto run here ends `engine-unsupported`. Plan mode opens
and drafts a command for a person to run.

## Working alongside command-line tooling

The reuse above is internal. It does not extend to anything outside the server
process. While a Studio connection holds the file, the `libredb` CLI and any
other external writer get `LOCKED`.

The timing detail that surprises people: Studio caches a connected provider per
connection id and evicts it after 30 minutes idle. The lock is held for that
whole window, not just while a query is running. Browse a LibreDB connection in
the sidebar, walk away, and the file stays locked for half an hour.

There are two ways to work with that:

- **Disconnect the Studio connection first** (or wait out the eviction) when the
  external tool needs to write.
- **Read without taking the lock** using the package's `readonlyFileSystem`,
  which opens no lock and performs no writes. Read-only tooling can run
  concurrently with a live Studio connection.

## Files this refuses to open, and how it refuses them

Since `@libredb/libredb` 0.2.0 the file boundary is hardened, and the refusals are
precise about what they leave behind. New databases begin with an 8-byte `LRDB`
magic and version header; headerless files written by 0.1.x still open through a
legacy read path, so upgrading Studio does not require migrating anything.

| Kernel code | When | What Studio reports |
| --- | --- | --- |
| `LOCKED` | Another writer holds the exclusive lock | Already open by another process; close the other writer |
| `NOT_A_DATABASE` | The file is not a LibreDB database | Not a LibreDB database; the file is left untouched |
| `UNSUPPORTED_VERSION` | Written by a newer format version | Upgrade `@libredb/libredb`; the file is left untouched |
| `CORRUPT_WAL` | Mid-log corruption | The write-ahead log is corrupt mid-file, plus the kernel detail |

The important word in rows two and three is *untouched*. Point a connection at a
JPEG or at last week's tarball and the kernel refuses it byte-for-byte intact.
Version 0.1.x silently truncated such a file to zero bytes; 0.2.x does not. The
same restraint governs `CORRUPT_WAL`: the kernel declines to destroy data it
cannot parse rather than recovering aggressively over it.

The provider branches on `error.code` via `instanceof lib.LibreDbError`, never on
message text. Messages are free to change between releases; codes are the stable
part, and a mapping built on message matching breaks silently on a patch bump.

One direction is not protected, and it is worth writing down: a file written by
0.2.x must never be opened by 0.1.3 or older. The old recovery path cannot parse
the header, classifies the whole file as a torn tail, and truncates it to zero
bytes. Back up before any downgrade.

## Why a missing path is an error rather than a scratch database

The kernel's `open()` creates an ephemeral in-memory store when given no path,
one that is discarded when the process closes. The provider refuses to use it. A connection with no `database` value
throws `DatabaseConfigError` at `validate()` time, before anything is opened.

That is the second half of the limit this engine publishes: **a missing path is
refused outright rather than silently opening an ephemeral store.** The reasoning
is that an in-memory database offers no durable value to a GUI tool. You would
write keys into it, browse them, close the tab, and lose them with no error at
any point. A connection that succeeds and then discards your work is worse than
one that refuses to be created.

A path that points at a file which does not exist yet is a different case, and it
is allowed: the package creates an empty ordered key-value store there. Naming a
file is a decision; omitting the field is not.

If you want to see the shape of this before deciding on a path, a standalone
Studio instance seeds a connection named "Sample (LibreDB)" on first startup,
covering all three lenses — a relational table, a document collection and raw
key-value keys. `LIBREDB_EMBEDDED_SAMPLE=false` turns it off and
`LIBREDB_EMBEDDED_SAMPLE_PATH` moves the file. The
[getting started guide](/get-started) covers bringing the container up next to
the volume that holds it.
