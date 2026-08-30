---
title: Browsing an un-indexed Couchbase collection
status: published
author:
  name: LibreDB
  picture: ''
slug: couchbase-unindexed-collection-scan
description: On recent server versions a sequential scan makes an un-indexed keyspace open slowly, so a primary index is a recommendation now rather than a prerequisite.
coverImage: ''
tags:
  - value: engineering
    label: Engineering
  - value: databases
    label: Databases
publishedAt: 2026-08-03T09:00:00.000Z
---

Opening a Couchbase collection that has no index does one of two things, and
which one happens is decided by the version of the cluster rather than by
anything in the statement. On Server 7.0 to 7.2 it fails with error 4000. On
Server 7.6 and later it returns rows, and takes its time about it.

## What happens when you open a collection with no index

Clicking a collection in the schema tree runs a generated statement. On Couchbase
that statement projects the document key explicitly, because `SELECT *` nests the
document under the keyspace name and leaves the key out of the result entirely:

```sql
SELECT META(d).id AS __id, d.*
FROM `travel`.`inventory`.`hotel` AS d
LIMIT 50;
```

Nothing in that statement names an index. Whether it can be answered at all is a
question the Query Service resolves on its own, and until Server 7.6 the answer
on a keyspace with no index was no.

Before anything runs, the explorer has already told you the state you are in.
`getSchemaRelations()` reads `system:indexes`, so an un-indexed collection shows
an empty index list next to it before you press anything. That read is the one
monitoring source here that is deliberately not allowed to degrade to empty on
failure: everywhere else a denied catalog read falls back to nothing, but an
empty index list *is* the un-indexed signal, and silently faking it for the whole
bucket would be worse than an error.

## The fallback that changed the answer

From Server 7.6 the Query Service answers an index-less keyspace with a
**sequential scan**, which uses a KV range scan underneath to enumerate keys. So
SELECT, the write statements and JOIN all succeed with no primary and no
secondary index present. Verified on Community Edition 8.0.2: selecting from a
collection that has no index at all returns rows, and `EXPLAIN` names the
fallback rather than leaving you to infer it:

```json
{ "#operator": "PrimaryScan3", "index": "#sequentialscan", "using": "sequentialscan" }
```

That is the evidence, and it is worth clicking Explain to see it, because the
plan is the only place the fallback is visible. The result grid looks the same
either way; it is just slower to fill.

`EXPLAIN` is available on this engine and renders a plan tree, but note what it
is: an estimate, in both modes. SQL++ has no `EXPLAIN ANALYZE`. Real timings come
only from the request-level `profile: "timings"` parameter, which the explain
strategy does not emit by design, so the direct Explain action and the background
pre-warm show the same estimated plan. A cost or cardinality of `-1` is read as
"no estimate" rather than as a number.

## Where the hard failure still applies

On Server 7.0 to 7.2 there is no sequential scan, so the same statement comes
back as **error 4000, "No index available on keyspace"**. This is the limit, and
it does not soften with a newer client: the fallback is a server feature, and a
provider that speaks the documented REST endpoints cannot supply one the cluster
does not have. On those lines a primary index is a prerequisite, not a
recommendation, and a collection without one cannot be browsed at all.

What the provider does instead is refuse usefully. Error 4000 is re-raised as a
`QueryError` carrying the remedy already quoted for the exact keyspace the
statement read from:

```text
No index available on keyspace `travel`.`inventory`.`hotel` that matches your query.
Create one first: CREATE PRIMARY INDEX ON `travel`.`inventory`.`hotel`
```

The second line is runnable. Paste it into the editor and press Run. Getting the
backticks right matters more here than it looks: SQL++ has no bind parameter for
identifiers, so keyspace paths are assembled by concatenation, and
`quoteIdentifier()` doubles embedded backticks so an identifier cannot terminate
its own quoting. `bucket` and `scope` are also reserved words in SQL++ - an
unquoted projection over `system:keyspaces` fails with error 3000, verified on
Server 8.0.2.

