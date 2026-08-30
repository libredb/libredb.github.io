---
title: A missing Druid datasource is an availability question first
status: published
author:
  name: LibreDB
  picture: ''
slug: druid-catalog-shows-what-is-servable
description: Marking segments unused removes a datasource from the catalog entirely, and a stopped node makes an existing one answer with the same error as a typo.
coverImage: ''
tags:
  - value: engineering
    label: Engineering
  - value: databases
    label: Databases
publishedAt: 2025-12-24T09:00:00.000Z
---

A statement that worked yesterday answers `Object 'libredb_demo' not found`, and the
datasource is gone from the tree. The message names a line and a column, so the first
instinct is to check the spelling, the quoting and the schema. On Apache Druid that
instinct is usually wrong, because the catalog is not a list of things that exist. It
is a list of things a server is currently advertising.

## What the catalog actually enumerates

Schema introspection on Druid is two `INFORMATION_SCHEMA` reads, run in parallel:
datasources from `INFORMATION_SCHEMA.TABLES` where `TABLE_SCHEMA = 'druid'`, columns
from `INFORMATION_SCHEMA.COLUMNS` where `TABLE_SCHEMA = 'druid'`, ordered by
`TABLE_NAME, ORDINAL_POSITION`. Indexes and foreign keys are always empty arrays,
because Druid has no index object to describe and no datasource can reference another.

```sql
SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = 'druid';
```

That is the whole sidebar. It touches no `sys` table at all, which is why a cluster
that declines to describe its own servers still renders a full tree, and why the tree
can be confident and wrong at the same time.

The schema predicate is also the only thing keeping the rest out. The same catalog
carries the `INFORMATION_SCHEMA` views and the six `sys` tables as
`TABLE_TYPE = 'SYSTEM_TABLE'`, and a cluster with lookups or views carries rows under
a `lookup` or `view` schema besides. Five schemas exist under the single catalog
Druid reports, always named `druid`. Only one of them is listed. Everything excluded
stays queryable by typing SQL; it is unlisted, not unreachable.

What matters here is what `INFORMATION_SCHEMA.TABLES` is built from. The Broker
assembles it from the segments servers are announcing. A datasource with no announced
segments is not a row with a zero in it. It is not a row.

## Unused segments and a datasource that disappears

Druid SQL cannot delete. `DELETE FROM t WHERE ...` answers `Unsupported SQL statement
[DELETE]`, and `UPDATE` answers the same for `UPDATE` - neither is in the grammar
anywhere, on any engine. Data leaves a datasource through the Coordinator instead, by
marking segments unused and then submitting a kill task. The Coordinator answers on
`8888` when the Router's management proxy is enabled.

```sh
curl -s -XPOST -H 'content-type: application/json' \
  -d '{"interval":"1000-01-01/3000-01-01"}' \
  http://localhost:8888/druid/coordinator/v1/datasources/libredb_rollup/markUnused
# {"numChangedSegments":3,"segmentStateChanged":true}
```

Verified on Apache Druid 37.0.0: the first step alone is enough. `libredb_rollup`
vanishes from `INFORMATION_SCHEMA.TABLES` and from `sys.segments`, and `markUsed`
brings it back. Nothing was deleted. The segment files are still in deep storage and
the rows are still in the metadata store, and the catalog has no way to say so.

The practical consequence for anything that renders a schema tree is that there is no
empty-datasource state to design. A datasource with every segment unused does not
appear as an empty node; it is absent. An empty result from that query means "no
servable datasources", not "no datasources".

## A stopped node: Druid object not found, datasource intact

The second way a datasource leaves the catalog is that the process serving its
segments stopped. Verified on the same cluster, with the Historical down and nothing
else advertising the data:

```sh
docker stop libredb-druid-historical
curl -s -XPOST -H 'content-type: application/json' \
  -d '{"query":"SELECT COUNT(*) FROM libredb_demo"}' http://localhost:8888/druid/v2/sql
```

```json
HTTP 400
{"error":"druidException","errorCode":"invalidInput","persona":"USER",
 "category":"INVALID_INPUT",
 "errorMessage":"Object 'libredb_demo' not found (line [1], column [27])"}
```

The datasource still exists in the metadata store. The Broker simply has no server
advertising its segments, so it is not in the catalog, and the failure is classified
`INVALID_INPUT` - blaming the statement, and naming a line and a column in it.

## Why the status and the category cannot tell them apart

Here is the limit, stated plainly, because a reader who does not know it will spend
the outage editing SQL. A datasource whose segments are all unused disappears from
the catalog entirely, and a stopped serving node makes an existing datasource answer
with the same status and the same category as a mistyped name. `SELECT * FROM nope`
produces the identical envelope: HTTP 400, `druidException`, `errorCode:
invalidInput`, `category: INVALID_INPUT`, `persona: USER`. There is no field in it
that separates a typo from an unavailable cluster.

Classification in this provider is on `category` rather than the HTTP status, because
the status misclassifies in both directions - `SELECT 1/0` answers HTTP 500 with
`persona: "ADMIN"` and `category: UNCATEGORIZED`, and reading that 5xx as a broken
cluster would send the user to check their host over a division. `persona` is carried
for display and never branched on, for the same reason. But categorising correctly
does not help here: the category Druid reports is genuinely the same one, and the
wording is Druid's own. Nothing in a client can improve that message.

Partial unavailability is different, and worth knowing because it is the case that
does get a signal. Druid serves a query over segments it cannot reach as an ordinary
200, so a short row set and a correct one look alike in the body. The transport reads
the length of the `missingSegments` list in the `X-Druid-Response-Context` header and
turns a positive count into a result warning: `This result is incomplete: N segments of
the queried data were unavailable.` Some of the data missing is a warning on a success.
All of it missing is a not-found error about your spelling.

## Where to look before rewriting the statement

Two reads answer it, and neither is in the schema tree.

```sql
SELECT server, server_type, curr_size, max_size FROM sys.servers;
SELECT datasource, COUNT(*) AS segments, SUM(num_rows) AS total_rows
FROM sys.segments WHERE is_active = 1 GROUP BY datasource;
```

A missing `historical` row in the first is what to look for. The monitoring panels
read exactly these: storage is `sys.servers` where `server_type = 'historical'`,
and per-datasource statistics group `sys.segments` where `is_active = 1`. If the
datasource is absent from both, check the Coordinator for unassigned segments and for
an interval someone marked unused.

Two things this cannot become. There is no query log to consult afterwards - Druid
keeps none, in no system table, at no endpoint, in no file - so the failed statement
leaves no trace to read later. And an agent cannot go and look for you: agent AUTO mode
runs only on PostgreSQL, SQLite and DuckDB, because the read-only profile it needs is
database-native, and on a Druid connection an auto run ends `engine-unsupported`. PLAN
mode opens on the connection and will draft the `sys.servers` statement, toolless, for
a human to run.
