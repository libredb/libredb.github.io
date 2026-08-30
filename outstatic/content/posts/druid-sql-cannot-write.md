---
title: Read-only is Druid here, not the integration
status: published
author:
  name: LibreDB
  picture: ''
slug: druid-sql-cannot-write
description: Update and delete are not in this SQL anywhere, create is not in the grammar, and the refusals are surfaced word for word instead of rewritten.
coverImage: ''
tags:
  - value: engineering
    label: Engineering
  - value: databases
    label: Databases
publishedAt: 2026-06-28T09:00:00.000Z
---

The first refusal most people meet on Apache Druid is `Unsupported SQL statement
[UPDATE]`, at HTTP 400, from a cluster that is healthy and answering everything else. "Not
supported" reads like a switch somewhere. There is no switch. Two of those statements are
absent from the language, two more are refused by the engine that answers the endpoint,
and `CREATE TABLE` never reaches a planner at all.

LibreDB Studio speaks to Druid over one path, `POST /druid/v2/sql`, on port `8888` at the
Router or `8082` at the Broker - the same request body and the same error envelopes from
either, with no driver dependency of any kind. Querying, `INFORMATION_SCHEMA`, the `sys`
tables and `EXPLAIN` all travel that one path. So does every refusal below.

## Not unsupported, not in the grammar

`UPDATE` and `DELETE` are not unimplemented on this endpoint. They are not in Druid SQL
anywhere, on any engine. `CREATE TABLE t (id BIGINT)` does not fail validation either - it
fails parsing, and the parser then lists what it expected in that position, `INSERT`,
`UPSERT`, `EXPLAIN`, `SET` and `RESET` among them, with no form of `CREATE` on the list.

`INSERT` and `REPLACE` do exist in the grammar, and the native engine behind this endpoint
declines to run them. They belong to the multi-stage query task engine on
`POST /druid/v2/sql/task`, which is a submit-and-poll protocol returning a task id rather
than rows. The synchronous endpoint rejects both even on a cluster where
`druid-multi-stage-query` is loaded and fully capable of running them, which is exactly
what the verification fixture is configured to prove.

Which leaves the question of how a datasource gets its data. A datasource comes into
existence by being ingested into: a task writes segments, and there is no editor-shaped
statement that creates one. Removing data is two management API calls, not a statement -
`markUnused` on the Coordinator, over an interval or a list of segment ids, then a `kill`
task submitted to the Overlord. Step one alone is enough to remove the datasource from
`INFORMATION_SCHEMA.TABLES` entirely.

The capability flag that follows from all of this is quiet but exact:
`schemaRefreshPattern` is `\b(INSERT|REPLACE)\b`, the only two statements that could
change a datasource. The native engine rejects both, so in practice a query in the editor
never refreshes the schema. That is correct rather than broken. A Druid schema changes
through ingestion, not through the thing you are typing into.

## Why the row editor is disabled rather than offered

The results grid on other engines has an EDIT toggle: change a cell, and the grid emits
`UPDATE ... SET` behind it. On a Druid connection there is no toggle and no editable cell,
because the provider declares `supportsInlineRowEdit: false`.

That is the limit, stated plainly: **row editing is disabled rather than offered and then
failed, because Druid SQL has no row-level modification at all and no table creation in
its grammar, so there is no equivalent statement to substitute.** Not a slower path, not a
worse path - none. The same reasoning takes out two more controls. `supportsCreateTable`
is `false`, so the Create Table modal never appears rather than emitting something the
parser will reject. `supportsTransactions` is `false`, so the transaction controls are
withheld rather than answering HTTP 400, since a language with no DML gives a transaction
nothing to hold.

This is the rule the whole [capability model](/features) runs on, applied to the engine
where it bites hardest: a control that cannot work is absent, with the reason written
where it would have been, rather than present and failing on the server's time. The
[engine page for Druid](/databases) publishes the same line next to its transport and
default port, so it is readable before a connection is made rather than after.