Error 4000 is one row in a map that turns the cluster's single numeric error
space into the shared error classes:

| Code | Meaning | What you see |
| --- | --- | --- |
| 4000 | No index available on keyspace | Query error plus the runnable `CREATE PRIMARY INDEX` remedy |
| 3000 | Syntax error | Query error carrying the cluster's own message |
| 1080 | Request timeout | Timeout error |
| 13014 | Missing or invalid credentials | Authentication error |
| 503 | Query service unavailable, node warming up | Connection error |

One thing that map depends on: HTTP 200 does not mean success. The Query Service
returns syntax and semantic errors inside a 200 response with `status: "errors"`,
so the transport inspects the payload before the HTTP code. Skipping that check
reports a failed statement as "0 rows", which is exactly the shape an un-indexed
collection would otherwise take.

## Reading one document with no index at all

If you know the key, you do not need an index on any supported version. `USE
KEYS` bypasses index lookup and reads straight from KV:

```sql
SELECT META(d).id AS __id, d.*
FROM `travel`.`inventory`.`hotel` AS d
USE KEYS ["hotel::1"];
```

That succeeds on a keyspace that has no index whatsoever, on 7.0 as much as on
8.0. Error 4000 never fires for it. This is worth knowing before creating an
index just to look at one document during an incident.

The boundary is precise, and it is the useful half of the sentence: what still
needs an index is *discovering* keys you do not already know. `USE KEYS` answers
"show me this document". It cannot answer "show me the documents where city is
Istanbul", and no amount of key-shaped cleverness turns it into that.

## When to create the index anyway

Both halves of the version story point the same way.

On 7.0 to 7.2 you have no choice. On 7.6 and later the choice is real but it is
not close: a sequential scan is not optimised for throughput and degrades sharply
on large collections, to the point of query timeouts. Creating an index remains
the right thing to do for anything beyond a small or throwaway collection. It is
a recommendation now, not a prerequisite - and a recommendation you should
usually take.

```sql
CREATE PRIMARY INDEX ON `travel`.`inventory`.`hotel`;
```

A primary index carries no `index_key`, so it is reported with the synthetic
column `META().id`, and `unique` is true only for primary indexes, because no
global secondary index enforces uniqueness. After it builds, `EXPLAIN` stops
saying `#sequentialscan`, which is the confirmation to look for rather than a
stopwatch.

Two things about this engine make the un-indexed case a common one.

Columns here are inferred, not declared: schema loading runs
`INFER <keyspace> WITH {"sample_size": 100}` per collection. A failed INFER
yields empty columns rather than an error, because both common causes - no
SELECT on the collection, and an empty collection, error 7014 - are states the
explorer should render rather than fail on. A brand-new collection therefore
appears in the tree with no columns and no indexes, which is the exact shape the
scan fallback exists to make browsable.

And every statement is sent with `scan_consistency: "request_plus"`, so you
always see your own writes. The measurement behind that default, taken against
Server 8.0.2: immediately after an INSERT, a SELECT returned zero rows while
`COUNT(*)` already returned three, and the same SELECT returned three rows
seconds later. The trade-off is stated rather than hidden - `request_plus` makes
the query wait for the index to catch up, which costs latency on a write-heavy
cluster, and callers opt out per statement with `not_bounded`.

Everything above is the un-indexed story only. The other Couchbase boundaries -
one bucket per connection, no inline row editing, no transactions over stateless
HTTP, no foreign keys and therefore no ER diagram edges, and Agent AUTO mode
ending `engine-unsupported` because the read-only profile is database-native and
exists only on PostgreSQL, SQLite and DuckDB - are published on
[the engine pages](/databases), beside what each engine's transport and default
port actually are. The rule that produces those lines, and what it costs to keep,
is on [the features page](/features).
