---
title: How the editor bounds a PostgreSQL result set
status: published
author:
  name: LibreDB
  picture: ''
slug: postgresql-editor-automatic-row-limits
description: Automatic LIMIT injection applies to unbounded SELECT and CTE-SELECT statements only, and there is one statement shape it deliberately leaves alone.
coverImage: ''
tags:
  - value: engineering
    label: Engineering
  - value: databases
    label: Databases
publishedAt: 2026-04-22T09:00:00.000Z
---

`SELECT * FROM events` against a table nobody remembers the size of is not a mistake
anyone makes on purpose. It is what happens when you widen a filter to check something
and press Run before finishing the thought. The server is fine. The browser is not: it
has to hold every row, build a DOM for them, and stay responsive while it does.

So the editor bounds the result set before execution. That much is ordinary. What is
not is that a row cap which rewrites the wrong statement is worse than no cap at all,
and on PostgreSQL there is a common statement shape where appending `LIMIT` changes
what the database writes rather than what the grid shows.

## Where the bound is applied

The bound goes into the statement text, not into the grid. `prepareQuery()` runs the
statement through `analyzeQuery()` and, where it applies, appends a clause with
`applyQueryLimit()`. Two numbers govern it: `DEFAULT_QUERY_LIMIT` is 500, and
"unlimited" mode caps at `MAX_UNLIMITED_ROWS`, 100000.

Doing it before execution matters. Truncating in the browser means the server has
already materialised the full result and the connection has already carried it; on a
pooled `pg` client that is a pool slot held for the duration. A bound written into the
statement is a bound PostgreSQL's planner sees, and it can stop early rather than
complete the sort and hand back the top 500 rows of it.

Preparation is a separate step from execution, and it stays separate. `query()` runs
exactly the SQL it is handed. Nothing rewrites a statement on its way to the driver.

## Which statements collect a LIMIT and which do not

Only `SELECT` and CTE-`SELECT` statements that carry no bound already.

An existing `LIMIT`, `FETCH FIRST ... ROWS ONLY`, `TOP n` or `ROWNUM` is detected and
respected, so a query you already bounded is not bounded twice. `INSERT`, `UPDATE`,
`DELETE` and DDL are returned unchanged.

Statement type is read from the first keyword that is neither whitespace nor a
comment. That sounds like a detail and was a bug: before it, a `SELECT` behind a
`-- note` classified as an unknown statement type and returned every row, while the
badge in the UI reported the query as not limited. The reader is also dialect-aware.
PostgreSQL has exactly two comment forms, `--` and `/* ... */`; `#` is an operator
character, which is why `#>` and `#>>` walk a jsonb path. A reader that treats `#` as
a comment marker reads `SELECT flags # 5 AS x FROM t` as a statement that ends at the
`#`, and does not bound it. Under PostgreSQL's grammar it is code, the statement is
cut at its real end, and the clause lands.

Two more PostgreSQL-specific rules follow:

- `[...]` is a subscript here, not a quoted name. `ARRAY[[1,2],[3,4]]` nests,
  `j['a]b']` carries a close bracket inside a literal, and `t.data[idx[0]]` nests
  again. All three are read whole and bounded intact, because in this dialect
  identifiers are quoted with double quotes and `[` is never a name quote.
- Block comments nest here, which the manual states as the dialect's own rule. A
  reader that ends every comment at the first `*/` hands the text between that marker
  and the comment's real end to the parser as code, and on PostgreSQL a stray `)` in
  that region closes a CTE body that is still open.

Where the text cannot be resolved at all - an unterminated comment, a literal behind
an odd backslash run, a bracketed run short of its closer - the statement is returned
untouched with `wasLimited: false` and the safety gate asks before running. That is
the fail-safe direction: an over-large read can be re-run, and a guess about where a
statement ends would place the appended clause after the `;` or in the middle of the
query.

