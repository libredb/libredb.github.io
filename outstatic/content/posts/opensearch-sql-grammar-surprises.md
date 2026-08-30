---
title: The quoting mistake that returns zero rows and no error
status: published
author:
  name: LibreDB
  picture: ''
slug: opensearch-sql-grammar-surprises
description: A double-quoted identifier is a string literal here, so a filter on one compares two literals and answers nothing with a perfectly successful response.
coverImage: ''
tags:
  - value: engineering
    label: Engineering
  - value: databases
    label: Databases
publishedAt: 2026-06-06T09:00:00.000Z
---

Write `WHERE "customer" = 'acme'` against an OpenSearch cluster and you get HTTP
200, an empty result grid, and no indication that anything went wrong. The
statement parsed. The index was found. The engine did exactly what you asked and
what you asked was meaningless. OpenSearch SQL identifier quoting uses the
backtick, and the double quote you reached for out of habit built a string
literal instead.

An error is a message; silence is a wrong answer wearing the costume of a right
one.

## Two quoting characters with opposite meanings

Measured on OpenSearch 3.8.0, image `opensearchproject/opensearch:3.8.0`, a
stock single node with the security plugin disabled:

```sql
SELECT customer FROM "probe_orders"
```

answers HTTP 404, `IndexNotFoundException`, `no such index ["probe_orders"]` —
quotes included in the name it looked for. That one is fine. It fails loudly and
the message contains the evidence: the double quotes are inside the string the
engine searched for.

The dangerous one is the mirror image:

```sql
SELECT "customer" FROM probe_orders
```

which answers HTTP 200 with

```json
{"schema":[{"name":"\"customer\"","type":"keyword"}],"datarows":[["customer"]]}
```

One column, and every row carries the string `customer` itself. The field of
that name was never read. The backtick form is the one that reaches a
field:

```sql
SELECT customer FROM `probe_orders`
```

is HTTP 200 with the documents. Square brackets are an identifier quote here
too — `SELECT [customer] FROM probe_orders` returns the field's value, while
`SELECT [1, 2]` is refused with `All items between Brackets should be
identifiers, got:LITERAL_INT`. So this grammar has three quoting characters, and
the double quote is the only one of the three that does not name a field.

## The filter that compares two literals

Projection is where you notice. A predicate is where it costs you.

```sql
SELECT * FROM probe_orders WHERE "customer" = 'acme'
```

Both sides of that comparison are constants. The left is the literal string
`customer`, the right is the literal string `acme`, and they are not equal, so
the predicate is false for every document in the index. The engine answers zero
rows, HTTP 200, no warning.

A double-quoted identifier is a string literal on this engine, so a filter
written that way answers zero rows with a successful response and no error at
all. Backticks are the identifier form. Nothing in the response distinguishes that outcome from
an index that genuinely holds no matching document, and nothing can, because
from the engine's position the statement was valid and its answer was correct.

The reverse is just as quiet. `WHERE "customer" = "customer"` is true for every
document, and a filter you believed you had applied is not applied at all.

## Why the response is a success

It helps to see why the cluster cannot warn you. The SQL surface here is a
bundled plugin, `POST /_plugins/_sql`, and each statement is one stateless HTTP
request with a JSON body. The success envelope is `schema` and `datarows` with
`total` and `size` beside them. There is a `status` member in the body, and it
duplicates the HTTP status.

Nothing in that envelope has a place to put "your predicate compared two
constants". A comparison of two literals is a legal expression in every SQL
dialect that has literals. The engine is not being permissive; it is answering
the question it was handed.

Compare that with the failures this engine does report, which are specific. A misspelled field is `SemanticCheckException` with the text `can't
resolve Symbol(namespace=FIELD_NAME, name=nosuchfield) in type env`. A missing
index is `IndexNotFoundException`. A mistyped keyword is
`SQLFeatureNotSupportedException` with `Query must start with SELECT, DELETE,
SHOW or DESCRIBE`. Every one of those is a diagnosis you can act on. The quoting
mistake produces none of them, so a user who hits it goes looking for missing
documents rather than for a mistyped quote.

One more detail worth carrying: the useful sentence is in the response's
`details` member, not in `reason`. Measured, `reason` is the constant string
`Invalid SQL query` for a mistyped keyword, an unknown column and an unparseable
LIMIT alike. LibreDB Studio reads `details` first and carries the engine's own
wording through verbatim, stripping only the trailing footer that tells you to
re-send the request in another format to see the raw engine response — advice
about the REST API rather than about your statement.

## What the editor itself emits

The provider does not build much SQL on its own. The schema tree comes from the
index mapping rather than from a statement — `GET /_cat/indices` for the indices
and `GET /<index>/_mapping` for the fields, flattened to dotted paths — so there
is no generated `SELECT` doing introspection for you to inherit a quoting bug
from.

Where the product does quote, it quotes with a backtick. The `opensearch` type-id
shares MySQL's branch in the codebase's quoter (`src/lib/sql/identifier.ts`), and
the sibling search type-id, served by the same directory, cannot share that
branch: the quoting rule is a per-product fact, not a family one.
Index names make this concrete. A stock cluster already carries
`top_queries-2026.08.18-74305`, an engine-managed index whose name contains both
hyphens and dots, and SQL will not read it unquoted. The inventory records the name
verbatim and quoting belongs to whoever builds the statement, which on this
connection means a backtick.

Which quote a provider uses is data the interface reads rather than a branch
someone maintains, the same shape as every other
[declared capability](/features); each engine's published boundary sits on its
row on the [databases page](/databases).

## Paging, and why it is expressed as data rather than a branch

The good news in the same grammar. Measured:

```sql
SELECT customer FROM probe_orders LIMIT 2 OFFSET 1
```

is HTTP 200 with the rows the offset asks for. Both `LIMIT n` and `LIMIT n
OFFSET m` are correct here, so the shared limiter that wraps a user's statement
is right unmodified and the query preparer refuses nothing on this connection.
Load more works on an OpenSearch connection.

The way that is expressed matters more than the fact. One directory serves two
search type-ids, and `OFFSET` is the single behavioural difference between them
above the wire. It is declared as a per-product trait, `acceptsOffsetClause:
true`, read by `prepareQuery()` alone. A method that asked whether the dialect
happened to be OpenSearch would work and would be the wrong shape: it states the
product rather than the capability, and the next engine gets added to a condition
someone has to find rather than declaring its own answer.

Two facts about the same grammar, then, and they are not opposites. The paging
clause is a trait the code can read and act on. The quoting rule is not: nothing
in the transport can inspect your predicate and decide you meant a field. The
only defence is the backtick, typed by hand.
