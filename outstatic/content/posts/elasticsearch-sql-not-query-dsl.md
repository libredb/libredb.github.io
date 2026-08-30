---
title: This editor sends Elasticsearch SQL, not the query DSL
status: published
author:
  name: LibreDB
  picture: ''
slug: elasticsearch-sql-not-query-dsl
description: There are no writes in this grammar at all, no second page, and a trailing semicolon is a syntax error, so the list of edges is the useful part.
coverImage: ''
tags:
  - value: engineering
    label: Engineering
  - value: databases
    label: Databases
publishedAt: 2026-06-03T09:00:00.000Z
---

Open an index in LibreDB Studio, press Run, and what leaves the browser is a SQL
statement posted to the Elasticsearch SQL query endpoint - `POST
/_sql?format=json`, on port 9200. Not a JSON query DSL body. Not an aggregation
body. Not ES|QL. That one sentence decides most of what the editor can and cannot
offer here. Everything below was measured against Elasticsearch 9.1.4, default
build flavour, basic subscription tier, on 2026-08-19.

## Which surface the statements go to: the Elasticsearch SQL query endpoint

There is no driver. Every statement is a JSON body handed to the runtime's own
`fetch`, so `package.json` is untouched: no install step to fail, no native module
in the Docker image.

The SQL endpoint is first-party and available on the basic tier with no plugin to
install, which is why it is the query surface here rather than the DSL. ES|QL
exists on this product and works on basic - measured - and is deliberately unused:
one implementation serves both `elasticsearch` and `opensearch`, and OpenSearch
has no ES|QL at all.

