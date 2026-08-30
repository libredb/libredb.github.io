---
title: Three Cassandra panels refuse rather than report a zero
status: published
author:
  name: LibreDB
  picture: ''
slug: cassandra-monitoring-panels-that-refuse
description: Table, index and storage statistics send no statement at all and carry the measurement behind the refusal, because no honest count or size exists to publish.
coverImage: ''
tags:
  - value: engineering
    label: Engineering
  - value: databases
    label: Databases
publishedAt: 2026-05-31T09:00:00.000Z
---

On 21 August 2026 the monitoring Tables tab, connected to Apache Cassandra 5.0.9,
read *Tables* `0` over *0 rows*, *Size* `0 B` over *Total*, and *Vacuum* `0` over
*OK*. In the same frame, on the same connection, the Overview tab read
*Tables 6 / 2 indexes* out of `system_schema`. Nothing had failed. A panel with
no data had drawn the only number it had a slot for, and every one of those zeros
claimed a measurement.

A row count and a size would each have to come from a catalog read on this
engine, and the case for refusing the panel outright is contained in what those
two reads actually measure.

## What the estimate table actually counts

`system.size_estimates` is the table a browser reaches for. It publishes 17 rows
per table, one per token range, refreshed every five minutes. It does not count
rows. It estimates **partitions**, from **flushed SSTables only** - two
departures from the number a reader assumes they are looking at, both measured
against 5.0.9:

| Table | Real rows | `size_estimates` sum | Error |
| --- | --- | --- | --- |
| Just loaded, not yet flushed | 500 | 0 | everything |
| One partition per row | 500 | 525 | 5% high |
| 10 partitions x 50 clustering rows | 500 | 143 | 71% low |

The clustered shape, which is the one the data model encourages, is out by more
than two thirds. Nothing on screen tells the reader which shape they are looking
at, so no caveat beside the figure would make it usable: the error is not a
margin but a function of a modelling decision the panel cannot see.

`SELECT COUNT(*)` is exact, and it is a full scan of the ring. A user can type one;
nothing in the tree or the panels does. There is a second reason beyond cost:
measured on a node with a 10 ms read timeout,
`SELECT COUNT(*) FROM probe.customers` was the single statement that returned a
server read timeout while every single-partition read succeeded.

## What the disk usage view actually rounds to

`system_views.disk_usage` is the size half, and it reports whole mebibytes.
Measured: `1 MiB` for a table holding 19,476 bytes, and `0 MiB` for a table
holding 500 rows that had not yet been flushed.

A byte figure derived from that is wrong by up to 50 times, and wrong upward,
which is the direction that gets a capacity decision made; summing it per
keyspace multiplies the rounding.

So, the boundary. **No row count and no size is reported anywhere on this engine.**
The estimate table counts partitions per token range from flushed data only, and
the disk usage view reports whole mebibytes, so both are withheld rather than
approximated. There is no `rowCount` and no `size` on any table in the tree,
`databaseSize` reads `N/A`, and `databaseSizeBytes` is omitted from the payload
rather than set to zero.

Omitting rather than zeroing matters down to the field: the Storage tab read that
value as `?? 0`, so a zeroed field produced a `0 B` total and divided a 0.0%
breakdown out of it. With the field absent, its two size cards read `N/A` and the
breakdown is replaced by a sentence.

## Refusing versus answering empty

An empty array is an answer: the engine was asked, looked, and found nothing.
That is a different fact from *this engine has no such measurement*, and on a
monitoring surface the difference is the message.

`getMonitoringData` reads seven panels independently. A refused panel is left out
of the payload with the engine's own sentence recorded against it, and the
unavailable-panel component renders that sentence where the figures would be.
Until this changed, three panels answered `[]` for questions they could never
answer, and two more did on builds with no `system_views` keyspace. The
browser showed the cost: on ScyllaDB the Sessions tab read *Active 0 / Idle 0 /
Wait 0 / Sessions (0) / No active sessions found* for a question that build
cannot be asked at all.

