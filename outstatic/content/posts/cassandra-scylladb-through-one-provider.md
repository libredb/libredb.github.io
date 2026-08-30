---
title: Connecting ScyllaDB through the Cassandra integration
status: published
author:
  name: LibreDB
  picture: ''
slug: cassandra-scylladb-through-one-provider
description: The editor, the object browser and every CQL type read back identically, and the panels that go quiet do so because one virtual keyspace is not there.
coverImage: ''
tags:
  - value: engineering
    label: Engineering
  - value: databases
    label: Databases
publishedAt: 2026-08-09T09:00:00.000Z
---

There is no ScyllaDB row in the connection dialog. A ScyllaDB GUI client connect
starts here by choosing Cassandra, because the server speaks the CQL wire protocol on
port 9042 and `cassandra-driver` 4.9.0 opens a session against it. What follows is which
surfaces behave the same, which ones go quiet, and why the version in the header is not
the product's own number.

## One integration, two servers: the ScyllaDB GUI client connect path

The connection form is the Cassandra form, with the same fields that surprise people on
this engine. `localDataCenter` is required and sits in the open rather than behind the
Advanced accordion, because the driver refuses to build a load-balancing policy without
it. There is no connection string and no paste toggle: no URI convention carries a local
data centre, so a paste field would parse into a connection that cannot open.

Two builds have been probed against a running instance and recorded as `partial`
wire-compatible relatives: ScyllaDB 2026.2.4 and 2025.1.14, both on a single-node container.
They behaved identically on every surface, which is why one registry entry describes both
lines and only those two builds. Nothing managed, nothing clustered.

One local setup detail is easy to lose an hour to: a keyspace on the 2026.2 line must use
`NetworkTopologyStrategy`, because that line refuses `SimpleStrategy`.

```sql
CREATE KEYSPACE probe
  WITH replication = {'class': 'NetworkTopologyStrategy', 'datacenter1': 1};
```

## What reads back identically

Thirteen surfaces were called separately through the provider against ScyllaDB 2026.2.4
and, in the same pass, against `cassandra:5.0.9` as the control. Eight passed on both,
which covers the two things most people are here for. The editor
runs CQL and returns a grid. The object browser reads the same four statements against
`system_schema` — `tables`, `views`, `columns` and `indexes` — so tables, materialized
views, column types, kinds, positions, clustering order, and index kind and target column
all arrive. Columns are ordered partition key, then clustering columns, then everything
else alphabetically, because `system_schema.columns.position` is -1 for every regular
column and the server returns rows sorted by name. That is the order `DESCRIBE TABLE`
prints and the order a `WHERE` clause needs, on both servers.

All 18 CQL types round-tripped byte-identically to the 5.0.9 baseline, compared field by
field: `bigint` 9007199254740993 as a string rather than a float that has already lost
its last digits, `varint` 123456789012345678901234567890, `duration` as its CQL literal
`3h20m`, `blob` as bytes, plus `decimal`, `inet`, `date`, `time` `12:00:00.123456789`,
list, set, map, `uuid` and `timestamp`. Normalization happens once at the driver
boundary, so the grid and the export see the same values on either server.

Errors classify the same way even though the servers do not word them the same way. A
missing table is `unconfigured table no_such_table` on ScyllaDB and `table no_such_table
does not exist` on Cassandra. Both arrive as the recognised query error, because the
classifier reads the driver's numeric protocol code and never the server's sentence.

Two things are absent for the integration rather than for the server, and they are absent
on both. There is no EXPLAIN — the keyword is not in CQL's grammar, so the button and the
tab are not rendered rather than rendered dead. And Agent AUTO mode ends
`engine-unsupported`, because a tool-using run needs a database-native read-only
statement path, and that exists on PostgreSQL, SQLite and DuckDB only. Agent PLAN mode opens
on the connection as it does everywhere: toolless, executing nothing, drafting a
statement for a person to run.

## The virtual keyspace that is not there

