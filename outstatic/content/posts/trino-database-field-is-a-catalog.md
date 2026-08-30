---
title: On a Trino connection the database field is a catalog
status: published
author:
  name: LibreDB
  picture: ''
slug: trino-database-field-is-a-catalog
description: Pinning a catalog scopes the whole tree two levels deep, and a connection that pins none still connects and runs fully qualified statements with no tree.
coverImage: ''
tags:
  - value: engineering
    label: Engineering
  - value: databases
    label: Databases
publishedAt: 2025-12-26T09:00:00.000Z
---

Trino stores nothing. Every table it can name belongs to a system behind a
connector, and a deployment is a set of configured catalogs pointed at those
systems. That one fact decides how you connect Trino - the catalog, the schema,
and what the client sends on the wire - and it decides the shape of everything
the sidebar can show you afterwards.

The field labelled *Database* on a Trino connection holds a catalog. Type a
schema name into it and the symptom is not an error: the connection succeeds and
the tree is either wrong or empty.

## Connect Trino by catalog: what each field in the client means

There is no driver here. Statements go out as the body of an HTTP request to
`POST /v1/statement` and the answer is read by following a chain of `nextUri`
links, which is Trino's own client protocol. The provider was verified against
Apache Trino 476 (`trinodb/trino:476`), measured 2026-08-20.

| Field | Required | What it does |
| --- | --- | --- |
| Host | Yes | The coordinator. The only validated requirement |
| Port | No | Defaults to `8080`, for both `http://` and `https://` |
| Database | No | The catalog to pin. Without it the editor works and the tree does not |
| Username | No | Sent as `X-Trino-User`. Defaults to `libredb`, never omitted |
| Password | No | `Authorization: Basic`, and only over TLS |
| SSL | No | Selects `https://` |

Two of those rows are worth reading twice. The port default is `8080` under TLS
as well, because a secured cluster listens wherever its operator put it and
inventing a well-known HTTPS port would send credentials to somewhere nothing is
listening. And a password requires TLS: measured against a coordinator with
authentication switched off entirely, an `Authorization: Basic` header over plain
HTTP answers `401 Unauthorized` with *Password not allowed for insecure
authentication*. That is the server's rule, so the transport constructor refuses
the configuration up front rather than sending the credential and reporting the
401.

**There is no connection string field on this form at all.**
`jdbc:trino://host:port/catalog/schema` is a real and widely pasted form, and the
shared parser in `src/lib/connection-string-parser.ts` does not accept it. A field
that would reject everything a user pastes into it is worse than no field, so
`supportsConnectionString` is false and stays false until the parser learns the
scheme. Fill the fields in individually.

There is also no field for a session schema, which matters in a moment.

## Catalog, schema, table, and how the tree gets shaped

Trino's hierarchy is catalog to schema to table, one level deeper than the tree's
database to schema to table. The mapping chosen is the PostgreSQL one: the
connection's database field holds the catalog, exactly as a PostgreSQL connection
pins one database, and the schemas inside it become the schema level. So the tree
is two levels deep, and a table's display name is always `schema.table`.

Introspection is two statements run in parallel against the pinned catalog's
`information_schema` - the table list and the column list - both excluding
`information_schema` itself, both ordered by `ordinal_position` so the mapper
never sorts. Against `tpch` that is 72 tables.

The alternative, fanning `information_schema` out across every catalog on the
cluster, is unbounded in practice. The `jmx` catalog alone publishes one table per
MBean, and `jmx.current` measured 379. One sidebar refresh would then depend on
every connector the operator has configured being reachable. `SHOW CATALOGS` is
still useful and it is exposed where it belongs: the Storage panel reads
`system.metadata.catalogs` and lists one row per catalog with its connector.

