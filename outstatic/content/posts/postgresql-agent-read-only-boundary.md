---
title: Where the read-only boundary lives on a PostgreSQL agent run
status: published
author:
  name: LibreDB
  picture: ''
slug: postgresql-agent-read-only-boundary
description: Containment is the database itself - a read-only transaction, exactly one statement on the extended protocol, then ROLLBACK and DISCARD ALL.
coverImage: ''
tags:
  - value: engineering
    label: Engineering
  - value: databases
    label: Databases
  - value: security
    label: Security
publishedAt: 2026-01-18T09:00:00.000Z
---

One way to give an LLM agent read-only database access is a regular expression
over the statement text: look for INSERT, UPDATE, DELETE and DROP, let everything
else through. It holds until the first statement written to look like something it
is not. On PostgreSQL, LibreDB Studio has no such classifier on the agent path.
`queryReadOnly()` sends the statement to the server and lets the server refuse it.

## A parser is not a boundary

A SQL classifier has to be right about every statement an attacker can write, in
a grammar it does not own, on a version it was not tested against. The server has
to be right about one thing it already enforces for its own correctness. Those are
not comparable positions.

The concrete failure is not exotic. PostgreSQL supports data-modifying CTEs, so
`WITH t AS (DELETE FROM audit RETURNING *) INSERT INTO audit_archive SELECT * FROM t`
leads with the keyword `WITH` and reads as a query to anything matching on the
first word. LibreDB's own statement classifier had to learn that lesson elsewhere:
the editor's automatic `LIMIT` injection types a `WITH` statement by the keyword
that follows its CTE list - the statement the server actually executes - because
before that the appended bound applied to the rows the statement *wrote*,
committing at most the default page size of 500 of them while reporting the result
as merely truncated. That classifier is good enough to decide where to append a
`LIMIT`. It is not what the agent path trusts with the question of whether a
statement may run.

So `queryReadOnly()` classifies nothing. The provider it lives on is acquired per
(connection id, execution profile) from a cache that is physically separate from
the editor's, so an agent execution can never be handed the editor's writable
pool. Called on an ordinary provider, `queryReadOnly()` throws, because such a
provider has had no role verification behind it.

## What read-only database access for an LLM agent actually sends

Every statement on the agent path is wrapped in the same sequence:

```sql
BEGIN READ ONLY;
SET LOCAL statement_timeout = <budget.statementTimeoutMs>;
-- the single statement, sent on the extended query protocol
ROLLBACK;
DISCARD ALL;
```

`BEGIN READ ONLY` is what makes PostgreSQL answer SQLSTATE `25006` - *cannot
execute ... in a read-only transaction* - to a write. That error comes from the
server, not from the tool.

`SET LOCAL statement_timeout` dies with the transaction, so no session state
leaks into the next statement. The value is clamped to the run's remaining wall
clock before it is interpolated, so a statement cannot outlive the run that asked
for it. It is interpolated rather than bound because `SET LOCAL` takes no bind
parameters, which is why the budget fields are validated as positive integers
before any pool client is acquired.

`ROLLBACK` is unconditional. The profile has no commit path at all.

`DISCARD ALL` runs after the rollback, because it cannot run inside a transaction
block. A rollback is not a full session reset: an advisory lock taken inside the
transaction survives it, verified on PostgreSQL 18, and nothing on the agent path
is required to release one. Without `DISCARD ALL` a pooled client would carry that
lock into every later execution. A client that fails either cleanup step is
destroyed rather than returned to the pool.

## Why exactly one statement is load-bearing

The statement is sent with `queryMode: 'extended'`. On the extended query
protocol the server refuses a multi-command string in the Parse message with
SQLSTATE `42601`, before executing anything.

That is the difference between a boundary and a suggestion. On the simple query
protocol, `SELECT 1; COMMIT; INSERT INTO ...` is one string containing three
commands, and the `COMMIT` ends the read-only transaction that was supposed to be
containing the third one. Nothing about `BEGIN READ ONLY` stops that. What stops
it is that the string never parses.

The single-statement rule is load-bearing rather than decorative, and here is why.
**`SET TRANSACTION READ WRITE` is accepted inside `BEGIN READ ONLY` and does relax
the transaction** - verified on PostgreSQL 18, where a following `INSERT`
committed. What contains it is the protocol-enforced single statement plus the
unconditional `ROLLBACK`, not the read-only transaction alone. A session-level
`SET` reverts with the rollback, since GUC changes are transactional. A bare
`COMMIT` merely ends an empty read-only transaction.

## What a read-only transaction does not stop

A read-only transaction forbids changing the database. It does not forbid a
statement from reaching the server. Three statements, all verified as succeeding
inside `BEGIN READ ONLY` on PostgreSQL 18 as a superuser:

| Statement | What it did |
| --- | --- |
| `COPY (...) TO '<path>'` | wrote query results to an arbitrary server-side file |
| `COPY (...) TO PROGRAM '<cmd>'` | ran a shell command as the server's OS user |
| `SELECT pg_read_file('<path>')` | read an arbitrary server-side file |

None of the three writes to a table, so none of the three is a write as far as
`25006` is concerned. The transaction is the wrong layer to be asking.

## How this composes with the least-privilege role

A role holding only `CONNECT`, `USAGE` and `SELECT` is refused all three - by
privileges, not by the transaction. So the profile does not offer that as advice.
It probes the role when the connection opens and refuses with
`PROFILE_PRIVILEGES_TOO_BROAD` unless superuser and membership of
`pg_read_server_files`, `pg_write_server_files` and `pg_execute_server_program`
all read back false. A server that answers nothing, or answers non-booleans, is
refused too. Every catalog function in the probe is written `pg_catalog`-qualified,
because a `search_path` that names `pg_catalog` explicitly behind another schema
would let a shadow `pg_has_role()` answer false for a superuser. The probe runs
once, at open: a profiled provider stays cached until the idle sweep, so a role
granted new privileges afterwards keeps serving from the already-verified pool
until that entry is evicted.

The recipe the probe expects:

```sql
CREATE ROLE libredb_agent LOGIN PASSWORD '<secret>';
GRANT CONNECT ON DATABASE <db> TO libredb_agent;
GRANT USAGE ON SCHEMA <schema> TO libredb_agent;
GRANT SELECT ON ALL TABLES IN SCHEMA <schema> TO libredb_agent;
-- Grant nothing else.
```

Two consequences worth stating plainly. A superuser connection cannot run agent
AUTO mode at all, so pointing the agent at your existing admin credentials fails
at open rather than at the first statement. And what the probe proves is
non-membership and non-superuser, not the absence of the capability: a role
directly granted `EXECUTE` on `pg_read_file()` answers false to all four flags and
can still read server files. That is what "grant nothing else" is carrying.

The per-table `SELECT` grants are also what bound which rows a run can reach. The
policy layer's catalog and schema allowlist screens the target the agent
*declared*; only the grants bound what a hostile statement could touch instead.

This is the AUTO path - the metered, tool-using run, which exists on PostgreSQL,
SQLite and DuckDB only, because the read-only profile is database-native and
exists only where a provider implements it. PLAN mode opens on every connection: it
is toolless, executes nothing, and drafts a statement for a human to run. The
[agent mode entry in the feature list](/features) states that boundary, and
[the security page](/security) publishes the known limitations next to the
controls, which is where the `SET TRANSACTION READ WRITE` result belongs as much
as it belongs here.
