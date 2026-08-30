---
title: Connecting to Elasticsearch with four fields and no database
status: published
author:
  name: LibreDB
  picture: ''
slug: elasticsearch-connect-four-fields
description: An index has no namespace above it, so a database selector would be a control with no effect, and a self-signed cluster certificate has nowhere to go here.
coverImage: ''
tags:
  - value: engineering
    label: Engineering
  - value: databases
    label: Databases
  - value: security
    label: Security
publishedAt: 2026-01-12T09:00:00.000Z
---

Open the connection dialog for Elasticsearch and it asks for four things: host,
port, user, password. Nothing is installed to connect; the client on the 9200
side of this form is the runtime's own `fetch`, and `package.json` is untouched.
There is no Database field, no connection-string tab, and no TLS row.

Those absences do not share a cause, and the difference decides what you can do
about each. The Database field is missing because it would be a control with no
effect. The CA you would paste into a TLS row has nowhere to go because this
transport cannot carry it.

## The four fields on 9200, and the one that is missing

| Field | Required | What it does |
| --- | --- | --- |
| `host` | Yes | `validate()` throws `DatabaseConfigError` - "Elasticsearch requires a host". There is nothing to substitute for it |
| `port` | No | Defaults to `9200`, applied both in the provider and again at the transport |
| `user` / `password` | No | Sent as HTTP Basic only when `user` is set, for the security plugin |
| `database` | - | Not offered, and ignored if set |

Credentials are genuinely optional rather than optional-in-principle. Measured
against a node with security disabled, a bogus `Basic` header is ignored and the
request answers HTTP 200, so a cluster that does not check will not tell you your
password was wrong either.

Connecting proves more than the port. `connect()` sends one `SELECT 1` - measured
HTTP 200, one column named `1`, type `integer` - which needs no index and so also
succeeds against a cluster holding nothing yet. Because the SQL endpoint path is
product-specific, that same request proves the product: `POST /_plugins/_sql`
against Elasticsearch answers `{"error":"no handler found for uri
[/_plugins/_sql] and method [POST]"}`. A connection pointed at the wrong one of
the two search products fails at the form, quoting the cluster's own words,
rather than failing later on somebody's query.

The local fixture is the shape the four fields were designed against:

```sh
docker compose -f database-compose.yml up -d elasticsearch
```

It pins `docker.elastic.co/elasticsearch/elasticsearch:9.1.4` with
`discovery.type: single-node`, `xpack.security.enabled: "false"` and
`ES_JAVA_OPTS: -Xms512m -Xmx512m`, and publishes 9200 only - 9300, the transport
protocol, is deliberately not published, because nothing here speaks it. Host
`localhost`, port `9200`, no user, no password. The health check waits for
yellow rather than green: a single node that has been asked for a replica is
yellow forever.

## Why an index needs no namespace above it

The missing Database field is not an unimplemented one. An index has no namespace
above it, and the product's own SQL says so. `SHOW TABLES` reports a `catalog` of
`docker-cluster` - the cluster name - and that catalog is not addressable in a
statement. Measured:

```sql
SELECT customer FROM "docker-cluster".probe_orders
```

answers `parsing_exception`. So a database selector would be a control that
changes nothing, and worse, one implying a scoping decision the user does not
actually have. The monitoring rows carry an empty schema name for the same
reason, which renders as no prefix at all.

