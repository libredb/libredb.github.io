---
title: Why there is no Explain action on an Oracle connection
status: published
author:
  name: LibreDB
  picture: ''
slug: oracle-no-explain-plan-rendering
description: Oracle has EXPLAIN PLAN and DBMS_XPLAN; what is missing is a two-statement wrapper, so the capability is declared false and the action is hidden.
coverImage: ''
tags:
  - value: engineering
    label: Engineering
  - value: databases
    label: Databases
publishedAt: 2026-03-12T09:00:00.000Z
---

Connect LibreDB Studio to Oracle, open the editor, and the toolbar has no Explain
button. That absence is deliberate. The Oracle provider declares
`supportsExplain: false` in `getCapabilities()`
(`src/lib/db/providers/sql/oracle.ts`), and the interface renders from that
declaration, so the control is not drawn at all.

The reason is not that Oracle lacks a planner. Oracle has `EXPLAIN PLAN` and
`DBMS_XPLAN`. The reason is that a real plan flow on Oracle takes two statements,
and the code path that produces an explain request can only send one.

## What a plan flow on Oracle needs

Every engine whose plan LibreDB Studio renders answers the same way: one statement
in, one result set back. `EXPLAIN (FORMAT JSON) SELECT ...` on PostgreSQL is a
statement whose rows are the plan. The renderer takes those rows and draws nodes.

Oracle does not work like that. The plan is produced by one statement and read by
another:

```sql
EXPLAIN PLAN FOR SELECT o.id, c.name FROM orders o JOIN customers c ON c.id = o.customer_id;
SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY());
```

The first statement returns no rows. On its own it looks to a caller like a
successful statement that produced nothing, which is exactly what it is. The plan
becomes readable only when the second call renders it. Two statements, in order,
and the second one is the one with the output.

That is the whole of the gap. Not a missing feature in Oracle, not a missing
renderer here - a missing wrapper between the two.

## Why a single-statement path cannot express it

The explain path in the interface builds one string and sends it through the same
`query()` call every other statement uses. That call checks out one connection from
the `oracledb` pool, runs `conn.execute(...)`, and returns
`{ rows, fields, rowCount, executionTime }`. There is no place in that shape for
"run this, then run that, and give me the rows from the second one".

The builder that composes the explain string handles the PostgreSQL and MySQL
dialects. Oracle is not in it, and adding a case is not a one-line change, because
the string is the wrong unit. A pair of statements needs a sequencing decision the
single-statement path never had to make: whether the display call may be sent on a
second pool checkout, or whether the two have to be pinned to one connection. The
pool here runs `poolMin` 2 and `poolMax` 10, so consecutive calls are not
guaranteed the same session, and answering that question is the work.

Compare it with the pagination override, which is the shape of change that does
fit. Oracle has no `LIMIT`, so `prepareQuery()` overrides the base and appends
`FETCH FIRST n ROWS ONLY` to the end of a bare `SELECT`. That is still one
statement in and one result out. The dialect changed; the flow did not. Explain
changes the flow.

## What the action did before the capability was declared false

Before `supportsExplain` was set to `false`, the Explain action was drawn on Oracle
connections like anywhere else. The builder had no Oracle branch, so it emitted the
statement it had been given. Clicking Explain sent the unmodified query to the
server and ran it.

Read that again with a `DELETE` in the editor. The action labelled "show me what
this would do" was a synonym for "do it". On a `SELECT` the failure was quieter and
still wrong: the user asked for a plan, got a result grid, and had no signal that
the plan had never been requested. Nothing errored. Nothing in the response said
the feature was unavailable, because as far as the transport was concerned the
statement had succeeded.

A control that silently means something other than its label is worse than no
control. An absent button states one true thing. A button that runs the query
states a false one, and the statement still runs.

## Hiding beats degrading

So the flag was flipped. **The explain capability is declared false on Oracle and
the action is hidden, because a real plan flow needs a plan statement followed by a
display call, which the single-statement explain path cannot express.** That is not
a note in a changelog. It is the published capability of this engine, and it lines
up with what [the plan-rendering feature page](/features) states in general form:
where an engine has no plan interface, there is nothing to render. On Oracle the
interface that is missing is the single-statement one, not the plan facility.

Declaring the absence is cheap and it composes. The capability set is data, so one
`false` removes the control everywhere it would have appeared, and it removes it
the same way on every screen. There is no half-working Explain to document, no
support answer that begins "on Oracle, that button actually...".

Nothing else on the Oracle connection moves with it. The editor is full: statements
run, results grid, transactions, inline row edits against the primary key. The ER
diagram is drawn from real foreign keys read out of `ALL_CONSTRAINTS`. Monitoring
reads Oracle's own `V$` views, privilege-gated query by query, and the Queries panel
reads `V$SQL` ordered by elapsed time - which is not a plan, but it is the engine's
own account of what has been expensive. Agent plan mode opens here too: it is
toolless, executes nothing, and drafts a statement for a human to run. Agent auto
mode does not run on Oracle at all; that is a separate boundary, published on the
[Oracle engine page](/databases), and it is not what this post is about.

And the plan itself is not out of reach. The editor sends what you type, so the two
statements above run there today, in order, and `DBMS_XPLAN.DISPLAY()` returns the
plan as rows of text. What you do not get is the graphical renderer that
PostgreSQL, MySQL and the other engines with a single-statement plan interface
feed.

## What this would take to build

The work is named in the provider's own comment and in the Oracle provider doc's
known-limitations list: build the `EXPLAIN PLAN FOR ...` plus
`SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY())` wrapper, then re-enable the capability.
Concretely that is an Oracle branch in the explain builder, a two-step execution
path that keeps the pair coherent, and a parser that turns `DBMS_XPLAN`'s output
into the node shape the plan renderer already draws for the other engines.

Until those three exist, the flag stays false. The order matters: the capability is
declared true after the flow works, not before it, because a declaration that runs
ahead of the implementation is how a button comes to run your query when you asked
it to explain one.
