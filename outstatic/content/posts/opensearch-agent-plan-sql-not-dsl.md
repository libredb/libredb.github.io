---
title: Steering a plan-mode draft away from the query DSL
status: published
author:
  name: LibreDB
  picture: ''
slug: opensearch-agent-plan-sql-not-dsl
description: A plan run once answered with a native aggregation body, correct for the cluster and unrunnable in the editor, so the contract now names the dialect outright.
coverImage: ''
tags:
  - value: engineering
    label: Engineering
  - value: databases
    label: Databases
  - value: security
    label: Security
publishedAt: 2026-01-15T09:00:00.000Z
---

An agent asked to draft an OpenSearch SQL plugin query already knew the index names, the
mapped fields and their types, and it still answered with something the editor could not
run - because a cluster accepts more than one query language and nothing in the schema
says which one this connection speaks. The grounding was not what failed.

Everything below was measured against OpenSearch 3.8.0, image
`opensearchproject/opensearch:3.8.0`, on 2026-08-19.

## What a plan run is given before its first turn

Plan mode is the toolless half of the agent. The model executes nothing; it drafts one
statement and a person decides whether to run it. Because it holds no tools, it needs no
read-only execution profile, so it opens on an OpenSearch connection like any other.

Before the first turn the server asks the provider to describe itself, and on this engine
that description never comes from SQL. Indices come from
`GET /_cat/indices?format=json&bytes=b`, columns from `GET /<index>/_mapping` flattened to
dotted paths, at most four mapping reads at a time. The mapping is the index's own
declaration, it is readable on a closed index, and it is the document the user actually
edits, so it is the better source than any `SELECT`. It is also the safer one: measured
here, `SELECT *` returns container fields with their sub-documents, so a tree built from a
statement would describe the statement rather than the index.

The inventory the model reads is deliberately shaped by this engine's own vocabulary. The
provider labels its entities `Index` / `Indices` and its rows `document` / `documents`. The
entity pair is the one the agent reads: it is lowercased into the noun the run's own prose
uses for the things in the inventory. A cluster described to a model as holding tables of
rows invites statements written for a relational engine.

Two facts travel with every column, and both are measurements rather than defaults. Every
column is nullable, because a mapping declares how a field is indexed if a document carries
it and has no `NOT NULL` in its model. No column is primary, because nothing a mapping
declares is unique - indexing the same body twice yields two documents. `_id` is selectable
in SQL on this product, but it is metadata rather than a mapped field, so it is reported
neither as a column nor as a key. A key invented at this layer becomes a key the product
asserts.

## The draft that was correct and unrunnable

With all of that in the window, a live plan run drafted a native JSON aggregation body.

It was not a hallucination. The body was valid for the cluster, addressed the right index,
and would have answered the objective if it had been sent to the search API. It could not
be sent anywhere from here. This provider speaks exactly one query surface:
`POST /_plugins/_sql`, the SQL plugin that ships bundled with the distribution, over the
runtime's own `fetch` with no driver dependency and no connection pool. Port `9200` for both
schemes; a TLS deployment serves HTTPS on that same port. A JSON query body handed to that
endpoint is not a statement, and the editor has nowhere else to put it.

The provider's declared capability said `queryLanguage: "sql"`, which is true and settles
nothing. This cluster answers to more than one language, and a model's prior about "querying
a search engine" is strong enough to override a schema. The gap was never in the grounding
data. It was in the contract.

## Naming the dialect in the contract

The fix is one label, declared by the provider and stated verbatim to the model as part of
the planning contract:

```text
OpenSearch SQL, the SQL plugin's own dialect - NOT the JSON query DSL,
NOT an aggregation body, and NOT PPL
```

It becomes one sentence appended to the contract - *Write it in ...* - rather than a second
contract of its own, because two contracts in one message is a failure mode this runtime has
already paid for once.

Three details in that sentence are load-bearing.

It names what the language is **not**, not only what it is. Naming only what it is did not
survive contact with the model's prior.

It names PPL specifically, because the SQL plugin ships Piped Processing Language beside SQL
on this product. The alternative that has to be excluded is the one that actually exists
here. There is no ES|QL on this engine at all - `POST /_query` answers 405 - which is
precisely why SQL is the language this provider speaks.

It does not touch the fence tag. The draft must arrive in a block tagged with the canonical
type-id, `opensearch`, because that tag is what the editor hand-off reads. A statement
fenced as anything else produces no drafted-statement event: the run is scored as having
drafted nothing while the user is looking at a statement.

The label is not a UI string. No screen renders it; it exists only in what the model is
told, and a provider declares one only where the engine's own name misleads a model about
what a statement is here. It is one instance of the rule the [capability
model](/features) is built on: what a provider can and cannot do is declared, not
discovered at runtime.

## Why the tool-using run cannot open here at all

**Agent AUTO mode - the tool-using, metered run - cannot run on OpenSearch. A run ends
`engine-unsupported`.** The read-only execution profile is database-native: only PostgreSQL,
SQLite and DuckDB implement `queryReadOnly`, and a run whose workflow sends a statement is
refused when it is started rather than after a model turn has been spent. A run that reaches
the driver some other way fails profiled acquisition with `PROFILE_UNSUPPORTED_BY_PROVIDER`
and ends `engine-unsupported`.

This provider could not implement that profile if it wanted to. The read-only guarantee has
to be enforced by the engine, and this grammar has no transaction to open read-only and no
session-scoped setting to make read-only - the surface is one stateless HTTP request per
statement. An integration-level imitation of read-only would be a promise made by the wrong
party, which is the argument the [security page](/security) makes about every control it
publishes.

## What the person on the other end has to do

A plan run's output is a draft, and the reviewer is the execution model. Four things about
this grammar are worth reading a draft for, all measured on 3.8.0.

| Check | What the engine does |
| --- | --- |
| Quoting | Backticks quote an identifier. `[...]` does too |
| Double quotes | A **string literal**. `WHERE "customer" = 'acme'` compares two literals and answers 0 rows with no error |
| Writes | `INSERT`, `UPDATE`, `CREATE TABLE` and `ALTER TABLE` are refused. `DELETE` is in the grammar and off by default |
| Paging | `LIMIT n OFFSET m` is accepted, so the editor's load-more works |

The double-quote row is the one to internalise, because it is the only failure in the table
that produces no error at all. A draft that quotes a field name the way most SQL dialects do
returns an empty grid, and an empty grid reads as an answer.

Two more things a draft cannot tell you. There is no `EXPLAIN` on this surface - the
statement form is refused with `SQLFeatureNotSupportedException`, so you cannot check a
plan before running it. And an index with `nested` fields reports more documents in the
monitoring panel
than `SELECT COUNT(*)` returns, because every nested element is stored as a document of its
own. The panel is counting documents; the statement is counting rows.
