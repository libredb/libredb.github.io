---
title: The Couchbase role your monitoring panels depend on
status: published
author:
  name: LibreDB
  picture: ''
slug: couchbase-monitoring-catalog-role
description: Without the query system catalog role, slow queries and sessions are empty and denied metrics are omitted rather than reported as zero.
coverImage: ''
tags:
  - value: engineering
    label: Engineering
  - value: databases
    label: Databases
  - value: security
    label: Security
publishedAt: 2026-04-06T09:00:00.000Z
---

You connect a Couchbase bucket, the tree fills in, statements run, and the
monitoring dashboard opens with two panels blank and a third reading N/A. Nothing
errored. The usual cause is neither the cluster nor the connection. It is the
Query System Catalog role, and whether the account you connected with holds it.

That is deliberate. Without the Query System Catalog role slow queries and active
sessions are empty, index scan counts read zero, and denied performance metrics
are omitted rather than shown as zeroes, by design.

## Which reads need the catalog role, and which do not

The monitoring dashboard on this engine is assembled from two different kinds of
source, and they fail differently.

| Panel | Source | Needs the catalog role |
| --- | --- | --- |
| Overview | `/pools/default`, `/pools/default/buckets/<bucket>`, `system:keyspaces`, `system:indexes` | partly |
| Performance | bucket statistics series | no, but needs bucket stats |
| Slow queries | `system:completed_requests` ordered by `elapsedTime` | yes |
| Sessions | `system:active_requests` | yes |
| Tables | `/pools/default/buckets/<bucket>` | no |
| Indexes | `system:indexes` plus `/pools/default/buckets/@index-<bucket>/stats` | yes for the statistics |
| Storage | `/pools/default/buckets/<bucket>` | no |

The split follows the source, not the panel. Three sources need the Query System
Catalog RBAC role: `system:completed_requests`, `system:active_requests` and the
index-service statistics. Everything else is gated by whatever bucket-level roles
the account holds, which is why an account can show you disk used and RAM quota
while showing you nothing at all about the queries that filled them. Not every
`system:` keyspace sits behind that door either - `system:keyspaces` and
`system:indexes` are not among the three, which is why the index list still
renders while its scan counts read zero.

Two gaps here have nothing to do with privileges. There is no Pool tab, because
there is no connection pooling: every statement is one stateless HTTP request to
the discovered query port. Table statistics are bucket level only, because a
per-collection item count needs a `COUNT(*)` per collection, too expensive for a
monitoring poll. Those two are architectural. The blank slow-query list is a
permission.

## What a restricted user sees on the dashboard

A denial does not surface as an error, because a denial is the ordinary case. An
application user is usually granted exactly the bucket access the application
needs and nothing from the query catalog. Every monitoring read on this provider
therefore funnels through one helper:

```ts
async function degradeTo<T>(operation: () => Promise<T>, fallback: T): Promise<T> {
  try { return await operation(); } catch { return fallback; }
}
```

A source the connected user cannot read yields its fallback instead of breaking
an otherwise working connection.

Concretely, on a restricted account: the slow-query list is `[]`, the session
list is `[]`, index rows still appear from `system:indexes` with their name,
scope, collection, keys and type, and their scan counts read 0. The overview
still reports version, uptime and active connections when the management reads
are allowed. `maxConnections` in that overview is the documented KV default,
65536, because Couchbase advertises no connection ceiling over REST - the
denominator is a constant while the numerator stays measured.

One consequence worth flagging: cancelling a running statement needs the role
too. This provider exposes no `cancelQuery`; a running request is terminated
through the maintenance `kill` operation, which is
`DELETE FROM system:active_requests WHERE requestId = $1` and takes the request
id shown in the sessions panel. No sessions panel, no request id, no kill. The
maintenance toolkit and the audit trail are admin-only in any case, which is
described alongside the other [access boundaries](/security) the deployment
publishes.

## Omitted rather than zero, and the bug behind that rule

