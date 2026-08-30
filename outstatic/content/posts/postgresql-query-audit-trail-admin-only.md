---
title: The admin-only audit trail of executed queries
status: published
author:
  name: LibreDB
  picture: ''
slug: postgresql-query-audit-trail-admin-only
description: A searchable history of statements, outcomes and error detail, readable by admins only, and on this engine it also records what the agent was permitted to run.
coverImage: ''
tags:
  - value: engineering
    label: Engineering
  - value: security
    label: Security
publishedAt: 2026-08-25T09:00:00.000Z
---

An incident review arrives at the same three words: who ran that. PostgreSQL can
answer it, but only if somebody configured the server to record statements before
the one you are asking about ran. A self-hosted query audit log inside the tool
answers from the other side: it records what was run through Studio, with the
outcome and the error detail, and it is readable by admins only.

That is a smaller claim than a server-side audit extension makes, and it is
deliberately a different one. The trail is application-level and
engine-independent: the same record shape on PostgreSQL as on Redis, because it is
written by the application, not by the engine.

## What the trail records, statement by statement

There are two records with two different lifetimes.

The per-statement history record is written for a statement run from the editor.
Its fields are the ones an incident actually asks for:

| Field | What it holds |
| --- | --- |
| `query` | the statement text as sent |
| `executedAt` | the timestamp |
| `executionTime` | measured duration in milliseconds |
| `status` | `success` or `error` |
| `rowCount` | rows returned, where the engine reported one |
| `errorMessage` | the failure text, when the status is `error` |
| `connectionId`, `connectionName`, `tabName` | which connection and which tab |

Source: `QueryHistoryItem` in `src/lib/types.ts`. History lives in the `history`
collection, capped at 500 entries and held per user in the server storage table
where server storage is configured.

The audit event is the server-side record, and it is a different structure:
`type`, `action`, `target`, `connectionName`, `user`, `result`, `duration`,
`details`, `reason`, and `correlationId` for the agent path. Event types include
`maintenance`, `kill_session`, `connection_test`, `masking_config`,
`threshold_config`, `agent_operation`, and the authentication events -
`login_success`, `login_failure`, `logout`, `permission_denied`,
`rate_limit_exceeded`. The buffer holds 1000 events and filters on type, result,
connection name and a `since` timestamp. `GET /api/admin/audit` takes a `type`,
and a `limit` that defaults to 100 and applies to the unfiltered read.

Two details in that structure are constraints rather than features. `reason` is
a closed union of typed codes, never free text, so a refusal is recorded as
`insufficient_role` or `agent_risk_exceeds_policy` rather than as the driver's
own sentence. The fields that stay free text pass one sanitiser first: a URI-shaped credential is collapsed to its scheme and host,
and the value is bounded to 254 characters. It does not walk nested keys, so it bounds a record's shape
rather than promising that nothing sensitive reaches a `details` string. And
`ip` is derived from forwarded headers and documented in the source as a hint,
not an identity - `X-Forwarded-For` is attacker-controlled, and nothing in the
product makes an authorization decision from it.

## Why a self-hosted query audit log is admin-only

A statement is not metadata. It names tables and columns, and its `WHERE` clause
frequently carries the literal values someone was looking up, so a history of
statements is a second copy of a slice of the data, held under different access
rules than the database's. Handing that to every reader would be a quiet
privilege escalation.

So the read surface is one endpoint with one rule. `GET /api/admin/audit` checks
the role in the handler itself, and returns `403` whether the caller had no
session at all or a valid session with the wrong role; the response does not
distinguish the two. The proxy in front of it gates the `/admin` pages rather
than this path, and the source says so plainly: middleware is an optimisation,
not the authorization boundary. A caller that presents a valid login and the
wrong role does leave a `permission_denied` event with reason
`insufficient_role`, metered per account so that polling the endpoint in a loop
cannot flush the ring buffer. The maintenance toolkit is governed by the same
rule for the same reason: `POST /api/db/maintenance` runs `VACUUM ANALYZE`,
`ANALYZE`, `REINDEX` and `pg_terminate_backend(<pid>)`, and the operator who can
terminate a backend is the operator who is already trusted to read what everyone
ran.