## The refusals, quoted as the cluster wrote them

Every message below is verbatim from Apache Druid 37.0.0, and every one of them is HTTP
400:

| statement | what the cluster returns |
| --- | --- |
| `INSERT INTO t SELECT ...` | `INSERT operations are not supported by requested SQL engine [native], consider using MSQ.` |
| `REPLACE INTO t OVERWRITE ALL SELECT ...` | `REPLACE operations are not supported by the requested SQL engine [native].  Consider using MSQ.` |
| `UPDATE t SET ...` | `Unsupported SQL statement [UPDATE]` |
| `DELETE FROM t WHERE ...` | `Unsupported SQL statement [DELETE]` |
| `CREATE TABLE t (id BIGINT)` | `Incorrect syntax near the keyword 'CREATE' at line 1, column 1.` |

The provider special-cases none of them. Druid's own message already names the reason and,
where one exists, the alternative, which is more than a rewritten sentence would carry.
The words on screen are the words the engine emitted, so they match Druid's own
documentation and its own issue tracker; a friendlier paraphrase would break that.

Two details make the verbatim message worth trusting. The error body's `error` field is a
discriminator, not a message - in the modern envelope its value is the literal string
`druidException` - so the transport reads `errorMessage` and shows that. And the failure
is classified by the `category` Druid reports, never by the HTTP status, because the
status misclassifies in both directions: `SELECT 1/0`, an ordinary typo, answers HTTP 500
with `category: UNCATEGORIZED`. Reading that 5xx as a broken cluster would send the user
to check their host instead of their expression.

One place the tool does write a sentence of its own is the schema-diff generator. A
changed column has no `ALTER TABLE` to emit, so the generated migration carries
`-- Apache Druid: Cannot alter column "<name>". Druid SQL has no ALTER TABLE; rewrite the
datasource with REPLACE INTO through an MSQ task.` in that statement's place. It names the
task endpoint deliberately, because `REPLACE INTO` pasted into the editor is one of the
five rows above.

## Ordering a scan by a non-time column

The second refusal looks like a client bug and is not:

```sql
SELECT id FROM libredb_demo ORDER BY id LIMIT 2
```

```
400  Query could not be planned. A possible reason is [SQL query requires ordering
     a table by non-time column [[id]], which is not supported.]
```

The planner rejects an `ORDER BY` on a non-`__time` column of a plain table scan. Ordering
by `__time` works, because that is the partitioning and sort key. Ordering by anything
works once there is a `GROUP BY`, because that is an aggregation rather than a scan. The
third remedy is to leave the statement alone and sort the rows already returned in the
results grid.

The provider does not paper over it. It writes no `ORDER BY` into the statements it
generates for you - browsing a datasource emits `SELECT * FROM libredb_demo LIMIT 50;`
with none - and it does not rewrite yours, because no rewrite could preserve what you
meant. Adding `__time` to the sort changes the answer. Adding a `GROUP BY` changes the
query.

## A result that is complete unless it says otherwise

Druid answers a query over segments it cannot reach as an ordinary 200. From the body
alone, a short row set and a correct one are identical - which makes the missing-segment
count the one fact only the response can supply. The transport reads the length of the
`missingSegments` list in `X-Druid-Response-Context` and turns a positive count into a
result warning: `This result is incomplete: N segments of the queried data were
unavailable.` A count of zero means the source confirmed a whole answer and carries no
warning. A response that said nothing about availability also carries none, and the two
are kept distinct rather than folded together, because only the first licenses trusting
the row count.

The same instinct governs the catalog. A datasource whose segments are all unused
disappears from `INFORMATION_SCHEMA.TABLES`, and querying a name whose Historical is down
answers `Object 'libredb_demo' not found` with `category: INVALID_INPUT` - indistinguishable,
in status and category, from a typo. So a datasource missing from the tree is an
availability question before it is a SQL question, and that is worth knowing before you
retype the name.