Three performance fields are optional on this provider, and each is left out when
its source published nothing:

| Field | Reported when | Omitted when |
| --- | --- | --- |
| `cacheHitRatio` | the `ep_cache_miss_rate` series has a numeric last sample | the series is absent - the stats endpoint was denied, or the bucket publishes no `ep_*` series |
| `queriesPerSecond` | at least one of `cmd_get` / `cmd_set` was published | neither was published |
| `bufferPoolUsage` | `basicStats.quotaPercentUsed` is a number | `basicStats` is missing, meaning the bucket endpoint was unreadable |

A measured `0` is kept in every one of those cases. A bucket with no misses
really is at a 100% hit ratio, an idle bucket really is doing 0 operations, and
an empty bucket really is using none of its quota. The distinction the table is
drawing is between zero and unknown, and the reason it is drawn this hard is a
bug this provider shipped once.

The cache ratio used to fall back to `0` when the miss-rate series came back
null. The stand-in was chosen for a defensible reason: 100 would have been
flattering, and a flattering default on a metric nobody measured is worse than a
pessimistic one. But the health thresholds rate the cache hit ratio with
`direction: "below"` and `critical: 80`, so a 0 is not neutral - it is the worst
possible reading. Every bucket whose KV statistics the connected user was not
allowed to read rendered a red critical cache fault that the cluster had never
reported. Because reading those statistics needs a role many application users
lack, that was the common path, not an edge case.

The fix is the rule in the table above. Omitted, the same panels render `N/A` or
"Not measured" and score the card as healthy, so an operator can tell a failing
cache from a metric they have no permission to see. A stand-in destroys that
distinction in both directions: it invents an alert no system raised, and it
teaches the reader to ignore the next one.

The same reasoning shapes what the slow-query panel means when it does have data.
Rows come from `system:completed_requests`, one row per recorded request, so
`calls` is always 1. These are individual requests, not aggregates. If you are
looking for the statement that ran ten thousand times, this panel will not group
it for you, and it does not pretend to.

## One deliberate exception to the degrade-to-empty rule

Degrading to empty is safe when empty is a meaningless value. It is not safe when
empty already means something specific, and on Couchbase there is exactly one
such read.

`getSchemaRelations()` reads the index catalog. An empty index list is not a
neutral result on this engine: it is the signal that a keyspace is un-indexed,
which changes how the collection reads. From Server 7.6 the query service falls
back to a sequential scan, so an un-indexed collection opens - verified on
Community Edition 8.0.2, where `EXPLAIN` shows the fallback explicitly:

```json
{ "#operator": "PrimaryScan3", "index": "#sequentialscan", "using": "sequentialscan" }
```

On Server 7.0 to 7.2 the same statement fails with error 4000 instead.

So if a denied catalog read degraded to `[]` there, the interface would report
that every collection in the bucket is un-indexed, on the strength of having read
nothing. That is a fabricated finding, not a missing one, and it would send
someone to create indexes that already exist. The read is allowed to fail loudly
instead. One exception, written down where the rule is, for the one case where
the fallback value carries a claim of its own.

## Sizes the server no longer publishes

The last gap on this dashboard is not a permission at all, and it is easy to
mistake for one.

Per-index sizes came from `/pools/default/buckets/@index-<bucket>/stats`. Modern
servers no longer publish a per-index series there. When there is none, the index
row shows `indexSize: "N/A"` and `indexSizeBytes` is omitted entirely rather than
set to 0 - because a `0 B` reads as an empty index, and the Storage tab summed
those zeroes into a total that was quietly wrong.

`scans` is the one field that still falls back to 0, and only because
`IndexStats.scans` is a required field on the shared type. Read a 0 there as
"not measured" unless you know the account holds the catalog role. That is the
one seam where the omission rule could not be applied, and it is stated here
rather than smoothed over - the same way the rest of the
[capability model](/features) names what each engine cannot answer.
