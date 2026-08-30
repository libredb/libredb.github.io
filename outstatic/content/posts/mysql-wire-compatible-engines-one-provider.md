---
title: Nine servers, one connection type, different answers
status: published
author:
  name: LibreDB
  picture: ''
slug: mysql-wire-compatible-engines-one-provider
description: MariaDB, Percona, TiDB, Vitess and five more arrive through the same MySQL connection, and protocol compatibility is not capability compatibility.
coverImage: ''
tags:
  - value: engineering
    label: Engineering
  - value: databases
    label: Databases
publishedAt: 2026-08-23T09:00:00.000Z
---

There is no MariaDB button in the connection dialog. Anyone looking for how to make a
MariaDB GUI client connect here gets a two-word answer - pick MySQL - because there is
no `mariadb` type id. The same is true of eight other servers.

## One connection type, nine servers

Nine engines reach the `mysql` provider, which is `mysql2/promise` over port 3306 with a
pooled connection: MariaDB, Percona Server for MySQL, TiDB, Vitess, StarRocks, Apache
Doris, OceanBase, SingleStore and Databend. None has a driver, a provider module or a
reference document of its own. Each speaks the protocol the driver already speaks, so
it connects through that driver unchanged.

The overview panel does not rename the server for you. `VERSION()` is the only thing
that says which engine answered. MySQL returns a bare number, so the provider supplies
the vendor name; MariaDB, TiDB, Vitess and OceanBase return a build string that already
names themselves, and it is passed through untouched, because prefixing it would assert
a vendor the server never claimed. StarRocks and SingleStore give nothing to key on:
`version()` on StarRocks returns a fictitious 5.1.0, and the real build is only in
`current_version()`, which the provider does not read.

## How a MariaDB GUI client connects, and where the recipe bites

Discrete fields: host, port 3306, database, user, password. `validate()` requires host
and database only when no connection string is given. One command gives you a fixture to
point at - `localhost:3306`, database `app`, user `root`:

```sh
docker run --rm -e MYSQL_ROOT_PASSWORD=root -e MYSQL_DATABASE=app \
  -p 3306:3306 mysql:8
```

If Studio itself runs in a container, `localhost` is the wrong host - join the fixture
network and use the service name.

The connection-string form is the same recipe in one line, and it carries a trap. When
`connectionString` is supplied, `buildPoolConfig()` returns `{ ...baseConfig, uri }` and
skips the discrete-fields branch entirely, so `timezone`, `connection.ssl` and the cloud
SSL auto-detection are ignored. Those settings have to be encoded in the URI itself:

```sh
mysql://root:secret@db.internal:3306/app?ssl-mode=VERIFY_IDENTITY
```

The paste box reads that query string, so `VERIFY_IDENTITY` arrives as `verify-full`.
`PREFERRED` is deliberately not mapped: mapping it to `disable` would downgrade a
connection that was in fact encrypted, and mapping it to `require` is the mirror-image
guess, so the paste banner names the parameter it declined to act on instead.

Two more things the pool does not do. Only `max` is honoured, as mysql2's
`connectionLimit`, default 10. And there is no server-side query timeout, so a runaway
query is not auto-killed; cancellation is explicit, through `KILL QUERY` against the
recorded thread id.

## Where the support levels diverge

**These nine servers all reach the same provider, but their support levels differ
sharply: four are Full, four are Partial, one is query editor only, and no managed MySQL
service has been probed at all.** A name enters the table below only after a live probe
ran every introspection surface against a real instance through the real provider. The
version column is what that server reported on that day, not a supported range.

| Engine | Support | Probed version | The part you would not guess |
| --- | --- | --- | --- |
| Percona Server for MySQL | Full | 8.4.11-11 | Nothing on screen says Percona; `version()` answers a bare number |
| MariaDB | Full | 12.3.2-MariaDB | `performance_schema` ships off; only 12.3 was probed |
| TiDB | Full | 8.0.11-TiDB-v8.5.1 | Explain fails; a fresh table reads 0 rows until statistics catch up |
| Vitess | Full | 8.0.43-Vitess | A running query cannot be cancelled; vtgate refuses `KILL QUERY` |
| StarRocks | Partial | 3.3.22 | Row counts and sizes are hard zeros; no index is reported |
| Apache Doris | Partial | 4.1.3-rc02 | A foreign key is invisible to the diagram and unenforced |
| OceanBase | Partial | 5.7.25-OceanBase_CE-v4.4.2.1 | No `performance_schema` database at all, so health fails |
| SingleStore | Partial | 9.1.1 | A 2000-row table reads 0 rows and 0 B in every panel |
| Databend | Query editor only | v1.2.925-patch-11 | Parameterised reads are refused, so only the editor works |

