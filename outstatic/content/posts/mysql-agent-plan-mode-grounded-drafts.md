---
title: Agent plan mode on MySQL drafts; it does not execute
status: published
author:
  name: LibreDB
  picture: ''
slug: mysql-agent-plan-mode-grounded-drafts
description: 'The tool-using run ends engine-unsupported here, so the useful post is what plan mode does instead: read the real schema and hand a statement to a person.'
coverImage: ''
tags:
  - value: engineering
    label: Engineering
  - value: databases
    label: Databases
  - value: security
    label: Security
publishedAt: 2025-12-04T09:00:00.000Z
---

Agent AUTO mode does not run on MySQL: the read-only profile is database-native
and a run ends `engine-unsupported`, so plan mode is toolless, runs nothing and
drafts a statement for a human to run. The evidence sits in the providers - only
`postgres.ts`, `sqlite.ts` and `duckdb/index.ts` implement `queryReadOnly`, and a
grep of `src/lib/db/providers/sql/mysql.ts` for that method returns nothing.

So an AI SQL assistant for MySQL, in this product, is a plan-mode run.

## Why the tool-using run stops at three engines

Agent mode's guarantee is not "the model was told to be careful". It is that every
statement the run issues goes through an audited pipeline - a policy decision, an
audit event and budget accounting before the driver is touched - under a read-only
profile the *database* enforces: a read-only transaction on PostgreSQL,
`PRAGMA query_only` re-asserted per statement on SQLite, a `READ_ONLY` engine
handle plus an SQL-level guard on DuckDB.

MySQL's provider has no equivalent handle to acquire, so the profile cannot be
established, so the run is refused. A run whose workflow sends statements is
turned away before it opens: `POST /api/agent/runs` answers 400 with the reason
the connection's type already decided, and no run id and no model turn are spent
on it.

The alternative would have been to open the run anyway and rely on prompt text and
statement classification to keep it read-only. That is a guarantee made by the
layer being guarded, which is the shape of guarantee this project does not ship.
The controls this project does ship, and the limits they do not cover, are
[published on the security page](/security) for the same reason.

One consequence worth stating plainly: MariaDB, Percona Server, TiDB, Vitess and
the other wire-compatible engines all connect through this same `mysql` provider.
There is no separate MariaDB type id, and the same refusal applies to all of them.

## What grounding means when the AI SQL assistant for MySQL executes nothing

Toolless is easy to hear as blind. It is not the same thing.

Before the model's first turn, the server reads the connection's schema through
the provider itself - `provider.getSchema()`, under the `db.schema.read`
descriptor. On MySQL that reading is the same `information_schema` traversal the
object browser already performs: `TABLES` for the table list, with row estimates
from `TABLE_ROWS` and size from `DATA_LENGTH + INDEX_LENGTH`; `COLUMNS` for
columns, primary keys identified by `COLUMN_KEY = 'PRI'`; `KEY_COLUMN_USAGE` for
foreign keys; `STATISTICS` for indexes. Since the grounding change, MySQL takes
this path as a matter of course rather than the ungrounded one it used to take.

So the draft is written against your actual column names, your actual foreign
keys and your actual primary keys. Three properties of that reading bound what the
draft can be trusted to know:

| The reading | What it gives the draft | What it does not |
| --- | --- | --- |
| `information_schema.COLUMNS`, first 100 columns per table | Real column names and types | Nothing beyond column 100 on a very wide table |
| `TABLE_ROWS` | An order-of-magnitude sense of table size | An exact count; it is an InnoDB estimate |
| `TABLE_SCHEMA = ?`, bound to the connected database | Every table in that one database | Anything in another schema, and no cross-schema foreign keys |

The schema read is also N+1 here: one query for the table list plus three per
table, because MySQL implements no `getSchemaList()` or `getSchemaRelations()`
and the two-phase tree loading PostgreSQL uses is unavailable. On a large schema
that is slower. Where the reading fails outright - refused, overran its time, or
rejected by the engine - the run says it is ungrounded rather than inventing
tables.

## The draft, and who runs it

The deliverable is one statement in a fenced block tagged with the connection's
type id. Nothing in the runtime executes it. The statement is offered in the
answer at the top of the rail and nowhere else - the timeline entry keeps the
headline and reprints neither the statement nor the guard's paragraph - because
that answer is also what marks a statement the guard did not classify as
read-only, and what names any table or column the draft used that your schema
does not have. The marking and the offer arrive together, in one place.

You press Apply to editor, and then you are in the editor, where the ordinary
rules apply. That matters on MySQL more than it sounds, because two of those rules
are yours to know:

- The editor injects a `LIMIT` if the statement has none - `DEFAULT_QUERY_LIMIT`
  is 500, and an unlimited run caps at 100000 rows.
- There is no server-side query timeout. The pool does not translate
  `queryTimeout` into one, so a runaway statement is not auto-killed.
  Cancellation is explicit: a query issued with a `queryId` records its
  connection `threadId`, and cancelling issues `KILL QUERY <threadId>`. It
  returns true on success without confirming the target was executing.

A drafted statement is a suggestion that a person reads before it becomes a
statement that ran. On an engine with no timeout, that person is the timeout.

## Where the operations workflow fits, and why it is not auto mode

There is one workflow that runs on MySQL in both modes, and it is easy to mistake
for auto mode. The Operate workflow reads the engine's own reporting interface
through six provider methods - sessions, slow queries, table statistics, index
statistics, storage and health. It composes no SQL of yours at all. That is why it
reaches every engine: `tests/evals/operations.test.ts` drives the whole arc on a
MySQL preset that carries no `queryReadOnly`, exactly as the real provider does
not, and asserts the run sent no statement.

On MySQL those readings come from `SHOW STATUS` and `SHOW VARIABLES`,
`information_schema.PROCESSLIST` for sessions, and
`performance_schema.events_statements_summary_by_digest` for the costly
statements. Two things about them are worth knowing before a report cites one.
With `performance_schema` off, the metrics are *absent, not zero* - cache-hit
ratio, queries per second and buffer-pool usage are omitted rather than defaulted,
and the panels show them as unmeasured. And index `scans` is `CARDINALITY`, an
estimate of distinct values, not a usage counter; MySQL has no equivalent of
`pg_stat_user_indexes.idx_scan`, so an index cannot be called unused on that
figure.

Reading the server is not running your query. Keeping those apart is the reason
Operate can be offered here at all.

## What the trade actually is

On MySQL the choice is already made, so the question left is what the remaining
mode is good for. The model is handed no tool, so there is no path from its output
to your data that does not pass through you, and that property survives a bad
prompt, a confused model and a mis-scoped objective because it is structural
rather than behavioural. A plan-mode draft is also worth less than a completed
investigation: it is a statement, not a finding. Which side of that trade you want
is not a choice this engine offers, and the refusal is printed on MySQL's own row
in the [engine list](/databases) rather than discovered when a run fails.
