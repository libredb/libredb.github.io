---
title: Two controls, because one was not enough on SQLite
status: published
author:
  name: LibreDB
  picture: ''
slug: sqlite-agent-read-only-two-controls
description: A read-only open reads the query-only pragma back as off, so the profile sets it too and re-verifies it before every statement it sends.
coverImage: ''
tags:
  - value: engineering
    label: Engineering
  - value: databases
    label: Databases
  - value: security
    label: Security
publishedAt: 2025-12-13T09:00:00.000Z
---

Open a SQLite read-only connection, then read `PRAGMA query_only` back from it. It
answers `0`. The handle will refuse every write you send it, and the pragma whose name
suggests it would say so is off. Both adapters behave this way - `bun:sqlite` and
`node:sqlite`, the two runtime built-ins the driver adapter selects between. Nothing is
broken. The open flag and the pragma are two different mechanisms, and setting one does
not set the other.

That read-back is why the second of agent AUTO mode's two controls on SQLite is set
explicitly and verified rather than inherited from the open, and why it is re-checked
before every statement instead of once at connect. Why there is a second control at all
is a different question, and `VACUUM INTO` is the answer.

## A second handle, physically separate

PostgreSQL establishes read-only enforcement per transaction. SQLite has no such
construct, so the boundary has to be established at open time instead. The agent's
read-only profile does not borrow the shared, writable provider the editor uses. It
acquires a dedicated provider keyed by connection id and execution profile, and that
provider opens a second, physically separate handle to the same file with SQLite's own
read-only flag - `readonly` under `bun:sqlite`, `readOnly` under `node:sqlite`, mapped
by the driver adapter.

Everything that follows from that flag comes from the engine, not from inspecting SQL
on the way past. Writes are refused. DDL is refused. A missing file is not created,
because no `create` flag is passed. The read-only open also skips the normal connect
sequence deliberately: no parent directory is made, and `journal_mode = WAL` is not
run, because setting that pragma is itself a write and fails outright on a read-only
handle.

The intent has to reach the constructor, since the flag is an open option and not a
runtime call. It travels in a server-injected third constructor argument rather than
in the caller-supplied options object. That placement is the point: options flow in
from whoever assembles a request, so a profile flag living there could be set - or
cleared - by that caller. Only the profile acquisition path passes the context, and a
test pins that the shared path stays writable when a caller tries to smuggle the flag
through options.

One target is refused outright. An in-memory database cannot be vended under this
profile, because a read-only open of an anonymous database yields an empty one under
`node:sqlite` and fails outright under `bun:sqlite`. The refusal is an
`ExecutionProfileError` with reason code `PROFILE_UNSUPPORTED_TARGET`, so a caller
branches on the code rather than parsing a message.

## Why a SQLite read-only connection needs query_only as well

The read-only open governs the target database file, and only that file.

`VACUUM INTO '<path>'` does not write to the target. It copies the whole database to
some other path on the server filesystem, and it succeeds from a read-only handle on
both adapters. The open flag has nothing to say about it, because nothing about it
touches the file the flag was applied to.

So the profile sets `PRAGMA query_only` as well, and verifies the read-back rather
than assuming the set took - `assertQueryOnlyEnabled` refuses the handle if the value
comes back wrong. The two controls cover different ground and neither is redundant:
the open refuses writes to the target database, `query_only` refuses writes to
anything else. The integration suite asserts both, including the `VACUUM INTO` case
run with `query_only` deliberately turned off first, so the test would notice if the
open flag were quietly doing that job.

The verification runs before every statement, not once at connect, for two reasons.
The profiled provider is pooled and reused across an agent run, so state set on it
persists. And a statement is free to contain `PRAGMA query_only = false` - nothing in
the engine parses that as special. Without a re-check, one such statement would leave
the pragma off for every later call on that connection.

## Compiling one statement, never executing a string

Statements under the profile are compiled with `prepare()`, never `exec()`.

The difference decides what a multi-statement string does. `exec()` runs every
statement in it. `prepare()` compiles only the first and drops the tail, so a
`SELECT 1; PRAGMA query_only = false` never reaches its second half, and the disable
and the write it would enable can never ride in the same call. The next call
re-asserts the pragma before running anything.

This is also why silent truncation is not treated as a pass. Rejecting
multi-statement input outright remains the policy pipeline's job upstream; `prepare()`
is what makes a failure of that layer non-catastrophic rather than what makes it
acceptable.

The same reasoning shapes how the agent reads the catalog. The obvious statement for a
column list is `SELECT ... FROM pragma_table_info('t')`, and the statement guard
refuses it - it rejects any word starting `PRAGMA_`, because SQLite exposes pragmas as
table-valued functions and some of them set values. `pragma_query_only(0)` is one, and
it was found while reviewing this profile. So the catalog read composes against
`sqlite_master` instead, and the column list is parsed out of each object's stored
`CREATE TABLE` text.

## The copy that still creates a file

`query_only` refuses the `VACUUM INTO` copy, and SQLite creates the destination file
before refusing it. That is the first of the two gaps. An agent-composed path can
therefore cause a zero-byte file to appear anywhere the Studio process can write.

No data reaches that file. The integration suite asserts this by file size on both
adapters rather than by existence, because "the file is not there" is the claim that
would be false and "the file is empty" is the one that is true. Closing the gap
properly would need an authorizer callback, and `bun:sqlite` does not expose one at
all, so there is no control that holds on both adapters.

## The attach that still succeeds, and where it is stopped

`ATTACH` of a missing file fails and creates nothing. `ATTACH` of an existing file
succeeds on a read-only handle, and the attached database inherits the read-only mode,
so writes through it are refused. Both are asserted in the suite.

Its rows do become readable. That is the second gap. Neither adapter offers a
database-native control that would stop it: `bun:sqlite` exposes no authorizer
callback, which makes `node:sqlite`'s `setAuthorizer` unusable as a cross-adapter
control. Out-of-scope reads through `ATTACH` are consequently held off at the input
stage, by the denial in the statement guard - defense in depth carrying a gap the
engine leaves, and explicitly not a containment boundary. The residual risk follows
from that description: a statement that reached the profile with the guard layer
bypassed could read any SQLite file the server process can open.

The profile does not, then, amount to the engine containing the agent. Two gaps stay
open at the engine level: a copy statement creates a zero-byte destination file at any
writable path before it is refused, and attaching an existing file succeeds on a
read-only handle, so both are held off at the input stage rather than by the engine.

The related boundary is that SQLite validates a path only for a NUL byte, and `..`
segments simply resolve. On a shared self-hosted instance, any logged-in user can open
any SQLite file the Studio process can read; the mitigations available today are
OS-level - the process user, the container mount - and an optional base-directory
allowlist is tracked as an open issue. That, and the rest of what this profile does
not cover, is written down on the [security page](/security) rather than left for a
reader to infer.

None of this transfers to libSQL. It speaks SQLite's dialect over a network protocol
and refuses `PRAGMA query_only`, so agent AUTO mode does not extend to it. AUTO runs
on PostgreSQL, SQLite and DuckDB only, because those are the three providers that
implement a database-native read-only path; anywhere else a run ends
`engine-unsupported`. PLAN mode opens on every connection - it is toolless, executes
nothing, and drafts a statement for a human to run. The difference between the two
modes, and the rest of what agent mode does with the handle it gets, is on the
[features page](/features).