The clause itself is inserted at the end of the statement as the statement-end reader
delimits it, before any trailing comment and before the terminating `;`, both
re-attached verbatim. Appending after the trivia once put the bound inside a trailing
`-- note`, so the query ran unbounded while the badge said it was capped.

## The data-modifying CTE that must not be bounded

Here is the shape that makes all of the above load-bearing:

```sql
WITH moved AS (
  DELETE FROM staging_orders
  WHERE imported_at < now() - interval '7 days'
  RETURNING *
)
INSERT INTO orders_archive
SELECT * FROM moved;
```

The statement leads with `WITH`. Read by its leading keyword it is a `SELECT`-ish
thing, and it collects a `LIMIT`. On PostgreSQL that appended clause applies to the
rows the statement **writes**. The result was a partial commit reported as a
truncated result set: at most 500 rows archived, and a grid that looked like a
successful query someone would page through.

The rule now is that a statement leading with `WITH` is typed by the keyword its CTE
list operates, not by `WITH` itself. A data-modifying CTE is not bounded. An
undeterminable CTE shape is not bounded either, for the same reason as above - an
over-large read can be re-run, a partly committed write cannot.

This is not a PostgreSQL-only rule in the code; it lives in the shared SQL base
provider and applies to every SQL engine. It matters most here, because data-modifying
CTEs are an everyday PostgreSQL idiom rather than an exotic one.

The consequence is the boundary of the feature:
**a write dressed as a CTE query returns everything it returns.** If your
`WITH ... RETURNING` statement produces a million rows, the editor will hand you a
million rows rather than silently commit 500. Bound it yourself if you want it
bounded.

## Unlimited, and the ceiling on unlimited

Turning the cap off does not mean unbounded. "Unlimited" is 100000 rows, and the
statement still carries a written `LIMIT` clause. There is no mode in which the editor
sends `SELECT * FROM events` verbatim and hopes.

Two other numbers come from the same family of decisions and are easy to confuse with
this one. Schema introspection caps column lists at the first 100 columns per table.
Agent AUTO mode reads at most 200 rows per statement, and that is a separate budget
enforced on a separate path - the agent's `queryReadOnly()` runs exactly one statement
inside `BEGIN READ ONLY` and does no rewriting at all. The editor's row cap and the
agent's row budget are not the same mechanism and do not share a number; the agent's is
published with the rest of that run's budgets on the [features page](/features). AUTO
mode also needs a least-privilege role on this engine: the execution profile probes the
role when it opens and refuses a superuser connection with
`PROFILE_PRIVILEGES_TOO_BROAD`.

One caller policy is worth knowing about, because it is visible. `POST /api/db/query`
prepares every statement it is handed. `POST /api/db/multi-query`, which runs a
script, prepares only the **last** statement, and only when that statement is a
`SELECT`. So a non-final `SELECT` in a multi-statement run returns its full result
set. That is recorded rather than described as solved.

## Cancelling instead of waiting

A bound on rows is not a bound on time. `SELECT count(*) FROM events` returns a single
row and reads every row in the table to produce it; a bad join returns nothing for a
long while and then returns too much.

Cancellation on this engine is real. A query issued with a
`queryId` records its backend PID; `cancelQuery()` looks that PID up and calls
`pg_cancel_backend(pid)` on a fresh pooled client, exposed at `POST /api/db/cancel`.
The statement stops on the server. Closing the browser tab is not what stops it.

The limit to state here is in the error you get back. A statement timeout and a user
cancel both surface as a cancellation, never as a timeout. PostgreSQL emits
"canceling statement due to ..." for both, and the error mapper matches that string
before it reaches its timeout branch. So the message tells you the statement was
cancelled and does not tell you who cancelled it. If you did not press the button,
read `statement_timeout` on the connection before looking for a second explanation.

The path has a cost outside PostgreSQL itself. The provider issues
`SELECT pg_backend_pid()` to find the backend it would later cancel, so a
wire-protocol relative lacking that function fails in the product while answering
fine through the driver.
