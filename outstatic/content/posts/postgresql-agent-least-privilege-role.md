---
title: Creating the PostgreSQL role agent mode will accept
status: published
author:
  name: LibreDB
  picture: ''
slug: postgresql-agent-least-privilege-role
description: Agent AUTO mode refuses a superuser connection outright, so the deployment task is a login holding CONNECT, USAGE and SELECT and nothing else.
coverImage: ''
tags:
  - value: engineering
    label: Engineering
  - value: databases
    label: Databases
  - value: security
    label: Security
publishedAt: 2025-12-01T09:00:00.000Z
---

A read-only transaction is not a sandbox. That is the finding the whole
provisioning step rests on, and it is why agent mode makes you create a
dedicated login rather than offering a setting inside the product. Verified on
PostgreSQL 18, inside `BEGIN READ ONLY`, as a superuser:
`COPY (...) TO '<path>'` wrote query results to a server-side file,
`COPY (...) TO PROGRAM '<cmd>'` ran a shell command as the server's OS user, and
`SELECT pg_read_file('<path>')` read a server-side file. None of the three
changed the database, so none of the three was refused.

## Why the agent asks for a second role at all

Agent AUTO mode's read-only boundary on this engine is the database, not a SQL
parser. Every statement runs through `queryReadOnly()`, which issues
`BEGIN READ ONLY`, sets `SET LOCAL statement_timeout` to the run's remaining
budget, sends exactly one statement on the extended query protocol, then
`ROLLBACK` and `DISCARD ALL`. A write is refused by PostgreSQL with SQLSTATE
`25006`; a multi-command string is refused in the Parse message with SQLSTATE
`42601`, before anything executes. No statement is classified in that path,
which is the point - there is no parser to fool.

What that transaction covers is changes to the database. What it does not cover
is a statement reaching the server. The three statements above are the proof.
The transaction also relaxes on request: `SET TRANSACTION READ WRITE` is
accepted inside `BEGIN READ ONLY` and does work, verified on 18 by a following
`INSERT` that committed. What contains it is that it can only ever be the
transaction's only statement before the unconditional rollback. The
single-statement rule is load-bearing, not decorative.

So the file and program statements have to be refused by something else, and on
PostgreSQL the something else is privileges. A role holding only `CONNECT`,
`USAGE` and `SELECT` is denied all three, because each one requires superuser or
membership of a predefined role.

## The privileges the profile probes before it opens

The product does not print this as advice and hope. Opening the agent execution
profile probes the connecting role and refuses to connect at all unless four
answers all read back false:

| Probed | Why it matters |
| --- | --- |
| `rolsuper` | a superuser bypasses every check below |
| `pg_read_server_files` | membership grants `pg_read_file()` and friends |
| `pg_write_server_files` | membership grants `COPY (...) TO '<path>'` |
| `pg_execute_server_program` | membership grants `COPY (...) TO PROGRAM '<cmd>'` |

The refusal is `PROFILE_PRIVILEGES_TOO_BROAD`, an `ExecutionProfileError`
carrying a deny code, so callers branch on the code and never on a message. The
probe uses `to_regrole`, so a server that does not define one of the predefined
roles answers false rather than erroring. A server that answers nothing, or
answers something that is not a boolean, is refused as well: an unproven
boundary is not a boundary.

Every catalog function the probe calls is written `pg_catalog`-qualified.
`pg_catalog` is searched implicitly first only while it is not named in
`search_path`, so a path that names it explicitly behind another schema could
otherwise let a shadow `pg_has_role()` answer false for a superuser and defeat
the check.

Two limits on what the probe proves. It proves non-membership and
non-superuser, not the absence of the capability:
a role directly granted `EXECUTE` on `pg_read_file()` answers false to all four
flags and can still read server files. And it runs once, at open. A profiled
provider stays cached until the 30-minute idle sweep, so a role granted new
privileges after that keeps serving from the already-verified pool until it is
evicted.

## CREATE ROLE, CONNECT, USAGE, SELECT, and nothing else

This is the whole deployment task.

