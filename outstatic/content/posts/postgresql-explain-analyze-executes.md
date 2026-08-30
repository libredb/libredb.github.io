---
title: The Explain button runs your query, the agent plan read does not
status: published
author:
  name: LibreDB
  picture: ''
slug: postgresql-explain-analyze-executes
description: 'Two EXPLAIN forms with different consequences: the editor emits the executing one, and the agent path emits the planning one only.'
coverImage: ''
tags:
  - value: engineering
    label: Engineering
  - value: databases
    label: Databases
publishedAt: 2026-07-15T09:00:00.000Z
---

A plan is cheap to ask for, which is why it gets asked for on connections where
nothing else would be. On PostgreSQL that instinct has a hole in it, because
EXPLAIN ANALYZE executes the query. Postgres does not model the run and report
what it would have cost; it runs the statement, counts what happened, and hands
back the tree with real row counts attached. For a SELECT the difference is a
matter of load. For a statement that writes, the difference is the write.

So there are two statements here wearing one name, and the split has to be drawn
in the product rather than left to the reader's memory.

## Reading a plan tree rendered from FORMAT JSON

The provider declares `supportsExplain: true` and `explainFormat: 'postgres-json'`
in `getCapabilities()`, alongside `defaultPort: 5432` and the rest of the
PostgreSQL capability set. That second flag is the load-bearing one. The
plan-only form is requested as `EXPLAIN (FORMAT JSON)` and comes back as a nested
object, not as the indented text a terminal prints:

```sql
EXPLAIN (FORMAT JSON)
SELECT r.rental_id, c.last_name
FROM rental r JOIN customer c ON c.customer_id = r.customer_id
WHERE r.return_date IS NULL;
```

Each node carries its `Node Type`, its `Plan Rows` and `Plan Width` estimates, its
startup and total cost, and its children. A viewer can therefore lay the tree out
and size the nodes by estimated cost without parsing indentation, and without a
dialect-specific text reader that breaks when the server changes its wording. The
text form is a rendering of the same data; the JSON form is the data.

What this form does not contain is anything measured. Every number in it is the
planner's estimate. That is exactly what makes it safe, and exactly what makes it
insufficient when the estimate is the thing you distrust.

## Why EXPLAIN ANALYZE executes the query on Postgres

Add `ANALYZE` and every node gains `Actual Rows`, `Actual Loops` and actual timing
next to the estimate. That pairing is the whole reason anyone reaches for it: a
node estimating a single row and returning hundreds of thousands explains a nested
loop that should have been a hash join, and no amount of staring at the plan-only
tree will tell you which node it is.

The cost is that the statement ran. Under the covers there is no third mode. The
executor is the executor, the buffers were read, the timing is real because the
work was real, and any side effect the statement carries has happened by the time
the plan is rendered. On a large aggregate that means the production server just
did the aggregate. On something that writes, it means the write is committed
unless you wrapped it yourself.

Two things in the product exist because of that. Plan inspection is a query like
any other, so a slow one is cancellable: a statement issued with a query id
records its backend PID, and cancelling calls `pg_cancel_backend(pid)` on a fresh
pooled client, exposed at `POST /api/db/cancel`. And a statement timeout or an
operator cancel both come back from PostgreSQL as `canceling statement due to ...`,
which `mapDatabaseError()` matches before its timeout branch, so both arrive as a
cancellation rather than a timeout. Cancelling stops the rest of the work. It does
not unhappen what already ran.

## The data-modifying CTE that makes the split matter

On most engines the argument above stays theoretical, because a plan request is
usually made against a SELECT. PostgreSQL removes that comfort. A statement can
lead with `WITH` and still write:

```sql
WITH expired AS (
  DELETE FROM sessions WHERE last_seen < now() - interval '30 days'
  RETURNING user_id
)
INSERT INTO session_audit (user_id, removed_at)
SELECT user_id, now() FROM expired;
```

That is one statement. It reads like a query, it begins with the keyword queries
begin with, and running `EXPLAIN (ANALYZE, ...)` on it deletes the rows and writes
the audit trail. There is no dry-run flag that suppresses the effect.

This shape has bitten the surrounding machinery before, which is why it is treated
as a first-class case rather than an edge one. Statements sent from the editor
collect an appended `LIMIT` when they are a bare `SELECT` or CTE-`SELECT` carrying
no bound already - 500 rows by default, 100,000 in unlimited mode - and a
statement leading with `WITH` is typed by the keyword its CTE list actually
operates. Type it wrong and the appended bound applies to the rows the statement
writes: at most 500 of them committed, reported back as a truncated result set.
The classifier reads that text under PostgreSQL's own grammar for exactly this
reason, and a data-modifying CTE is left unbounded and untouched.

The same fact drives the plan decision. If a `WITH` statement can be a write, then
"it starts with WITH, the plan is safe" is not a rule, and no amount of pattern
matching on the text can be trusted to make it one.

## Which surface emits which form

The rule is drawn at the surface, not inside a heuristic.

| Surface | Statement emitted | Executes |
| --- | --- | --- |
| Editor Explain action | `EXPLAIN (ANALYZE, ...)` | Yes |
| Agent plan inspection | `EXPLAIN (FORMAT JSON)` | No |

**The editor Explain action emits the ANALYZE form and therefore executes the
statement; the agent path uses EXPLAIN with FORMAT JSON only, because the
executing form stays behind an approval-gated descriptor no agent tool reaches.**
That descriptor has a name, `sql.explain.analyze`, and nothing in the agent tool
layer names it. The editor form is deliberate: a person pressed a button asking
for real timings, and giving them estimates instead would be a different answer to
the question they asked.

Agent AUTO mode has a second reason to hold the line. Its read-only boundary is
the database, not a SQL parser: each statement runs as `BEGIN READ ONLY`,
`SET LOCAL statement_timeout`, exactly one statement on the extended query
protocol, then `ROLLBACK` and `DISCARD ALL`, with PostgreSQL itself refusing a
write with SQLSTATE 25006 and a multi-command string with SQLSTATE 42601. That
containment is real but it is not a licence to relax the descriptor list, because
`SET TRANSACTION READ WRITE` is accepted inside `BEGIN READ ONLY` - what stops it
is that it can only ever be the one statement the protocol allows before the
rollback. A gate that depends on two mechanisms agreeing is worth more than one
that depends on either. AUTO mode also requires a least-privilege role: opening
the profile probes the role and refuses with `PROFILE_PRIVILEGES_TOO_BROAD` unless
superuser and membership of `pg_read_server_files`, `pg_write_server_files` and
`pg_execute_server_program` all read back false. Agent PLAN mode does not enter
this discussion at all: it holds no tools, executes nothing, and drafts a
statement for a person to run.

## Choosing deliberately on a production connection

Ask for the plan-only form when you want to know what the planner intends: which
index it chose, whether the estimate on a filter is plausible, whether a join
order changed after a schema edit. It is free of side effects and safe on a
connection you would not otherwise experiment on.

Ask for the ANALYZE form when the estimate is the suspect and you need the actual
row counts beside it - and read the statement first, because that is the moment
you are agreeing to run it. On a write, or on a `WITH` that turns out to write,
open a transaction yourself, or run it on a copy.

Every number in the plan-only tree is an estimate. That limitation is the price of
the guarantee that reading it changed nothing, and it is published on the
[feature pages](/features) and the [engine page](/databases) rather than left in a
tooltip.
