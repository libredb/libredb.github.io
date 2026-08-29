---
title: 'How many databases? Sixteen, twenty-six, or forty-two'
status: draft
author:
  name: LibreDB
  picture: ''
slug: counting-databases
description: Three different true answers to the simplest question anyone asks about a database tool, and why the registry behind them records a refusal as carefully as it records a success.
coverImage: ''
tags:
  - value: engineering
    label: Engineering
  - value: databases
    label: Databases
publishedAt: 2026-08-29T14:00:00.000Z
---

The most common question we get has no single answer.

*How many databases does it support?* Sixteen, if you mean engines with their own
driver, their own reference document and their own integration test. Twenty-six,
if you mean engines that speak one of those wire protocols and were measured
against a running instance. Forty-two, if you mean products you can point the app
at and get something useful from.

All three are true. None of them is the answer on its own, because the number
was never the interesting part — the denominator was. A count is wrong when its
denominator is unstated, not when its digit is stale.

That sentence is a comment in `src/lib/db/compatibility.ts`, and it is there
because we got it wrong first.

## Three numbers, three denominators

**Sixteen — engines with a first-class provider.** PostgreSQL, MySQL, Oracle, SQL
Server, SQLite, libSQL, DuckDB, ClickHouse, Druid, Trino, Cassandra,
Elasticsearch, OpenSearch, MongoDB, Couchbase and Redis. Each one has a provider
module, a page under `docs/providers/`, and integration tests that run against a
real container. Adding one is weeks of work, and the honest capability line it
carries — what it deliberately cannot do — is written at the same time as the
driver.

**Twenty-six — verified relatives.** MariaDB speaks the MySQL wire protocol.
Valkey, KeyDB, DragonflyDB and Garnet speak Redis. Citus, TimescaleDB,
CockroachDB, YugabyteDB, AlloyDB Omni and half a dozen more speak PostgreSQL.
FerretDB speaks MongoDB. ScyllaDB speaks CQL. These need no new driver, so it is
tempting to list them the moment the connection succeeds.

We do not, and that restraint is most of the point of this post. A name enters
that registry only after a probe has run every introspection surface against a
real instance and someone has written down what happened, including what broke.

**Forty-two — connectable products.** Sixteen plus twenty-six. This is the only
number that answers the question as it is usually meant, and it is also the one
we publish least, because on its own it flattens the two halves into a claim
neither half makes.

## What a tier is for

A relative is not simply in or out. Each one carries a tier, and the tier is the
useful part:

- **`full`** — every introspection surface answered.
- **`partial`** — some answered, some did not. The editor works; parts of the
  browser or the monitoring dashboard are blank.
- **`query-only`** — the SQL editor works and nothing else does.

So: is a `query-only` engine supported? Yes, and the word is doing no work. On
Materialize, RisingWave and Databend you get a SQL editor and a results grid. The
object browser, the monitoring dashboard and every statistics panel are
unavailable. If that is what you need, it is a fine answer. If you expected to
manage a database, it is not, and you should find that out here rather than
twenty minutes into an evaluation.

`full` is not a synonym for perfect either. Citus answers every surface, and its
row counts for a distributed table are *wrong rather than missing* — PostgreSQL's
statistics describe the empty coordinator parent, not the shards. Valkey answers
every surface and reports its Redis emulation level, 7.2.4, instead of its own
version. Both facts are on the row. A caveat is not a demotion; it is what the
tier alone cannot tell you.

## What a probe refuses

Two engines were measured and did not earn an entry. There is no tier for them
and no version column — the finding is the number.

**Google Cloud Spanner, PostgreSQL dialect: 1 of 15 surfaces.**

**QuestDB 10.0.1** is the one worth reading, because it looks like a
`query-only` relative right up until it isn't. QuestDB speaks the PostgreSQL wire
protocol, and through the provider a statement answers: `SELECT country, count()
FROM probe_orders` returned three rows. In the product, pressing Run returns a
500.

The cause is ours, not QuestDB's. The editor attaches a `queryId` to every
statement so a running query can be cancelled; the provider then issues `SELECT
pg_backend_pid()` first to find the backend to cancel. QuestDB has no such
function. We measured it both ways at the provider boundary to be sure: the
identical call with a `queryId` fails, and without one returns the three rows.

That is the whole argument for probing through the product rather than through
the driver. A provider-level check would have awarded QuestDB a tier, published
it, and been wrong in the only place that matters — the browser, where a user
presses a button.

## Why it is published this way

Three rules fell out of this, and each one exists because its absence cost
something.

**There is no `pending` state in the registry.** Engines waiting for an instance
are tracked in an issue, never in the table. A reader cannot tell a pending row
from a probed one, and a table that mixes them is worth less than a shorter table
that does not.

**A name that was probed and refused is recorded next to the ones that passed.**
QuestDB and Cloud Spanner have their numbers written down beside the successes,
with enough detail to reproduce the refusal. Otherwise the same name gets
re-added from memory in six months by someone who remembers that it connected.

**Untested is not unsupported.** An engine nobody has probed gets no row and no
opinion. That is the honest state, and it is different from a failure.

One consequence you can see on this site: the engine grid on
[the databases page](/databases) shows **seventeen**, not sixteen. The
seventeenth is LibreDB's own embedded store, which is a thing you can select in
the connection dialog and therefore belongs in a list of things you can select.
It is not an external engine, so it is outside the sixteen and outside the
forty-two. Two numbers, two denominators, both stated — which is the only version
of this that is not a mistake.

An earlier function got exactly this wrong. It counted the shipped type-ids
including the embedded store, so it answered 33 while the README published 32 for
the same claim. Both numbers were defensible. Neither said which set it was
counting, and that is the failure, not the digit.
