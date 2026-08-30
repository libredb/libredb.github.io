---
title: A plan that needs a session, and a path that has none
status: published
author:
  name: LibreDB
  picture: ''
slug: sqlserver-no-execution-plan-shown
description: The showplan setting is session-level state and the explain path sends one statement, so the capability is declared false and the action is hidden.
coverImage: ''
tags:
  - value: engineering
    label: Engineering
  - value: databases
    label: Databases
publishedAt: 2026-03-14T09:00:00.000Z
---

Connect LibreDB Studio to SQL Server, write a query, and look for the Explain
action. It is not there. The reason is not that plans are hard to read, and not
that nobody has got to the T-SQL dialect yet. It is that a plan on this engine is
produced by turning something on in a session, and the code path that would have
asked for it can only send one statement.

## What a SQL Server execution plan viewer actually requires

On PostgreSQL and MySQL, a plan is a statement. You write `EXPLAIN` in front of
the query, send the resulting text, and read the rows that come back. The whole
transaction with the server is one request and one response, and a builder that
prepends a keyword to a string is a complete implementation.

SQL Server does not work that way. The provider doc's own future note for this
gap names the mechanism: `SET SHOWPLAN_XML ON` (or `SET STATISTICS XML ON`)
around the statement. The word doing the work is *around*. A showplan setting is
session state. It is switched on, the statement is then submitted, and the
setting is switched off again - three things in sequence, on one connection,
where the second is only meaningful because the first already happened.

```sql
-- three sends in this order, on one connection
SET SHOWPLAN_XML ON;
SELECT o.id, c.name FROM sales.orders o JOIN sales.customers c ON c.id = o.customer_id;
SET SHOWPLAN_XML OFF;
```

A plan flow here is therefore not a decorated statement. It is a small protocol
with a beginning, a middle and an end, and every part of it has to land on the
same session.

## Why a single-statement path cannot express it

The explain path in the product takes a query and returns a result. It has one
slot for SQL and one slot for rows. There is nowhere in that signature to say
"and also run this before, and this after, on the same connection, and do not
leak the setting to the next query that borrows it".

Two facts about the SQL Server provider make that shape concrete rather than
theoretical.

**Connections are pooled.** `connect()` builds an `mssql.ConnectionPool` and each
query takes a `Request` from it, with defaults of 2 for `pool.min`, 10 for
`pool.max` and a 30-second idle timeout. Session state set by one statement
lives on the connection that ran it, not on the statement. Switch showplan on and hand the
connection back, and the setting outlives the query that asked for it - and the
next borrower of that connection inherits a session it never configured.

**Only the first result set comes back.** `query()` reads `result.recordset`,
singular, so a multi-statement batch or a stored procedure returning several
result sets surfaces just one. Sending the three as a single batch to keep them
together is exactly the kind of thing that returns more than one result set, and
this path is not built to read past the first.

So the honest reading is not "nobody has written the EXPLAIN builder for T-SQL
yet". It is that the builder's interface - a string in, rows out - cannot carry
the thing T-SQL asks for. Widening it is a change to the explain contract on
every engine, not a dialect branch.

## What the action did before the capability was turned off

The UI's EXPLAIN builder handles PostgreSQL and MySQL. On SQL Server it had no
dialect to apply, so it applied nothing: before `supportsExplain` was set to
`false`, pressing *Explain* silently ran the unmodified query instead of
returning a plan.

Read that failure carefully, because it is worse than an error. Pressing a button
labelled *Explain* on an unreviewed statement ran that statement. Against a
`SELECT` over a large table it was a full execution nobody asked for. The word in
the source note is *silently*: nothing came back to say a plan had not been
produced.

That family of bug has a sibling on the same provider, which is why it is treated
as a class here rather than a one-off. The T-SQL pagination code once spliced a
`TOP` into what T-SQL reads as a nested block comment; SQL Server saw the query
without the clause, ran it unbounded, and the method reported `wasLimited: true`
anyway. Both failures are the same failure: the interface reported an operation
that the server never performed.

**The limit, stated plainly: the explain capability on SQL Server is `false` and
the Explain action is hidden. A real plan needs a session-level showplan setting
wrapped around the statement, which the single-statement explain path cannot
express, and before that flag was flipped the action silently ran the unmodified
query.** There is no estimated plan behind a menu here and no partial version of
this feature. It is absent.

## Hiding a control as a capability statement

`getCapabilities()` on this provider returns `supportsExplain: false`, and the
interface renders from that declaration rather than from a layout guess. That is
the same mechanism described in
[the capability declarations behind the feature list](/features) - a control that cannot
work is absent, with the reason written where it would have been, rather than
offered and then failed.

Setting the flag was not a workaround for a missing feature. It is what the
provider can answer about itself, and it turns a wrong result into a stated
absence.

One knock-on worth naming: the model-backed query explainer works by translating
EXPLAIN output into prose. With no EXPLAIN output on this connection there is
nothing for it to translate. The agent's PLAN mode still opens - it is toolless,
executes nothing, and drafts a statement for a human to run - so it can write you
the showplan sequence above against your real tables, grounded on this provider's
own inventory. Running it is your decision and your session, which is precisely
the boundary the product cannot cross on your behalf here. AUTO mode does not run
on SQL Server at all; it ends `engine-unsupported`, because the read-only
execution profile it needs exists only on PostgreSQL, SQLite and DuckDB.

## What re-enabling it would take

Not a T-SQL string builder. In order:

1. **A multi-statement explain path.** The explain call has to be able to hold a
   preamble, the statement and an epilogue, and to guarantee all three run on one
   connection - the transaction machinery already holds a single pool connection
   for its lifetime, so the shape exists in the codebase.
2. **A reader for more than the first result set.** `result.recordset` singular
   has to become the plural form on this path, or the plan is discarded with the
   rest of the batch.
3. **A guaranteed reset.** The setting has to come off before the connection
   returns to the pool, including when the statement fails. A pooled connection
   left in showplan mode is a bug that appears in an unrelated query later.
4. **Then, and only then, the capability flag.** `supportsExplain` flips last.
   The declaration follows the implementation; that ordering is what stops the
   button from lying again.

The rest of the engine is unaffected by this gap, within its own stated bounds.
Schema introspection is five bulk catalog queries grouped in memory - four over
`sys.*` views and one over `INFORMATION_SCHEMA.COLUMNS`. The ER diagram draws
real foreign keys from `sys.foreign_keys`. Monitoring reads DMVs, with real
blocked-session detection from `blocking_session_id` and real index usage counts
from `dm_db_index_usage_stats`, and it is graded partial for a separate reason:
those DMVs need `VIEW SERVER STATE`, and a login without it gets `N/A` and empty
lists across the dashboard rather than numbers. The per-engine boundaries,
including this one, are published on the [engine pages](/databases) rather than
discovered when you press something.
