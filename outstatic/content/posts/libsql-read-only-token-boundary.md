---
title: 'On libSQL: read-only is a credential you create'
status: published
author:
  name: LibreDB
  picture: ''
slug: libsql-read-only-token-boundary
description: The server refuses the pragma a database-native read-only profile depends on, so the boundary moves from the session to the token the database issues.
coverImage: ''
tags:
  - value: engineering
    label: Engineering
  - value: databases
    label: Databases
  - value: security
    label: Security
publishedAt: 2026-02-01T09:00:00.000Z
---

On libSQL the read-only boundary is a credential rather than a session setting. It is
minted with the `turso` CLI before anything connects, and it is not one the
application can put in place for you. The reason is a single refused statement.

## What a database-native read-only profile needs

The agent AUTO run in LibreDB Studio is metered and tool-using: it drafts SQL, reads
what comes back, and cites the result behind every claim. The thing that makes it
safe to point at a production database is not the model and not a statement parser.
It is that the connection it holds cannot write, and that the engine is the one
saying so.

Three providers implement that, and each does it with a lever the engine itself
publishes:

| Engine | The lever |
| --- | --- |
| PostgreSQL | A read-only transaction |
| SQLite | `PRAGMA query_only`, re-asserted and read back per statement |
| DuckDB | A `READ_ONLY` handle plus an SQL guard |

The shared requirement is that the refusal comes from the database. A parser that
inspects a string before sending it is guessing about a dialect it does not execute;
`VACUUM INTO '<path>'` is the example that made the point on SQLite, because it reads
as a read and writes a file. The SQLite provider refuses it because the handle
refuses it, not because a regular expression recognised it.

So `queryReadOnly` is a provider method, and a profiled acquisition on a provider
that does not implement it throws `PROFILE_UNSUPPORTED_BY_PROVIDER` rather than
falling back to something softer. There is no soft version of this.

## The statement this server refuses

libSQL is a fork of SQLite that keeps the file format and the dialect and adds a
server. What a client talks to is `sqld`, and what `sqld` speaks is Hrana: a list of
requests posted as JSON to `POST /v2/pipeline`, one result per request. Turso Cloud
is that same server, managed, reached over TLS on a hostname that identifies the
database. One type-id covers both, because every statement and every refusal measured
the same on each.

Including this one:

```sql
PRAGMA query_only = true;
```

On a self-hosted `sqld 0.24.33` that comes back as `unsupported statement`. On Turso
Cloud the same refusal is worded `SQL not allowed statement`. Both arrive under one
error code, and both arrive with an HTTP 200 — in Hrana, `response.ok` reports that
the pipeline was accepted, never that a statement inside it ran, so every failure is
read out of `results[]`.

It is not alone. The server keeps a statement allowlist, and four more statements
fall outside it on both deployments:

| Statement | Result |
| --- | --- |
| `VACUUM` | refused |
| `ANALYZE` | refused |
| `PRAGMA optimize` | refused |
| `PRAGMA wal_checkpoint(TRUNCATE)` | refused |
| `PRAGMA query_only = true` | refused |
| `REINDEX` | accepted |
| `PRAGMA integrity_check` | accepted |

Those measurements are dated: `sqld 0.24.33` and one Turso Cloud database in
`aws-eu-west-1`, both probed on 2026-08-27, then re-probed against the pinned
`v0.24.33` image, a different build of the same version. They are measurements, not a
supported range.

Two consequences follow immediately. The maintenance toolkit here offers `reindex`
and `check` and nothing else, and it refuses the other operations in the provider
rather than relaying a server error for a statement you never typed. And the
read-only profile has nothing to stand on.

## Why no profile can be built on top of that

The tempting move is to build the missing lever in the application: parse the
statement, decide whether it writes, send it only if it reads. Three reasons that is
not available here, and the third settles it.

**A parser is a second dialect implementation.** It has to agree with the engine
about every form the engine accepts, forever, including the ones that read like
reads. Where the two disagree, the disagreement is silent.

**Hrana holds no session to configure.** This provider closes its stream in the same
request as the statement, which is also why transactions are not exposed and the
transaction controls stay hidden. There is no place to set a mode once and rely on it
for the statements that follow, because there is no "following" — each statement is
one stateless HTTP request.

**A fake boundary is worse than an absent one.** The [capability model this site
publishes](/features) exists so a control that cannot work is absent with its reason
written where it would have been, rather than offered and then failed. A read-only
profile that was enforced by our parser instead of the database would pass a demo and
misdescribe itself in the only sentence anyone would rely on: that the database
cannot write.

So the boundary is stated flatly. **`PRAGMA query_only` is refused by the server, so
this provider implements no read-only path, and an agent AUTO run on libSQL ends
`engine-unsupported`. Plan mode opens here, is toolless, and drafts a statement for a
human to run.** An AUTO run is not degraded, not slower, not partially tool-using. It
does not run.

## The engine's own answer: a read-only token

libSQL does have a read-only boundary. It is a credential, not a statement.

```bash
turso db tokens create <database>              # full access
turso db tokens create <database> --read-only  # read-only
```

The API can also set `block_writes` on a database directly. Either way the enforcing
party is the server, and what it checks is the credential rather than the statement.
What changed is who creates the boundary and when. A pragma is set by the client at
connect time. A token is minted beforehand and handed over already narrowed.

This fits the rest of the connection shape here. libSQL has no user names. There is
no `user` field and no `database` field in the connection dialog, because the database
is the host and the credential is an auth token sent as `Authorization: Bearer`. The
connection string the CLI prints carries it inline:

```
libsql://<database>-<org>.turso.io?authToken=<jwt>
```

An identity system with no users puts everything into the token. Permissions
included. Once that is true, "make this session read-only" was never going to be a
statement — it was always going to be which token you pasted.

The practical version, for an operator who wants a narrowed connection in the app:
mint a read-only token, paste that URL into a separate connection, and let the server
enforce it. The application does not need to know. That is a connection-level control
and it applies to everything running through it — the editor, the browser, row
editing — not only to an agent run. It also means the boundary does not depend on our
code being correct, which is the distinction [the security page](/security) draws when
it says a display control is not a boundary.

## What plan mode still does here

Agent PLAN mode opens on every connection, including this one. It is toolless: it
executes nothing, touches no driver, and spends no budget, because there is no
statement to meter. What it produces is a drafted statement, grounded in the schema
the provider describes, for a human to read and run.

Grounding is not a weaker word here. The schema libSQL answers is plain SQL and it is
complete: `sqlite_master` for tables, `pragma_table_info` for columns,
`pragma_index_list` and `pragma_index_info` for indexes, `pragma_foreign_key_list`
for relations, and `dbstat` for bytes. That last one answers on both deployments, so
table and index sizes here are measured rather than absent. A whole schema read is
three round trips regardless of table count, plus one for sizes, because Hrana takes a
list of requests.

So a plan on libSQL knows your tables, your columns, your declared foreign keys and
your row counts. It drafts against them, then stops. You press Run, or you do not.

That split is the same everywhere: AUTO mode needs a boundary the database enforces,
and runs on PostgreSQL, SQLite and DuckDB only. Plan mode needs a schema, and every
engine has one. libSQL sits on the plan side of that line because of one refused
pragma, and the credential that replaces it is issued by the same server for the same
purpose — just earlier, and by you.
