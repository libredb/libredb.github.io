---
title: One closed index and the storage figure becomes N/A
status: published
author:
  name: LibreDB
  picture: ''
slug: opensearch-monitoring-partial-absence
description: A failed cluster read produces no storage row at all rather than one claiming zero bytes, and a partial sum is refused for exactly the same reason.
coverImage: ''
tags:
  - value: engineering
    label: Engineering
  - value: databases
    label: Databases
publishedAt: 2026-03-03T09:00:00.000Z
---

Close one index on an OpenSearch cluster, open the monitoring surface, and the
Data figure for every other index goes away with it. That is not a bug report
waiting to be filed. It is the rule this provider applies everywhere it reads a
number: a panel either shows a figure that means what it says, or it shows N/A
and says why. A partial sum would be a measurement of the cluster that no longer
describes the cluster.

The monitoring rating for this engine is `partial`, and the word is doing
precise work. Some panels answer; some are empty because the cluster has nothing
of that shape to report. Those two states are drawn differently, so an empty
panel does not read as a failed one.

## What answers from the cluster APIs

There is no driver here. Every statement and every monitoring read is one
stateless HTTP request through the runtime's own `fetch`, against port 9200 for
both schemes. Monitoring reads four REST endpoints and no more: `/`,
`_cluster/health`, `_cluster/stats` and `_cat/indices`.

From those, four panels come back populated:

| Panel | Read from | What it reports |
| --- | --- | --- |
| Overview | `/`, `_cluster/health`, `_cat/indices`, `_cluster/stats` | version, cluster health, user index count, cluster store size |
| Health | the above, composed | status colour and the size, with the unknowns carried across as unknown |
| Tables | `_cat/indices` | one row per user index: `docs.count` as rows, `pri.store.size` as size |
| Storage | `_cluster/health` plus `_cluster/stats` | one row for the cluster, sized from `indices.store.size_in_bytes` |

Two counts in that overview are named for a relational world and mean something
else here. `tableCount` counts indices, because an index is the table on this
surface, and it counts the user's indices only - the same set the schema tree
shows by default, so the panel and the sidebar cannot disagree. `indexCount` is
0 and stays 0, because there is no secondary index object to count: every mapped
field is inverted-indexed as a property of being mapped.

One number needs a caveat before it misleads someone. An index whose mapping
declares `nested` fields reports more documents than a `SELECT COUNT(*)` against
it returns - measured, a probe index reporting 2 documents in `_cat/indices`
answered 1 from SQL - because every nested element is stored as a document of
its own. The panel reports the cluster's document count; the editor reports rows
in a result.

## Panels that are empty by construction, not unimplemented

Performance metrics, slow queries, sessions and index statistics are
structurally empty here rather than unimplemented, and there is no query
cancellation, because aborting only ends this client wait while the cluster
finishes the statement. The deadline is one `AbortSignal.timeout` per operation:
it closes this socket and sends the cluster no cancellation request at all. A
cancel button would end your wait and change nothing about the load you were
trying to shed, so there is no cancel button.

The sessions panel is the cleanest case. A request here is one HTTP request:
no session, no connection catalog, nothing that could be listed.
`getActiveSessions()` returns an empty list rather than throwing, because
nothing is broken and nothing is misconfigured.

Index statistics are empty for the same reason `indexCount` is 0. There is no
secondary-index object anywhere in this engine's model to have statistics about.

Performance metrics return `{}` and ask the cluster nothing, and the empty
object rather than a set of zeroes is load-bearing. Cache hit ratio is scored
with a critical threshold at 80 and a direction of "below", so a helpful zero
would paint a red cache fault on every healthy cluster in the fleet. An absent
ratio defaults to healthy instead, and the cards that have no measurement read
N/A beside "Not measured". Until that rule reached these tabs, a measured run on
a stock 3.8.0 node showed Buffer Pool 0% and Deadlocks 0 for two fields this
payload simply does not contain.

The slow-query panel is the one that is a choice rather than an impossibility,
and the published empty state says so: the slow log is written to the node's own
log file, which no API returns. This product also keeps a `top_queries-<date>`
index, which the schema tree hides as engine bookkeeping. Reading it would
populate a panel for some of the connections served by this one provider
implementation and leave the rest blank - a monitoring surface whose contents
depend on which product answered. An honest empty panel beats a panel that is
sometimes populated for reasons the user cannot see.

## Why a partial sum is refused

Now the closed index. `getTableStats()` has required fields and optional ones,
and a closed index splits them. `rowCount`, `totalSize` and `totalSizeBytes` are
required numbers, so a closed index has nowhere to write but zero. `tableSize`
and `tableSizeBytes` are optional, so they are absent instead - a zero there
would be a fabricated measurement rather than a forced one.

The Storage tab then gates its cluster-wide Data figure on every index having
published a size. One index without one, and the Tables card reads N/A for the
whole cluster rather than summing the indices that did answer.

That costs a number people want. It buys the guarantee that when the figure is
present, it covers everything. A sum over the indices that happened to answer
would read as the size of the cluster, and it would be wrong by an amount
nothing on screen discloses. The open-beside-closed pair is pinned in the
provider's integration test, so the aggregate is asserted rather than assumed.

## No row beats a row claiming zero

`_cluster/stats` is heavier and more privileged than `_cluster/health`. A
cluster that answers health and refuses stats is an ordinary configuration, not
a fault, so the store-size read catches its own failure and returns null - the
one swallowed failure in this provider's monitoring. Losing the health status
over a missing byte count would blank a panel that already had the important
number.

What matters is what that null does next. The overview prints "N/A" for the size
and omits the byte key entirely. `getStorageStats()` returns no row at all,
rather than a row naming the cluster and claiming it stores zero bytes. The
Storage tab keys its refusal off the missing key and draws that refusal, instead
of a 0 B total with a 0.0% breakdown underneath it.

An earlier version paired a `0` with the `"N/A"` it printed from the same input:
one object making two claims about one unknown. A cluster that genuinely stores
nothing publishes a real 0, and keeps it.

The same encoding rule runs through the overview, in both directions.
`activeConnections` is absent rather than 0: the cluster counts open HTTP
connections per node in a stats API this seam does not call, and the shard and
node counts that are here
would be a different number wearing that field's name. `maxConnections` is 0,
correct for the opposite reason - for a ceiling, zero and absence are the same
fact, so the card reads it as no published limit rather than dividing by it.
`uptime` is "N/A", because "0s" would claim the cluster booted this instant.

## What would have to change to fill the empty panels

Two of the four empties are reachable, and they are recorded as gaps rather than
as impossibilities.

Performance metrics are the closer one: those numbers exist on this product's
stats endpoints, so filling that panel means widening the seam by one call. It
stays empty until that happens rather than showing plausible zeroes meanwhile.
Slow queries need the same widening plus an answer to the consistency problem
above.

The other two do not have a version of themselves that could arrive. Sessions
and secondary-index statistics are absent from the engine's model, not from this
integration, and no amount of work here produces them.

That distinction is why the empty states are published rather than left for a
reader to infer. Each page in the [engine reference](/databases) carries what is
deliberately absent next to the transport and the port, and the
[monitoring surface](/features) declares which tabs an engine can fill before
rendering any of them. A blank panel and a broken panel look identical on
screen; the text beside them is the only thing that separates the two.
