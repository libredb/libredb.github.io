---
title: What one interface across seventeen engines actually costs
status: draft
author:
  name: LibreDB
  picture: ''
slug: what-one-interface-costs
description: One tree, one editor and one results grid for relational, document, key-value, analytical, search and federated engines — and the capability flags that stop that promise from breaking on the fourth engine.
coverImage: ''
tags:
  - value: engineering
    label: Engineering
  - value: databases
    label: Databases
publishedAt: 2026-08-29T09:00:00.000Z
---

Every tool that claims to speak many databases makes the same promise on its
front page and breaks it in the same place: the fourth engine.

The first three are easy, because the first three are usually PostgreSQL, MySQL
and SQL Server, and those three agree about almost everything. They have tables,
foreign keys, an `information_schema`, a query planner, a session list. A single
interface over them is barely an abstraction — it is a dialect switch.

Then someone connects Redis, and the promise has to decide what it meant.

## Two ways to lose

There are two ordinary ways to answer this, and both cost more than they look
like they do.

**Reduce to the intersection.** Ship only what every engine can do. The interface
is consistent, honest, and useless: no EXPLAIN, because Cassandra has none; no ER
diagram, because ClickHouse declares no foreign keys; no row editing, because
Druid is append-oriented. You end up with a text box and a grid, which is the
tool everyone already has.

**Ship the union and let it fail.** Show every control on every engine and let the
error come from the server. This is the common choice, because it demos well. The
cost lands later, on the user: they click *Explain* on a Cassandra query, wait,
and get a driver exception with a stack trace in it. They now know less than
before they clicked, because the error does not distinguish "this engine cannot
do this" from "your query is wrong" or "the cluster is down".

The second one is worse than it looks. It teaches people not to trust the
interface, and once that is learned it does not unlearn.

## The third answer

The capability set is data, not layout. Each provider declares what it can
answer, and the interface renders from that declaration. A control that cannot
work on the connected engine is not disabled and not hidden silently — it is
absent, with the reason written where it would have been.

That is a small design rule with a large consequence: **the absence has to carry a
sentence.** An empty panel is indistinguishable from a broken one. "No sessions
to list — DuckDB is single-writer by design" is information. A blank tab is a
support ticket.

Here is what that looks like in practice, engine by engine:

| Engine | What is deliberately absent |
| :--- | :--- |
| SQLite | No server to monitor; health reads file size and pragma statistics |
| DuckDB | Single-writer by design, so health shows storage rather than connections |
| ClickHouse | No foreign keys exist, so the ER diagram shows structure without discovered relations |
| Apache Druid | Append-oriented, so row editing is disabled rather than offered and then failed |
| Apache Trino | Queries catalogs; it does not manage a lakehouse, and writes depend on the connector |
| MongoDB | No SQL translation layer is faked — queries here are MongoDB queries |
| Redis | No SQL, and none is pretended; the editor speaks commands |
| Cassandra | No joins and no EXPLAIN; the grid respects partition-key query rules instead of hiding them |
| Elasticsearch, OpenSearch | Query-and-browse: no row editing, no ER diagrams |

Every line in that table is published on the [engine
pages](/databases), next to the engine's transport and default port, rather than
being discovered at runtime.

## The claim is the span, not the number

Seventeen is a fact about this release, not an argument. Counting engines is a
race that the counter always wins on paper and the user never feels, because
nobody connects seventeen databases. What is actually worth something is the
span: relational, document, key-value, wide-column, analytical, search and
federated query behind one tree, one editor and one grid, so that the person who
knows PostgreSQL can read the Mongo collection without learning a second product
first.

The span is also where the honesty has to be strictest. It is easy to write "ER
diagrams across all your engines" and technically ship it — a search cluster
declares no foreign keys, so its diagram draws boxes and no edges. The sentence
would be true and the reader would be misled, which is the definition of the
copy we are not allowed to write.

## What it costs us

Three things, and they are ongoing rather than one-time.

**Every feature ships seventeen times or declares seventeen exceptions.** There is
no "add it for Postgres now, generalise later" — the later never arrives, and in
the meantime the interface has a control that lies on sixteen engines.

**The capability declaration is a second thing that can drift.** A provider that
says it supports EXPLAIN and then throws is worse than one that says it does not,
so the declaration is exercised by the integration tests rather than trusted.

**Some good ideas do not survive the rule.** Features that only make sense on one
engine either grow an explicit per-engine story or do not ship. Agent mode is
the current example: it runs on PostgreSQL, SQLite and DuckDB, and the other
engines say so on their own page rather than hiding an empty menu.

We think that is the right trade. A tool you deploy next to a database is a tool
you have to trust without reading its source first, and trust is built by the
places where it says no.