Three panels are refused on every Cassandra build, each carrying the
measurement behind the refusal:

| Panel | Why it sends nothing |
| --- | --- |
| Table statistics | A count would come from `size_estimates` (143 for a 500-row clustered table) and a size from `disk_usage` (1 MiB for 19,476 bytes) |
| Index statistics | `system_schema.indexes` names an index, its table and its target column, all already in the tree, and nothing in CQL reports a secondary index's size or usage |
| Storage statistics | `disk_usage`, `max_partition_size` and `max_sstable_size` are all whole mebibytes per table |

None of the three sends a statement: the refusal is a declared property of the
engine, not the outcome of a failed read.

One panel stays empty on purpose. Slow queries: no aggregate of
finished statements is readable from CQL, and the slow-query threshold writes to
the node's log file rather than to a table, so the panel carries that sentence as
its empty state.

The Vacuum card applies the same rule to a capability rather than to data. It
reads `N/A` over *Not supported* instead of a green *OK* for an operation this
engine does not have: compaction, cleanup, flush and repair are `nodetool`
commands over JMX, not statements a session can send.

## What the panels that do answer read from

Refusing this much is only defensible if the rest are real reads:

- **Version and uptime** from `system.local`: `release_version`, and
  `gossip_generation` compared against `toTimestamp(now())` so the arithmetic
  uses the server's clock, and that generation is a start time by measurement
  against container start times rather than by its name.
- **Table and index counts** from `system_schema`, scoped to the pinned keyspace.
- **A connection count** from `system_views.clients` - omitted, not zeroed, when
  the read is refused: a successful `COUNT(*)` always returns exactly one row, so
  an empty result set is the signature of the degradation.
- **One performance field**, `cacheHitRatio`, from the key-cache row of
  `system_views.caches`. The rest are omitted: Cassandra publishes per-table
  percentiles rather than cluster rates, so there is no queries-per-second figure,
  and it keeps no deadlock counter at all. Those cards read `N/A` beside
  *Not measured* rather than drawing a flat line along zero.
- **Active sessions** from `system_views.queries`: a thread id, the task text and
  two microsecond readings. No user, no keyspace, no client address, so user and
  database are reported as `unknown` rather than borrowed from the connected role.

That is the [capability declaration](/features) at work: a control renders from
what the provider says it can answer.

## A structural probe instead of matching an error message

The two panels whose only source is `system_views` must know whether the keyspace
exists before reading it. The first implementation asked by sending the
read and inspecting the refusal. Through the driver, all of these arrive as a
`ResponseError` with code 8704, keyspace and table properties undefined:

| Sent | Server | Message |
| --- | --- | --- |
| `system_views.clients` | ScyllaDB 2026.2.4 | `Keyspace system_views does not exist` |
| `system_views.cliets` | Cassandra 5.0.9 | `table cliets does not exist` |
| `system_viewz.clients` | Cassandra 5.0.9 | `keyspace system_viewz does not exist` |

Reading the sentence works until a release rephrases it, at which point five
panels go dark and no test notices. The discriminator is now a catalog read:
`system_virtual_schema.keyspaces`, sent once per successful connect, measured at
4.5 ms on 5.0.9 and 1.6 ms on ScyllaDB. The catalog choice was itself a
measurement: a virtual keyspace appears in neither engine's
`system_schema.keyspaces`, so keying on the ordinary catalog would have blanked
all five panels on the engine that answers them. What comes back is not a boolean
but the reason, because a missing catalog, a catalog that lists no
`system_views`, and a refused grant send a reader to three different places. On a
build without the keyspace, a monitoring refresh sends three fewer statements
than the catch-the-refusal version did.

ScyllaDB is where the rule gets exercised. It has no `system_views` keyspace at
all: the editor, the object browser and every column and index read work, and the
panels fed by a virtual table say why they cannot. A zero would
have been easier to render, and would have been a lie about a measurement nobody
took.