Full means every introspection surface answered; a caveat may still note data that is
present but inaccurate. Partial means the editor works and parts of the object browser
or the monitoring dashboard are blank. Query editor only means SQL runs and nothing else
does: usable, but not as a way to manage a database.

Amazon RDS for MySQL, Aurora MySQL, Cloud SQL, Azure Database for MySQL and PlanetScale
all speak this protocol, and none of them appears above, because none has been reached
for a probe. Untested is not unsupported, and it is not supported either.

## Statistics that ship switched off on some of them

MariaDB ships with `performance_schema` off. Measured on 12.3.2, `@@performance_schema`
is 0. The tables still exist, so the metric queries do not fail - they return a row of
NULLs, and every field of `getPerformanceMetrics()` with nothing behind it is left out
of the object entirely. The cache-hit ratio, queries per second and buffer-pool usage
are **absent, not zero**. The digest table is selectable and answers zero rows, so the
slow-query list is empty rather than an error. Start the server with
`performance_schema=ON` and the figures appear. `information_schema`, `PROCESSLIST`,
schema introspection, sizes, row counts and `EXPLAIN FORMAT=JSON` are unaffected.

One metric runs the other direction. `deadlocks` reads `Innodb_deadlocks`, which MariaDB
publishes and MySQL does not - measured as an empty `SHOW STATUS` result on both 8.0.46
and 26.7.0. It is the single performance figure a default MariaDB reports and a stock
MySQL server does not.

OceanBase is the harder case: its tenants have no `performance_schema` database at all,
so the queries raise rather than answering NULLs and the health read fails outright,
setting the header badge to Slow. That badge is not latency. It is the health request
failing, and health is exactly what that engine refuses.

The same absent-versus-zero rule governs index sizes. The per-index byte figure comes
from `mysql.innodb_index_stats`, which needs `SELECT` on the `mysql` schema and has no
row at all for a MyISAM table. In both cases the panel reads `N/A` rather than a `0 B`
the server never reported.

## What not to generalise from MySQL to the rest

Four habits to break.

**Do not assume the Explain panel works.** `EXPLAIN FORMAT=JSON` is one statement built
for every engine on this type id, and five of the nine reject it: TiDB, StarRocks, Doris
and Databend fail to parse it, and SingleStore answers `ER_PARSE_ERROR` on both wire
protocols because its grammar is `EXPLAIN JSON`. A plain `EXPLAIN` runs in the editor on
Doris, SingleStore and Databend. The panel is what is missing, not the planner.

**Do not read a zero as a measurement.** StarRocks and SingleStore leave
`information_schema.TABLES` zeroed and keep the real numbers elsewhere, so a populated
table looks empty; on SingleStore, running `ANALYZE` does not change what the panels
read. TiDB and Doris read zero immediately after a load and then correct themselves with
no `ANALYZE` at all - on Doris the true numbers appeared about a minute later. Even on
stock MySQL, `TABLE_ROWS` is an InnoDB estimate rather than a count and index `scans` is
`CARDINALITY` rather than a usage counter.

**Do not assume a foreign key is a foreign key.** On Doris, `ADD CONSTRAINT` is accepted
and `SHOW CONSTRAINTS` lists it, but `KEY_COLUMN_USAGE` is empty, so the ER diagram
draws nothing - and an order row referencing a customer that does not exist inserts
successfully, because the constraint is a planner hint there. SingleStore refuses them
outright, and with `ignore_foreign_keys` on it accepts an inline one and strips it.

**Do not expect agent AUTO mode anywhere on this type id.** The read-only execution
profile is database-native, and only PostgreSQL, SQLite and DuckDB implement it. An auto
run against any of these nine ends `engine-unsupported`. PLAN mode does open on every
one of them: it is toolless, executes nothing, and drafts a statement for a human to
run. On Databend that difference is legible: the schema read fails, so a plan run
succeeds and drafts nothing, saying it was given no inventory of this database and
asking for the table and column names rather than inventing a schema.

One connection type is a statement about a wire protocol. It is not a statement about
what the server on the other end will answer when a panel asks it a question.