What sits in that space instead is the product's own vocabulary. An index is the
table, a document is the row, and the select action reads "Select Top 50
Documents". Column types are the mapping's words rather than SQL's: `SELECT
customer, total FROM probe_orders` declares `keyword` and `double`, and `SELECT
note` declares `text` - the same vocabulary the schema tree shows, because the
tree is read from `GET /<index>/_mapping` rather than from a statement. That is
not decoration. The schema has to come from the mapping, because `SELECT *`
describes the statement rather than the index: measured, an index mapping a
`flattened` and a `nested` field answers `SELECT *` with
`{"columns":[],"rows":[[]]}`, a table with no columns at all.

Two counts in the schema read the same way. Foreign keys are always `[]` and
`declaresForeignKeys` is `false`, so the empty list means impossible here rather
than none declared. `indexCount` is 0 and stays 0, because every mapped field is
inverted-indexed as a property of being mapped, so there is no index object to
name. The [engine list](/databases) states the short version: no row editing, no
ER diagrams.

## There is no connection string either

`supportsConnectionString` is `false` and the form has no paste tab. Two
independent reasons, and the second one is the sharper of the two.

There is no URI convention for this HTTP surface. A cluster is addressed by host
and port; the official client takes a `node` URL, which is not a
credential-carrying DSN a shared parser could round-trip.

And `http://` and `https://` are already claimed in the shared connection-string
parser, where an HTTP URL is the canonical connection target for ClickHouse.
Pasting `http://localhost:9200` therefore selects ClickHouse. That consequence is
recorded rather than hidden: `connection-string-parser.ts` is not touched by this
provider, and the connection form's unparseable-string message lists the schemes
that do exist and deliberately omits these two.

## What a self-signed certificate runs into

`config.ssl` with any mode but `disable` switches the transport from `http` to
`https`. The port does not move with it. This product serves HTTPS on the same
`9200`, so there is no second well-known number to fall back to, and inventing
one would send credentials to a port nothing is listening on.

Three TLS settings are not honoured here at all: `ssl.caCert`, `ssl.clientCert`
and `ssl.rejectUnauthorized`. Global `fetch` cannot carry a custom CA, present a
client certificate, or relax verification without an undici `Agent` as its
dispatcher, and undici is not a dependency. A cluster behind a self-signed
certificate therefore fails verification, and there is no field on this form to
paste the CA into and no connection string to smuggle it through. A
publicly-trusted certificate works.

That matters more here than on most engines, because a secured Elasticsearch
commonly ships a self-signed certificate on first boot. It also means one of the
four TLS modes describes this transport honestly and three do not:
`verify-system` is the handshake `fetch` actually performs. `require` does not
mean encrypt-without-checking the way it does on the driver-based providers -
nothing in this transport can skip a check - and `verify-ca` and `verify-full`
cannot pin against a pasted CA. Nothing in the code branches on which one is
selected.

## The deployment shapes that work today

Three shapes connect with what the form offers.

A local or private-network cluster over plain HTTP, which is the fixture above
and the shape the tool is built for: the container runs beside the database, and
what travels to the engineer is a URL rather than the data.

A cluster fronted by a load balancer or reverse proxy holding a publicly-trusted
certificate. This is also the answer to a second absence, because there is no
sniffing, no failover and no retry: one statement is one `fetch` to one host, and
a refused socket surfaces as an error rather than being retried against another
node. A deployment that wants failover puts a balancer in front, and that
balancer is the host a connection points at.

A cluster with the security plugin on, reached with user and password over a
certificate the platform's store already trusts.

Elastic Cloud, Elastic Cloud Enterprise and Elastic Cloud on Kubernetes are where
people run this engine, and none of them has been probed. Managed-only services
are listed as deliberately absent rather than assumed to work, so treat those
three as untested rather than supported.

Agent AUTO mode - the tool-using run - does not open on this connection at all.
`queryReadOnly` exists on exactly three providers, PostgreSQL, SQLite and DuckDB,
because there the read-only profile is enforced by the database itself; the
search providers implement none, so an AUTO run ends `engine-unsupported`. The
fact that this grammar cannot write - `INSERT`, `UPDATE`, `DELETE`, `CREATE
TABLE` and `ALTER TABLE` are each a 400 `parsing_exception` on 9.1.4 - is a
property of the engine, not a per-statement guarantee the database enforces, and
it does not substitute for one. Agent PLAN mode does open here: it is toolless,
executes nothing, and drafts a statement for a human to run, grounded on the
mapping read the schema tree already made.
