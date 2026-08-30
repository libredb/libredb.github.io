---
title: Paging Trino, and the session settings that do not stick
status: published
author:
  name: LibreDB
  picture: ''
slug: trino-offset-before-limit-stateless-session
description: The clause order is transposed for you and a trailing semicolon is a syntax error, while a session setting succeeds and then affects nothing.
coverImage: ''
tags:
  - value: engineering
    label: Engineering
  - value: databases
    label: Databases
publishedAt: 2026-07-01T09:00:00.000Z
---

The shared query limiter in LibreDB Studio appends a `LIMIT ... OFFSET ...` clause to
fetch the second page of a result. Measured against Apache Trino 476, that statement answers
`line 1:47: mismatched input 'OFFSET'` and stops. Nothing about the query is wrong; the
clause order is. Two more editor-level facts sit next to that one, and the third does not
fail at all.

## The clause order this grammar wants

Trino's grammar is `[ OFFSET count ] [ LIMIT count ]`, and only that way round.
Measured against `trinodb/trino:476`:

```sql
SELECT nationkey FROM tpch.sf1.nation LIMIT 3 OFFSET 1
-- line 1:47: mismatched input 'OFFSET'. Expecting: <EOF>

SELECT nationkey FROM tpch.sf1.nation OFFSET 1 LIMIT 3
-- rows
```

That matters more than a typo would, because a results grid does not ask a person to write
the pagination clause; it appends one. Every page after the first is a statement the tool
generated, so a generator emitting `LIMIT` before `OFFSET` fails every paged read, while
the first page, which carries no offset, succeeds.

## Why the limiter transposes rather than passes through

The shared query limiter in LibreDB Studio is one piece of code for every SQL engine. It
decides where the clause goes, which is the hard part: it inserts before a trailing
comment, and it refuses a statement whose end it cannot safely cut, because the reader
that finds the end scans spans rather than matching a regular expression against the
last few characters. A statement whose string literal or block comment never closes is
left alone instead of being truncated at the wrong place.

That work is correct on Trino. Only the clause order is wrong. So the Trino provider
overrides one inherited helper, `prepareQuery()`: it calls the shared implementation first
and then transposes the two clauses. It does not rewrite the statement, and it does not
carry a second copy of the limiter's placement logic.

Which occurrence gets transposed is decided by reconstruction rather than by position,
and that is not defensive coding. Because the clause is inserted before a trailing
comment, `lastIndexOf` finds the text inside a comment on a statement that quotes its own
bound, and `indexOf` finds a subquery's. Exactly one occurrence is the appended one: the
one whose removal, together with the single space in front of it, yields the original
statement back. That is the test the code applies.

Paging is therefore real on Trino, and the transposition never reaches the editor.

## The trailing semicolon that is a syntax error

`SELECT 1;` is a syntax error on Trino: `line 1:9: mismatched input ';'`. The statement
endpoint takes one statement and no terminator, which the provider declares as
`statementTerminator: "none"`. That declaration is load-bearing rather than cosmetic,
because the shared statement generators read it; without it they emit statements this
engine refuses.

The transport then drops a single trailing semicolon before the statement leaves it, so
`query("SELECT 1;")` and `query("SELECT 1")` reach the coordinator as identical bytes.
Trailing whitespace and a newline after the semicolon count as trailing too, which is
what a statement pasted out of a file carries.

It is a strip, not a splitter, and the difference is the whole of it:

| You send | Reaches the wire as | Why |
| --- | --- | --- |
| `SELECT 1;` | `SELECT 1` | The terminator, dropped |
| `SELECT 1 ;\n` | `SELECT 1` | Whitespace after it is trailing too |
| `SELECT 1; SELECT 2` | unchanged | The endpoint takes exactly one statement |
| `SELECT 1;;` | unchanged | A doubled terminator is a second, empty statement |
| `SELECT ';';` | `SELECT ';'` | A semicolon inside a literal is data |
| `SELECT 1 -- done;` | unchanged | A semicolon inside a comment is prose |
| `SELECT 1; -- done` | unchanged | Declared limit: a terminator with a comment after it is left alone |

The last row is a boundary, not an oversight. A rule with an undocumented edge is worse
than a narrower rule with a stated one.

## Statements that succeed and affect nothing

The first two facts announce themselves with an error. This one does not.

There is no connection to Trino in the usual sense. The provider speaks Trino's own
client protocol over HTTP - `POST /v1/statement`, then a chain of `nextUri` links - with
no driver of any kind and no connection pool. **Each statement is sent on its own
connection.** None of the session the coordinator offers back is kept.

So `SET SESSION`, `USE`, `PREPARE` and `DEALLOCATE` all report success, and then have no
effect on the next statement. Nothing in the answer distinguishes them from a statement
that worked, because as far as the engine is concerned one did. Set a session property,
run your query, and the query ignores the property. Type `USE tpch.tiny`, then run a
statement with a bare table name, and the name does not resolve. The engine reported
success both times.

That is the boundary this engine carries, and it is stated rather than smoothed over:
session settings, catalog selection and prepared statements report success and have no
effect on the next statement. Each of those four operations therefore attaches a warning
to its own result:

> `"SET SESSION"` succeeded, but each statement is sent on its own connection, so it will
> not affect the next one. Qualify names in full instead.

A warning is a strange thing to attach to a success. It is the right thing here, because
the alternative is a user who watches four statements succeed and then debugs the fifth.
The engine's own remarks travel the same channel - a redundant `ORDER BY` in a subquery
answers with rows plus `REDUNDANT_ORDER_BY` - de-duplicated, because the same remark
repeats on every page of the exchange and a caller must not render it six times.

The same statelessness is why transactions are not offered on Trino at all. Trino has
`START TRANSACTION`, but a transaction lives in an HTTP session header this provider does
not carry between statements, so the controls are absent rather than present and broken.

## Qualifying names in full instead

The warning ends with the remedy, and the remedy is the way the rest of the integration
already works. Every name the tool generates is fully qualified, `schema.table`, because
Trino resolves a bare name only when the session has a schema - and there is no session.

The connection's Database field pins one catalog, sent as `X-Trino-Catalog` on every
request. That field is a catalog, not a database, and what it decides is which catalog
the schema tree shows: two levels, catalog to schema to table, every table displayed
`schema.table`. It does not constrain the editor. A cross-catalog join runs exactly as
typed as long as the names are fully qualified, and a connection that pins no catalog
still connects and still runs every fully qualified statement - it just has no tree, and
the schema read says that is why rather than showing an empty one.

So the working habit on Trino is the habit the warning asks for. Write
`catalog.schema.table` in the editor and the missing session cannot change what a name
resolves to. Write a `USE` and it can. The engine's published line on
[the engine pages](/databases) names the neighbouring boundary: Trino queries catalogs, it
does not manage a lakehouse, and writes depend on the underlying connector. Measured, a
connector that accepts `CREATE TABLE` answers `UPDATE` with `This connector does not
support modifying table rows`, and that refusal is shown verbatim.

Two of these three facts the tool absorbs and you never see. The third arrives as a
warning on a statement that succeeded, because that is the only place a reader can still
act on it. What the editor generates per engine, and what it does not, is written down on
[the features page](/features).
