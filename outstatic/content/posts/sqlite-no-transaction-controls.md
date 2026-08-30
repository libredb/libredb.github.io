---
title: Why the SQLite editor has no transaction controls
status: published
author:
  name: LibreDB
  picture: ''
slug: sqlite-no-transaction-controls
description: The provider holds no session across two requests, so the begin, commit and rollback controls are withheld rather than offered and then failed.
coverImage: ''
tags:
  - value: engineering
    label: Engineering
  - value: databases
    label: Databases
publishedAt: 2026-03-17T09:00:00.000Z
---

Open a SQLite connection in Studio and the editor toolbar is missing a group of
buttons you will find on the PostgreSQL connection next to it. There is no BEGIN,
no COMMIT, no ROLLBACK, and no SANDBOX toggle. The reason is not that SQLite
lacks transactions. SQLite has `BEGIN`. The provider does not have a session to
run it in.

## What a transaction control has to hold open

A transaction is a property of a connection, not of a statement. Press BEGIN in
an editor and something has to stay open: an engine-side session with an
uncommitted transaction on it, held between the request that opened it and the
request that ends it. Every statement you type afterwards has to be routed onto
that exact session, and no other. ROLLBACK is only meaningful if the same handle
is still there to receive it.

The SANDBOX toggle is the same object with a different label. It wraps whatever
you run in a transaction that is rolled back automatically instead of committed,
which is how you see what a `DELETE` would do without keeping it. It has the same
requirement: one session, held across several HTTP requests, addressed by
identity.

So the question is not whether the engine supports transactions. It is whether
the provider can address a session across two requests. On SQLite it cannot.

## Why no session survives between two requests

The SQLite provider is a single embedded handle. It opens the database file with
the runtime's built-in driver - `bun:sqlite` under Bun, `node:sqlite`
(`DatabaseSync`) under Node, selected at connect time by the `sqlite-driver`
adapter. There is no network protocol, no port, no server process. The connection
is a server-local file path resolved inside the Studio process, and
`getCapabilities()` reports `defaultPort: null` to say so.

There is also no pool. Every networked SQL provider here has one, and a pool is
what makes a held transaction addressable: you check out a client, pin it for the
life of the transaction, and check it back in. SQLite exposes no
`getPoolStats`, because there is nothing to report on. `query()` opens on the
one handle, branches on whether the statement reads or writes, and returns rows
from `stmt.all()` or `{ changes }` from `stmt.run()`. Between two API calls, no
state that a `BEGIN` would have left behind is guaranteed to still be yours.

That is why the provider implements no `beginTransaction`, `commit`, `rollback`
or `queryInTransaction` at all, and why `POST /api/db/transaction` does not apply
to a SQLite connection. **Transactions are not exposed on SQLite: the BEGIN,
COMMIT and ROLLBACK controls and the auto-rolled-back SANDBOX toggle are
withheld, and there is no query cancellation, because the drivers are synchronous
and embedded.**

## Withholding a control instead of failing it

None of that is new. What changed is who knows about it.

Before the capability flag existed, the only gate was a runtime shape check
inside the API route - does this provider object implement the transaction
interface. That check runs on the server. The browser cannot read it. So the
toolbar rendered the full transaction group on every connection, including this
one, and the route answered HTTP 400 when you pressed a button.

That is the failure mode worth naming: render the union of every engine's
controls and let the difference arrive as a server error. The cost lands on the
person clicking, who has an HTTP 400 that does not distinguish "this engine
cannot do this" from "your statement is wrong" or "the connection dropped".

`getCapabilities()` now declares `supportsTransactions: false` for SQLite, the
client reads the declaration, and the controls are absent rather than present and
broken. The flag describes the provider's surface, not the engine's grammar -
that distinction is written into the capability table in the provider doc,
because the two are genuinely different claims and conflating them would make the
flag a lie about SQLite. This is the same rule the rest of the interface follows:
a control that cannot work is [absent with its reason published](/features),
not disabled and not silently missing.

## The cancel path that does not exist either

The same reasoning removes a second button, and it is worth following because the
mechanism is different.

PostgreSQL cancels a running query by recording its backend PID when the query
is issued, then calling `pg_cancel_backend` on a second, pooled client. That
works because the statement is executing in another process, reachable by PID,
while the cancel request travels over a connection of its own.

SQLite has no other process. Both drivers are synchronous: the statement runs
inside the Studio runtime, on the thread that called it, and the provider wraps
it in an async signature over a call that was never concurrent. There is nothing
running in parallel to send a message to. Interrupting it would need
`sqlite3_interrupt` or a progress handler, and neither adapter exposes one -
`bun:sqlite` does not offer an authorizer or interrupt surface at all. So there
is no `cancelQuery`, and `POST /api/db/cancel` does not apply here either.

The agent runtime meets the same wall from the other side. A statement budget's
`statementTimeoutMs` is enforced on SQLite as a post-execution deadline: an
overrunning statement runs to completion and its result is then refused, rather
than being returned as if it had been within budget. It is not preemption, and
anything that displays that budget has to say so rather than imply otherwise. A
long statement blocks the runtime while it runs, for exactly the reason above.

## What the editor gives you instead

The absent controls are a small part of the surface. What SQLite does declare:

| Capability | Value on SQLite |
| --- | --- |
| `supportsExplain` | `true`, `explainFormat: "sqlite-queryplan"` |
| `supportsInlineRowEdit` | `true` |
| `supportsTransactions` | `false` |
| `supportsConnectionString` | `false` |
| `defaultPort` | `null` |
| `maintenanceOperations` | `vacuum`, `analyze`, `reindex`, `check` |

`EXPLAIN QUERY PLAN` is rendered as a tree. SQLite reports no per-node cost, row
estimate or timing, so no metrics are drawn beside the steps - the tree shows
what the engine said and stops there. Inline row editing works, because
`UPDATE t SET c = v WHERE pk = v` is core SQLite DML. Bare `SELECT`s get a
`LIMIT` injected before they run, at the shared default of 500 rows, so a
full-table read in a scratch tab comes back bounded.

Agent AUTO mode runs here. SQLite is one of the three engines where it does -
PostgreSQL and DuckDB are the others, because those three are the providers that
implement `queryReadOnly`; on any other engine an auto run ends
`engine-unsupported`, and PLAN mode, which is toolless and executes nothing,
opens everywhere. AUTO mode reaches the missing session from a different
direction. Instead of a held transaction, the read-only profile opens a second,
physically separate handle to the same file with SQLite's own read-only flag,
then sets
`PRAGMA query_only` and verifies the read-back at open and before every
statement - because a read-only open alone reads `query_only` back as `0`. That
is enforcement established at open time rather than per transaction, which is
what an engine with no session construct leaves available - the same absence
that empties the toolbar.

For the safety a SANDBOX toggle would have given you, the honest substitutes are
the ones the file model already offers: point the connection at a copy of the
file, or at `:memory:` for a scratch database that is discarded on disconnect.
Neither is a rollback. Saying so is cheaper than a button that answers 400. The
per-engine capability lines, including this one, are published on the
[engine pages](/databases) rather than discovered at runtime.
