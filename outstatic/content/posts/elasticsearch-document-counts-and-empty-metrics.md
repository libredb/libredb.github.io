---
title: When the index says two documents and the query says one
status: published
author:
  name: LibreDB
  picture: ''
slug: elasticsearch-document-counts-and-empty-metrics
description: Nested elements are stored as documents of their own, so the panel and the editor legitimately disagree, and one panel asks the cluster nothing at all.
coverImage: ''
tags:
  - value: engineering
    label: Engineering
  - value: databases
    label: Databases
publishedAt: 2026-02-28T09:00:00.000Z
---

An index panel reports two documents. You run `SELECT COUNT(*)` against the same index
and get one. Nothing is stale, nothing is cached wrong, and no refresh will reconcile
them. The gap is a fact about how the engine stores a `nested` field, and both numbers
are correct answers to two different questions.

This provider was verified against Elasticsearch 9.1.4, image
`docker.elastic.co/elasticsearch/elasticsearch:9.1.4`, default build flavour,
subscription tier basic, security disabled, measured 2026-08-19. The two-against-one pair
itself was measured on the sibling search product, which runs this same implementation,
against a probe index whose `items` field is mapped `nested`: `_cat` reported 2 documents
and `SELECT COUNT(*)` answered 1.

## Where each monitoring figure comes from

The monitoring surface for this engine makes four kinds of read, all of them
plain HTTP: `/`, `_cluster/health`, `_cluster/stats` and `_cat/indices`. There is no
driver in the path at all - every statement and every stats call is a JSON body carried
by the runtime's own `fetch`, and the query surface itself is Elasticsearch SQL over
`POST /_sql?format=json`.

So a per-index row in the monitoring panels is `_cat/indices` and nothing else:

```json
{ "index": "probe_shapes", "docs.count": "2" }
```

`rowCount` is `docs.count`. The per-index size is `pri.store.size`, which is primaries
only. The cluster-wide size beside it comes from `_cluster/stats` as
`indices.store.size_in_bytes`, which includes replicas. Those two figures are
deliberately not the same measurement, so they do not sum, and on the measured single
node with one replica requested they happened to be equal - which is exactly why the
choice had to be made deliberately rather than discovered later by someone reconciling a
total that stopped matching.

Two more counts read differently from what their names suggest. `tableCount` counts
indices, because an index is the table on this surface, and it counts the user's indices
only. `indexCount` is 0 and stays 0: every mapped field is inverted-indexed as a
property of being mapped, so there is no secondary-index object anybody declared and
nothing to name.

## Why a nested element is its own document

A `nested` field is not sugar over an array of objects. The engine stores each element
of that array as a document of its own, hidden under the parent, so that a query
can match one element's fields together rather than matching across a flattened bag of
values. That is the entire reason the mapping type exists.

`docs.count` counts documents. All of them. A single logical record with one nested
element is two documents in that number. `SELECT COUNT(*)` runs through the SQL endpoint
and counts the rows that endpoint produces, which is the parent only. Neither number is
a rounding of the other, and the gap grows with the size of the nested array.

This is also why the schema tree for this engine reads the index mapping through `GET
/<index>/_mapping` rather than asking SQL what the columns are. Measured, an index that
maps a `flattened` and a `nested` field answers `SELECT *` with
`{"columns":[],"rows":[[]]}` - no columns at all. The mapping is the only honest source
for structure, and the index listing is where the cluster's own document count comes
from.

## Reading the count the panel actually reports

The panel is reporting the cluster's document count. It is not reporting how many rows a
query would return, and it was never derived from one.

### The two numbers, side by side

| Where you look | What it counts | `probe_shapes` |
| --- | --- | --- |
| Monitoring panel `rowCount` | `_cat/indices` `docs.count` - every stored document | 2 |
| Editor `SELECT COUNT(*)` | rows the SQL endpoint produces - parents only | 1 |

Deriving the panel figure from SQL instead would mean issuing a statement per index, on
a surface whose grammar the schema tree must not depend on, to answer a question the
panel is not asking. So an index with nested fields always reads higher in the panels
than in the editor, and the honest fix is to know which number you are reading rather
than to bend one of them toward the other.

The same rule about not fabricating a figure shows up one row over. A closed index has
`rowCount` and the total-size fields forced to zero, because those are required numbers
with nowhere else to go - but the optional per-index size is left absent rather than set
to `0`, since a zero there would be an invented measurement rather than a forced one.
And one closed index takes the cluster's Data figure away entirely: the Storage tab
shows `N/A` for every open index beside it rather than summing the ones that did answer,
because a partial sum presented as a cluster total is the same lie, one digit larger.

## The panel that sends no request at all

`getPerformanceMetrics()` returns `{}` for this engine, and it asks the cluster nothing.
There is no request. The Performance panel is empty because the seam declined to invent
its contents, not because a call failed.

Empty was chosen over zero for a measurable reason. Cache hit ratio is scored with a
`below`-direction threshold and a critical floor of 80, so a "neutral" `0` paints a red
critical cache fault on every healthy cluster; an absent ratio defaults to a healthy 100
instead. Every other metric would read as a measurement of zero, which is a different
and false claim - and the tabs did read them that way. Measured 2026-08-19 on the
sibling search provider, which is this same code path, the Overview showed *Buffer Pool
0%* and *Deadlocks 0* for two fields the payload simply omits. Both cards now read `N/A`
beside *Not measured*.

**Performance metrics return nothing and ask the cluster nothing, uptime reads `N/A`,
the active connection count is absent rather than zero, and there are no active sessions
or slow queries to read.** Uptime is `N/A` because neither the health payload nor
the version payload carries one, and a `0s` would claim the cluster booted this instant.
Active connections are absent because the number the cluster does publish is not one of
this seam's calls, and the shard and node counts that are here would be a different
number wearing that field's name. Sessions are empty structurally: one statement is one
HTTP request, so there is no session and no connection catalog. Slow queries are empty
for a plainer reason - the slow log is written to the node's own log file, which no API
returns.

Of those, only the performance metrics are reachable. The numbers exist on this
product's stats endpoints, so widening the seam by one call is a recorded follow-up
rather than an impossibility. The rest are properties of the engine.

## Absent rather than zero, across this dashboard

One more absence works the same way. `_cluster/stats` is heavier and more privileged than `_cluster/health`, so a cluster
that answers health and refuses stats is an ordinary configuration, not a fault. That
one read catches its own failure and returns unknown, because losing the health status
over a missing byte count would blank a panel that already had the important number. The
unknown then propagates honestly: the size reads `N/A`, the byte key is omitted rather
than set to `0`, and the Storage tab returns no cluster row at all rather than a row
claiming zero bytes stored. A cluster that really stores nothing publishes a real `0`
and keeps it.

The inverse encoding appears on the same screen and is also correct: `maxConnections` is
`0`, because for a ceiling, zero and absence are the same fact, and the Connections card
reads a zero maximum as "no limit published" rather than dividing by it.

None of this is specific to search engines. It is the rule the whole [capability
model](/features) runs on: a figure that cannot be answered on the connected engine is
absent with the reason written where it would have been, not rendered as a confident
zero. The [engine pages](/databases) publish those boundaries before you connect.

Two more, in the same spirit. The SQL surface here has no writes of any kind, so row
editing is not offered and then failed. And Agent AUTO mode does not run on this
connection: the tool-using run needs a database-native read-only profile, which
exists on PostgreSQL, SQLite and DuckDB only, so an auto run here ends
`engine-unsupported`. Agent PLAN mode does open, toolless, and drafts a statement for
you to run yourself.