What the tree cannot show you is a key. Trino's `information_schema` holds exactly
eight views - `applicable_roles`, `columns`, `enabled_roles`, `roles`, `schemata`,
`table_privileges`, `tables` and `views` - with no `table_constraints` and no
`key_column_usage`, so no connector can declare a key through it. `indexes` and
`foreignKeys` are `[]` by construction, `isPrimary` is false everywhere, and inline
row editing is not offered, because an `UPDATE ... WHERE` with no column that
identifies one row would rewrite every row that matches. That is a fact about the
engine, not a gap in the client, and it is [published on the engine
pages](/databases) rather than discovered at runtime.

## A connection that pins no catalog

Leave the database field empty and the connection still works. It connects, it
runs every fully qualified statement you type, and it reads the whole of
`system.runtime`, which is where the overview, the session list and the slow
query list come from. What it cannot do is show a tree, and `getSchema()` says so:
*This connection pins no Trino catalog, so there is no schema to list.*

That is a usable connection, not a broken one. It is the right shape for a cluster
where you work across catalogs all day and the tree for any single one of them
would only be in the way. If you do want the tree, add the catalog and reconnect;
the pin is the only thing that decides which catalog the sidebar reads.

For a local cluster to try this against, `trinodb/trino:476` ships `tpch`,
`tpcds`, `memory`, `system` and `jmx` already configured, so there is no seed
step. Point a connection at `localhost:8080` with no user, no password and `tpch`
in the database field, and `tpch.tiny.nation` is there. The rest of the setup is
in [getting started](/get-started).

## Cross-catalog statements, fully qualified

Pinning a catalog constrains the tree and nothing else. The editor is untouched:

```sql
SELECT n.name, o.orderstatus, count(*) AS orders
FROM tpch.tiny.orders o
JOIN tpch.tiny.customer c ON c.custkey = o.custkey
JOIN memory.default.watchlist w ON w.custkey = c.custkey
JOIN tpch.tiny.nation n ON n.nationkey = c.nationkey
GROUP BY n.name, o.orderstatus
```

runs exactly as typed with `tpch` pinned, because the pinned catalog only supplies
the default for names that are not fully qualified. Qualify in full and the pin
never enters the resolution. (`watchlist` there is a table of your own on the
`memory` connector, which is one of the connectors that accepts `CREATE TABLE`.)

Qualifying in full is also the habit to keep, because each statement is one
stateless exchange of HTTP requests with no pooling and nothing carried between
them. `USE`, `SET SESSION`, `PREPARE` and `DEALLOCATE` all report success and have
no effect on the next statement, so each one attaches a warning saying that:
*succeeded, but each statement is sent on its own connection, so it will not
affect the next one. Qualify names in full instead.* This is the same reason there
is no session schema field, and the reason generated names are always
`schema.table`.

Two smaller grammar facts travel with this. Trino's clause order is `[OFFSET
count] [LIMIT count]` and only that way round - `... LIMIT 3 OFFSET 1` answers
`line 1:47: mismatched input 'OFFSET'` - so paged reads transpose what the shared
limiter emitted. And `SELECT 1;` is a syntax error, `line 1:9: mismatched input
';'`, so the transport drops a single trailing semicolon before the statement
leaves it.

## Reading a failure that arrives as a success

**A failed Trino statement arrives as HTTP 200 with the failure inside the
document.** `SELEKT 1`, a missing table and an unsupported DDL all answer 200. So
the transport categorises from the body and never from the status, and the status
is consulted for exactly one thing: a request the coordinator refused before it
became a statement at all, which is the plain-HTTP password 401 above.

If you probe a cluster with `curl` before you connect the client, read the body
and not the status. A 200 is not a result.

What the client does with the body is keep the engine's own wording verbatim -
`line 1:15: Table 'tpch.tiny.nope' does not exist` - because nothing synthesized
locally locates the fault better, and carry the 1-based error location alongside
it. What it drops at the seam is the Java stack: 19 frames and 3.3 KB for the
simplest possible typo.

The same rule reads the other way when a statement fails because of the connector
rather than the engine. `CREATE TABLE` is in the grammar and works on the `memory`
connector; the same connector answers `UPDATE` with *This connector does not
support modifying table rows*. That refusal is shown as the connector wrote it,
not substituted for a sentence of ours, because the connector is the only thing
that knows.