There is one more rule that exists because evidence you can write is not evidence.
`POST /api/admin/audit` appends to the in-app buffer and deliberately does not
reach the stdout channel: its body is client-supplied, and giving it the
authoritative channel would let an admin session forge an indistinguishable log
line. Authoritative events are emitted as one structured JSON line on stdout, into
whatever already collects your container logs. The rest of the control set is on
[the security page](/security), stated with its gaps.

## Application history is not a database audit extension

Here is the limit, flatly. The audit trail and the maintenance toolkit are
admin-only, and the trail is application-level history of statements run through
Studio - not a database-native audit facility covering everything that touched the
server. A `psql` session, a migration runner, a cron job, the application's own
ORM: none of them appear in it, because none of them went through the application
that writes the record.

Database-native coverage on PostgreSQL is server configuration and extensions, and
Studio reads those rather than replacing them. Slow-query history needs
`pg_stat_statements`; without the extension the slow-query view falls back to a
live `pg_stat_activity` snapshot and health returns a single placeholder row
reading "pg_stat_statements extension not enabled" rather than an empty list that
would read as "no slow queries".

The in-app ring buffer carries a second boundary: it is per-process. Restart the
container, or run more than one replica, and the buffer is not the record - the
stdout line is. If you need retention past 1000 events, that is a decision about
your log store, not a setting in the product.

## What it covers on an engine where the agent can execute

PostgreSQL is one of the three engines where agent AUTO mode runs, and that
changes what the trail contains. Every statement the agent sends passes through
`executeAuditedOperation` before the driver is touched: a policy decision event is
recorded first, then an execution-outcome event, both sharing one
server-generated `correlationId`. A refusal emits the decision event alone with a
typed `agent_*` reason code. The emission is not wrapped in a try/catch, so an
execution that cannot be audited does not run.

What those events carry is narrow by design: the registry-resolved operation id,
an `agent:<role>` actor label, the outcome, the reason code, the elapsed time and
the correlation id. Never the statement text, never the session identifier, never
a driver message. And `agent_operation` is its own event type rather than a flag,
because an operator filtering the log needs to separate what a human ran from what
an agent was permitted to run:

```sh
curl -s --cookie auth.txt \
  'http://localhost:3000/api/admin/audit?type=agent_operation'
```

Two things this does not mean. First, a statement you run yourself in the editor
takes the ordinary path: `POST /api/db/query` calls the provider directly and
receives neither the policy decision nor the audit event, so it is a history
record, not an `agent_operation`. Second, AUTO mode on this engine requires a
least-privilege role - opening the execution profile probes the role and refuses
with `PROFILE_PRIVILEGES_TOO_BROAD` unless superuser and membership of
`pg_read_server_files`, `pg_write_server_files` and `pg_execute_server_program`
all read back false. PLAN mode opens on every connection, is handed no tools, and
executes nothing, so it produces no execution events to audit. The rest of that
boundary is on [the features page](/features).

## Using it as change evidence, and where that stops

For a change record, the useful shape is already there: an account, a timestamp, a
target, a result and a duration, for the operations that changed something. A
`VACUUM` on a table, a terminated backend, a masking rule edited, a login that
failed before it succeeded - each is one event with a typed reason, and
`rate_limit_exceeded` additionally names the bucket that tripped, so a broad
address flood reads differently from a targeted attack on one account.

Where that stops is worth being exact about. The trail attributes to an account,
not to a person; if three engineers share a login, the log says so only by saying
nothing. It answers "did anyone touch this table through Studio", not "did
anything touch this table" - for that you need the server's own logging, and the
reconciliation is yours. And retention is a bounded buffer plus your log pipeline:
the evidence is as durable as the pipeline and no more.