```sql
CREATE ROLE libredb_agent LOGIN PASSWORD '<secret>';
GRANT CONNECT ON DATABASE <db> TO libredb_agent;
GRANT USAGE ON SCHEMA <schema> TO libredb_agent;
GRANT SELECT ON ALL TABLES IN SCHEMA <schema> TO libredb_agent;
-- Grant nothing else. In particular do NOT grant pg_read_server_files,
-- pg_write_server_files, pg_execute_server_program, or superuser.
```

The grants are also the read boundary, not only the write one. The policy layer
screens the catalog and schema an agent *declares* it is reading; the per-table
`SELECT` grants are what bound what a hostile statement could actually reach
instead. A table you do not grant is a table no run can read, whatever it asks
for.

One consequence of running this narrow: the agent's
relations inventory reads `pg_constraint` rather than the `information_schema`
constraint views, because PostgreSQL restricts those views to constraints on
tables the role owns or holds a privilege on other than `SELECT`. Against a
seeded dvdrental, `libredb_agent` read an empty foreign-key graph from those
views, where `pg_constraint WHERE contype = 'f'` holds 18 rows. The column
inventory is still the privilege-filtered one, and that is correct rather than a
defect: the agent should see the tables you granted it and no others.

## Why a superuser connection is refused rather than downgraded

The obvious alternative is to accept the superuser connection you already have
and drop privileges for the duration of the run. The product does not, and the
reason is the three statements this post opens with. Every mechanism available
for that downgrade - the read-only transaction, a session `SET`, a wrapper
around the statement text - is either something a single statement can undo or
something that never covered `COPY ... TO PROGRAM` in the first place. A
boundary you can talk your way out of inside one statement is not one worth
shipping under the word read-only.

Agent AUTO mode runs on PostgreSQL, SQLite and DuckDB only, because the
read-only profile is database-native and exists only where a provider implements
it. Even on PostgreSQL, a superuser connection is refused with
`PROFILE_PRIVILEGES_TOO_BROAD`. On every other engine an auto run ends
`engine-unsupported`. Agent PLAN mode opens on every connection: it is toolless,
it executes nothing, and it drafts a statement for a human to run.
Those two modes are not degraded versions of each other.

There is a second, quieter reason. `queryReadOnly()` exists only on a provider
opened under the profile - called on an ordinary provider it throws, because
such a provider has had no role verification. The profiled cache is physically
separate from the editor's, so an agent acquisition can never be handed the
editor's pool.

## Checking the role from the connection dialog

The connection carries two optional fields, `agentUser` and `agentPassword`, so
the agent can authenticate as `libredb_agent` while the editor keeps the
credentials it already has. `agentPassword` is secret-classified and sealed at
rest. Resolution fails closed rather than quietly using the better-privileged
default:

| Configuration | Outcome |
| --- | --- |
| Neither field set | the connection's own credentials, which must pass the probe themselves |
| Both set, password resolves | the profile pool authenticates as `agentUser` |
| Only one field set | `AGENT_CREDENTIAL_UNRESOLVABLE` |
| Sealed password that does not open | `AGENT_CREDENTIAL_UNRESOLVABLE` |
| Either field beside a `connectionString` | `AGENT_CREDENTIAL_WITH_CONNECTION_STRING` |

The last row is worth knowing before you paste a URL: when a connection string
is present it wins over the discrete fields, so the pool config would silently
drop the agent credential. That is refused instead.

You can predict the probe's answer before you open anything. Connect as the role
you intend to hand the agent and ask the same four questions the profile asks:

```sql
SELECT rolsuper,
       pg_catalog.pg_has_role(current_user, 'pg_read_server_files', 'member')
         AS read_files,
       pg_catalog.pg_has_role(current_user, 'pg_write_server_files', 'member')
         AS write_files,
       pg_catalog.pg_has_role(current_user, 'pg_execute_server_program', 'member')
         AS exec_program
FROM pg_catalog.pg_roles
WHERE rolname = current_user;
```

Four falses and the role clears the privilege probe. Anything else and the open
is refused with `PROFILE_PRIVILEGES_TOO_BROAD`, which names the check that
failed but not which of the four answers tripped it - the query above is how you
find that out. The rest of what agent mode does - the metering,
the citation rule, the verdict - is on the [features page](/features); what the
run is allowed to touch and what it records is on the
[security page](/security); and which engines carry the profile at all is on the
[engine grid](/databases).