The entire delta between the two servers has one cause. ScyllaDB publishes no
`system_views` keyspace. `system.local` answers, `system_schema.*` answers,
`system.size_estimates` answers. `system_views.clients`, `.queries`, `.caches`,
`.system_logs` and `.disk_usage` do not exist to be denied.

The first implementation found that out by reading the refused keyspace name out of the
server's error message, and that was the wrong instrument. Four different mistakes come
back as the same protocol code 8704 with the driver's own `keyspace` and `table`
properties undefined: an absent keyspace, and a typo in a keyspace, table or column name.
A build that rephrased any of those sentences would have stopped matching and taken five
panels with it.

The discriminator is a catalog read now. On each successful connect the provider reads
`system_virtual_schema.keyspaces` once — measured at 4.5 ms against Cassandra 5.0.9 and
1.6 ms against ScyllaDB — and resolves not a boolean but a reason: the catalog lists no
`system_views`, there is no `system_virtual_schema` catalog at all, or the connected role
may not read it. Those are three different problems that send a reader to three different
places, so they are three different sentences.

It has to be that catalog and not `system_schema`. A virtual keyspace does not appear in
`system_schema.keyspaces` on either server, so keying on that would have blanked all five
panels on the engine that answers them. With the reason known, a monitoring refresh on
ScyllaDB sends three fewer statements than the catch-the-refusal version did, because the
reads that need `system_views` are never sent.

## Which panels report absence, and with what reason

**ScyllaDB publishes no system views keyspace, so the
performance panel and the active-session panel report absence with their reason rather
than rows, the connection count is omitted from the overview entirely, and the version on
screen is the compatibility number the server publishes rather than its own release.** If
you need cache-hit ratios and a running-statement list from the monitoring dashboard,
this connection will not give them to you, and it will say so in words rather than draw a
zero.

An empty array is a claim: it says the engine looked and measured nothing. So a panel
whose only source is a virtual table is left out of the payload with its reason recorded
beside it, and the tab renders that sentence where the figures would have been. Before
that change the Sessions tab on ScyllaDB read *Active 0 / Idle 0 / Wait 0 / No active
sessions found* for a question the build cannot answer.

| Panel | Cassandra 5.0.9 | ScyllaDB 2026.2.4 |
| --- | --- | --- |
| Overview | version, uptime, table and index counts, connections | same, minus the connection count |
| Performance | `cacheHitRatio` from `system_views.caches` | refused, naming the absent catalog |
| Active sessions | the running statements | refused, naming `system_views.queries` |
| Table, index and storage statistics | refused, on both, with their own measurements | refused, identically |
| Slow queries | empty, with the reason in the panel label | empty, same reason |

The bottom two rows are the point of the table. Those four panels behave the same on both
servers, because their cause is Cassandra's own: there is no honest row count and no
honest size to report, and no aggregate of finished statements readable from CQL at all.
The compatibility story is narrower than it looks from a distance.

The omitted connection count is worth one more sentence. `activeConnections` is an
optional field and the provider leaves the key out rather than sending a 0, so the
overview renders *not published* rather than *0 connections*, and the agent's health
reading receives `null` rather than a number about a server nobody measured.

One difference shows in the tree rather than the dashboard: ScyllaDB backs a secondary
index with a materialized view, so an index appears in `system_schema.views`, which the
tree reads, and not in `system_schema.tables`, which the overview's table count reads. On
a keyspace of three tables and one index, the tree lists four objects and the count says
three.

## Why the version shown is not the product version

The header reads **Apache Cassandra 3.0.8** on a ScyllaDB 2026.2.4 server, and that is
not a bug in the panel. `system.local.release_version` is the compatibility number the
server publishes, and it is the field this provider reads. The product's own version
lives in `system.versions`, which this provider does not read.

That is a confusing figure for a human reading a version string, so it is published as
what it is rather than swapped for a friendlier one, and the caveat travels with it on
the [engine pages](/databases). The [capability declarations behind those
panels](/features) are data rather than layout, which is why a panel here can report
absence with a sentence rather than fail the screen it sits on.
