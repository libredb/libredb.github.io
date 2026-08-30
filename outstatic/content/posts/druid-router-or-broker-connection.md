---
title: Connecting to Apache Druid on the Router or the Broker
status: published
author:
  name: LibreDB
  picture: ''
slug: druid-router-or-broker-connection
description: Both ports serve the identical SQL endpoint and nothing in the connection knows which it reached, and there is no database field because there is one catalog.
coverImage: ''
tags:
  - value: engineering
    label: Engineering
  - value: databases
    label: Databases
publishedAt: 2026-03-28T09:00:00.000Z
---

The Apache Druid SQL endpoint is `POST /druid/v2/sql`, served on port `8888` by
the Router and on `8082` by the Broker. A connection form that offers you that
choice makes it look like the choice changes something. It does not.

## One endpoint, two ports, no difference

There is no driver in this path. Druid ships a JDBC driver, but it addresses
Avatica and needs a JVM client library, and there is no Node client in Druid's
own distribution. So every statement is a JSON body sent with the runtime's own
`fetch`, and `package.json` is untouched: no native module in the Docker image
and none in any distribution channel.

That endpoint is the same one on both ports. This was verified on both ports of
one cluster rather than assumed: the same request body, the same three-header-row
response envelope, the same error envelopes, and `sys.servers` returning the same
six rows from either.

```sh
curl -s -XPOST -H 'content-type: application/json' \
  -d '{"query":"SELECT COUNT(*) AS c FROM sys.servers","resultFormat":"array",
       "header":true,"typesHeader":true,"sqlTypesHeader":true}' \
  http://localhost:8082/druid/v2/sql
# [["c"],["LONG"],["BIGINT"],[6]]
```

Nothing in the provider knows which of the two it reached. Monitoring works on
either, because the panels are SQL over `sys.*` and `INFORMATION_SCHEMA` on the
same path.

The Router is the default only because it fronts more. It carries the SQL API,
the web console, and - when `druid.router.managementProxy.enabled` is set - the
Coordinator and Overlord APIs, so one port is enough for both querying and
loading data. A Broker-only deployment needs no different configuration; type
`8082` and everything works, monitoring included.

So the port is an ingress decision, not a configuration difference. Ask which
process your network already exposes, not which one the tool prefers.

## Why there is no database selector

The form has exactly four fields: `host`, `port`, `user`, `password`. There is no
`database` row, and its absence is the engine rather than an omission.

`INFORMATION_SCHEMA.SCHEMATA` reports exactly one catalog, always named `druid`.
Five schemas exist under it - `druid`, `INFORMATION_SCHEMA`, `lookup`, `sys` and
`view` - but only `druid` holds datasources, it is the default schema, and the
other four are fixed. A database selector would therefore be a control with no
effect, and worse, a control implying a scoping decision the user does not have.
Because `druid` is the default schema, `SELECT * FROM "libredb_demo"` resolves
unqualified.

That same reasoning is why the connection carries no pasted URL, and this is the
limit worth reading twice: **there is no connection string field on a Druid
connection, and the only credential path is HTTP basic authentication for the
`druid-basic-security` extension.** Druid has no URI convention for its HTTP SQL
API. Its own JDBC
driver addresses Avatica as
`jdbc:avatica:remote:url=http://host:8888/druid/v2/sql/avatica/`, which is not a
string the shared parser can round-trip into host, port, user and password, and
inventing `druid://` would add a parser branch for a string no Druid user has
ever typed. Meanwhile `http://` and `https://` are already claimed by another
engine in that parser, so pasting a Router URL resolves to the wrong engine
entirely. The consequence is recorded rather than hidden: the form has no paste
tab, and a test pins both halves of the absence so a later reader does not read
it as a gap.

## Credentials on a cluster with no security extension

`user` and `password` are optional, and optional here means something stronger
than usual. A default Druid install loads no security extension and ignores the
`Authorization` header entirely - live-verified, a bogus `Basic` header still
answers `200`. Leaving both fields empty against a stock cluster is the correct
configuration, not a shortcut.