The schema does not come from that endpoint at all. Indices are read from `GET
/_cat/indices` and columns from `GET /<index>/_mapping`, flattened to dotted
paths, because `SELECT *` describes a statement while the mapping describes the
index: measured, an index mapping a `flattened` field and a `nested` field answers
`SELECT *` with `{"columns":[],"rows":[[]]}` - no columns at all. One visible
result is that grid column types are the mapping's own vocabulary: `SELECT
customer, total FROM probe_orders` declares `keyword` and `double`, not `VARCHAR`
and `DOUBLE`, which is the vocabulary the schema tree already shows.

## What this grammar contains, and what it does not

**There is no write in this
grammar at all, and there is no `OFFSET` clause, so a request for a page
after the first is refused with the reason rather than silently answered with
page one.**

Every one of these is HTTP 400 with `parsing_exception`:

| Statement | What comes back |
| --- | --- |
| `INSERT INTO probe_orders ...` | "mismatched input 'INSERT' expecting {'(', 'DEBUG', 'DESC', 'DESCRIBE', 'EXPLAIN', 'SELECT', 'SHOW', 'SYS', 'WITH'}" |
| `UPDATE probe_orders SET customer = 'x' WHERE id = 1` | same shape - `UPDATE` is not in that list either |
| `DELETE FROM probe_orders WHERE id = 99` | same |
| `CREATE TABLE t (id BIGINT)` | same - no DDL is among the accepted forms |
| `ALTER TABLE probe_orders ADD COLUMN x INT` | same |

The grammar enumerates everything it would have accepted, which is more useful
than any message substituted here, so nothing special-cases a mutation.
`supportsCreateTable` and `supportsInlineRowEdit` are false as facts about the
grammar rather than as unimplemented features, and the EDIT toggle and the
editable cell are not offered. Documents change through the document APIs
(`_doc`, `_bulk`, `_delete_by_query`), which this seam does not expose.

Two absences follow from the same place. The ER diagram has no edges to draw: the
engine has no foreign-key constraint in its model, so `foreignKeys` is always `[]`
and `declaresForeignKeys` is `false` - the empty list means "impossible here", not
"none declared". And no column is ever marked primary: nothing a mapping
declares is unique, and `_id` is not even selectable (`SELECT _id FROM
probe_orders` answers "Unknown column [_id], did you mean [id]?"). The absent ER
diagram is published on [the engine grid](/databases).

## Why a second page is refused rather than approximated

`SELECT customer FROM probe_orders LIMIT 2 OFFSET 1` is HTTP 400,
`parsing_exception`, "line 1:43: mismatched input 'OFFSET' expecting <EOF>" -
with or without an `ORDER BY` in front of it. The shared query limiter emits
exactly that clause for any page after the first, so a naive "load more" turns a
working statement into a syntax error.

`prepareQuery()` overrides it and refuses in words:

> Elasticsearch SQL has no OFFSET clause, so results after the first page cannot
> be requested here. Narrow the statement with a WHERE clause, or raise the row
> limit, instead of paging.

Dropping the `OFFSET` and sending `LIMIT n` returns page one, which the editor
appends to what it already shows - duplicate rows presented as new ones. That is
a wrong answer rather than an error, which is the one outcome worth throwing to
avoid.

The refusal is narrow: it fires only when the limiter actually produced the
clause, so a statement carrying its own `LIMIT` is left exactly as written.

Paging that the engine starts on its own is a different matter, and is followed.
`SELECT k, COUNT(*) FROM probe_buckets GROUP BY k` over 1500 distinct values
answered 1000 rows plus a `cursor`, with no `fetch_size` ever requested. Dropping
that cursor would report two thirds of the groups as a complete answer, so the
transport follows it, bounded by `MAX_PAGES = 1000`; hitting that ceiling is
reported as an error rather than silently accepted, and the abandoned cursor is
closed through `POST /_sql/close`.

## Identifier quoting and the trailing semicolon

`SELECT 1;` answers `parsing_exception`, "line 1:9: extraneous input ';'
expecting <EOF>". A terminator most SQL habits add without thinking is a syntax
error here.

This bit through the product's own affordances before it bit any user. The shared
generators emitted `SELECT * FROM probe_orders LIMIT 50;` for "Select Top 50
Documents" - the first thing anyone clicks on an index - and it was refused with
that same message. So `statementTerminator` is `"none"`, the generators ask the
capability rather than the engine name, and the generated statement now ends at
`LIMIT 50`. A semicolon you type yourself still runs: the editor's statement
reader strips the terminator before sending.

Identifiers take double quotes. `` SELECT `customer` FROM probe_orders `` answers
"backquoted identifiers not supported; please use double quotes instead", while
`SELECT customer FROM "probe_orders"` and `SELECT "note.keyword" FROM
probe_shapes` are both HTTP 200. `identifierQuoting` is therefore `double` on
this type-id and `backtick` on OpenSearch - the exact opposite - which is one
reason the two products are separate declarations rather than one branch.

Three more edges from the same measurement pass. `#` opens nothing: `SELECT 1 # x`
is a `parsing_exception`, so the rest of the line is not hidden. `[` has no
meaning at all - `SELECT [1, 2]` is "extraneous input '['". And an object or
`nested` field breaks the entire statement rather than one column: `SELECT
address FROM probe_shapes` is "Cannot use field [address] type [object] only its
subfields", while `SELECT note, note.keyword, address.city` returns all three.
That last one is why containers are dropped from the column list the starter
query enumerates.

## Engine read-only is not statement-level read-only

Every statement this endpoint accepts reads. That is a property of the grammar,
not a restraint the integration applies, and it invites the conclusion that the
tool-using agent is safe to run here. It is not.

Agent AUTO mode requires a read-only mode the database itself enforces per
statement: a read-only transaction on PostgreSQL, `PRAGMA query_only` re-asserted
per statement on SQLite, a `READ_ONLY` handle plus an SQL guard on DuckDB.
`queryReadOnly` exists on exactly those three providers. The search providers
implement none of it, so an AUTO run on this connection ends `engine-unsupported`
- the same answer given on [the agent's own feature entry](/features).

"This grammar has no INSERT" and "the database refused to let this statement
write" are different guarantees. The first is a claim about a parser at the time
someone read it; the second is enforced by the engine on every statement, in the
same place the statement executes. Only the second is a control, and only the
second is what the agent's budget, policy decision and audit event are attached
to.

Agent PLAN mode does open here. It is toolless, executes nothing, and drafts a
statement for a human to run, grounded in the schema read from the mappings. It
carries a label declared on these two engines alone, stating that the query
language is Elasticsearch SQL and not the JSON query DSL, not an aggregation body
and not ES|QL - written because a measured plan run answered with a native
aggregation body, correct for the product and unrunnable through this endpoint.