When they are set, they travel as HTTP basic authentication, and only when `user`
is set. There is no token field and no other scheme, so a managed endpoint that
authenticates some other way is not something this connection has been verified
against.

TLS is separate from the form. Any `ssl` mode but `disable` switches the
transport from `http` to `https`, and the port is not changed with it, because a
TLS Druid serves on whatever `druid.tlsPort` the deployment chose and there is no
well-known value to guess. One more boundary belongs here: `ssl.caCert`,
`ssl.clientCert` and `ssl.rejectUnauthorized` are not honoured, because global
`fetch` cannot carry a custom CA or relax verification without an undici
dispatcher and undici is not a dependency. A cluster behind a self-signed
certificate fails verification; one with a publicly trusted certificate works.

`connect()` proves the endpoint with one `SELECT 1`, which the planner answers
from a one-row inline datasource, so it succeeds on a cluster that has ingested
nothing yet. A wrong port, a Druid process that is not a query endpoint and a
rejected credential all surface while you are still looking at the form.

## What to expose through an ingress

A Druid cluster is not a single container and cannot pretend to be one. Locally,
`docker compose -f database-compose.yml --profile druid up -d` in the studio repo
brings up seven services pinned to `apache/druid:37.0.0` - Coordinator and
Overlord, Broker, Historical, MiddleManager, Router, plus ZooKeeper and Druid's
own metadata database. Measured with `docker stats` on the idle cluster it adds
about 4 GB of resident memory, which is why the profile is opt-in. Only two ports
are published, `8888` and `8082`, so the Broker-equivalence claim above can be
proven rather than assumed.

Point a connection at `127.0.0.1:8888` with no credentials and you are done. A
datasource, though, can only be created by ingestion: there is no `CREATE TABLE`
in Druid's grammar and no seed sidecar, so the fixture data is loaded by
submitting a native batch task with an inline input source to
`POST /druid/indexer/v1/task` through the Router's management proxy - which is
the concrete reason the Router's extra surface is worth having in a dev cluster.

For a real deployment the rule follows from the architecture this whole product
is built on: [the tool goes to the data](/get-started), so what you expose is one
HTTP port on one process inside the network the cluster already lives in.
Fronting Brokers with the Router or a load balancer is what a Druid deployment
does anyway, and that is exactly the host a connection should point at - which
matters, because one statement is one `fetch` to one host with no failover and no
retry. A Broker restart surfaces as an error rather than being retried against a
second Broker.

## What the object browser calls a table

The sidebar does not say "table". It says **Datasource**, in the singular and the
plural, because Datasource is the Druid word for a table. The tree is built
from two parallel `INFORMATION_SCHEMA` reads - datasources from `TABLES` where
`TABLE_SCHEMA = 'druid'`, columns from `COLUMNS` with the same filter, ordered by
`TABLE_NAME, ORDINAL_POSITION`. It touches no `sys` table, so a cluster that
declines to describe its servers still renders a full sidebar. Indexes and
foreign keys are always empty lists: Druid indexes every dimension inside its
segment, but those indexes have no index object to describe, and no datasource
can reference another.

No column is reported as primary, `__time` included. `__time` is mandatory, is
the partitioning and sort key, and is the only column Druid reports as
`IS_NULLABLE = 'NO'` - but it is not unique. In the fixture, 50 rows carry 30
distinct `__time` values. Primary-key status is stated as fact wherever it is
read, so it stays false.

One more thing the tree will not tell you gently. The Druid catalog is a view of
what is servable, not of what exists. Marking every segment of a datasource
unused removes it from `INFORMATION_SCHEMA.TABLES` and `sys.segments` entirely,
and stopping the Historical makes an existing datasource answer HTTP 400
`Object 'libredb_demo' not found` with `category: INVALID_INPUT` -
indistinguishable, in both status and category, from mistyping the name. A
datasource that vanished from the tree is an availability question before it is a
SQL question.

The rest of what this engine deliberately does not do is published on
[the engine pages](/databases), next to its transport and default port.
