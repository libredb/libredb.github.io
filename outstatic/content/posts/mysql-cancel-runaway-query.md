---
title: Stopping a runaway MySQL query is cancellation, not a timeout
status: published
author:
  name: LibreDB
  picture: ''
slug: mysql-cancel-runaway-query
description: No server-side statement timeout is wired into the pool, so nothing kills a long query on its own and cancellation is an explicit act with a caveat.
coverImage: ''
tags:
  - value: engineering
    label: Engineering
  - value: databases
    label: Databases
publishedAt: 2026-01-20T09:00:00.000Z
---

An unbounded join goes out at 02:00 and the results grid keeps spinning. The
operator's first instinct is to wait for a timeout to fire, and on the MySQL
connection there is no timeout to wait for. To kill a long running MySQL query
here you press Cancel, and that press sends one statement to one connection.

## The pool sets no statement timeout, so nothing expires on its own

The MySQL provider builds a `mysql2` pool and sets only options that pool has:
`connectionLimit` from the pool `max` (default 10), `waitForConnections`,
`queueLimit`, `enableKeepAlive`, `keepAliveInitialDelay` and `timezone`. The
provider's own `queryTimeout` option is not among them. PostgreSQL's provider can
translate that option into `statement_timeout` because `pg` has a place to put it;
the mysql2 pool has no equivalent, so the value is not translated and no
server-side bound is applied.

State it plainly, because it is the boundary this page exists to publish: the
pool sets no server-side query timeout, so a runaway query is not auto-killed,
and cancellation reports success without confirming that the target statement was
actually executing. A query runs until the server finishes it, until the
connection dies, or until somebody cancels it.

`wait_timeout` is easy to mistake for the missing bound, and it is unrelated. It
bounds an idle connection, not a statement in flight. A connection executing a
long aggregate is not idle, so nothing in that setting touches it.

One real bound does exist next door, and it is worth naming so the two are not
confused. A transaction opened through the provider holds a dedicated connection
checked out from the pool and arms a five-minute auto-rollback timer, so a
transaction left open expires and releases its locks. That timer bounds a
transaction's lifetime. It does not bound a statement.

## What Cancel sends, and against which connection

Cancellation is explicit and it is wired through the query itself. A statement
issued with a `queryId` records the `threadId` of the pooled connection it was
handed. `cancelQuery(queryId)` looks that thread id up and issues:

```sql
KILL QUERY <threadId>
```

`KILL QUERY` ends the statement and leaves the connection alive, which is the
distinction the whole path depends on. The killed statement surfaces to its own
caller as a cancellation rather than a server fault: MySQL reports *Query
execution was interrupted*, and `mapDatabaseError()` classifies that into
`QueryCancelledError`. That classification is the difference between a statement
the caller reports as stopped and one it reports as a server fault.

The recorded thread id is why the id matters more than the query text. Two
sessions can be running byte-identical SQL; the one that gets killed is the one
whose connection was recorded under that `queryId`. Cancellation is addressed to
a connection, never to a statement.

The statement carries no parameters, so it goes over mysql2's text protocol via
`conn.query` rather than the prepared protocol - the same routing rule every
parameterless statement here takes, which is also what keeps `SHOW STATUS`,
`CHECK TABLE` and `EXPLAIN FORMAT=JSON` working on the engines that refuse them
when prepared.

There is a second kill, and it is a different thing. The maintenance toolkit's
`kill` operation sends `KILL <connection-id>` - no `QUERY` keyword, so it ends the
connection, not one statement - and it requires an integer connection id, which
comes from the Sessions panel reading `information_schema.PROCESSLIST`. That
operation is admin-only. Editor cancellation is not the maintenance kill and does
not need the maintenance grant.

## What success means and what it does not confirm

`cancelQuery()` returns `true` when the `KILL QUERY` statement itself succeeded.
That is the whole of the claim. It does not confirm that the target thread was
mid-statement at the moment the kill landed.

So a `true` is consistent with more than one outcome: the statement was running
and was interrupted, or the press and the kill straddled the moment the statement
finished. The provider reports the server's answer to the statement it sent, and
that answer is about the kill, not about the state of the thread it named.

The confirmation you actually want comes from the other end of the pair. If the
statement was executing, its own caller receives `QueryCancelledError` - the
interruption is observed where the query was waiting. That is the signal to read.
The boolean says the kill was sent and accepted; the error on the query says it
bit. If neither arrives and the grid is still spinning, look at the session list
rather than pressing Cancel again.

## Result shapes for statements that return nothing

Cancelling a `SELECT` costs you a result set. Cancelling a write raises the
sharper question of what landed, and the answer is in an envelope that looks
nothing like a `SELECT`'s.

mysql2 hands back an array of rows only when the statement produced a result set.
For DDL and for `INSERT`, `UPDATE` and `DELETE` it hands back a `ResultSetHeader`
object instead, and the field packets arrive as `undefined`. Printed straight out
of the driver for `INSERT INTO r5_hdr (note) VALUES ('a'),('b')` on MySQL 26.7.0:

```js
{ fieldCount: 0, affectedRows: 2, insertId: 1,
  info: "Records: 2  Duplicates: 0  Warnings: 0",
  serverStatus: 2, warningStatus: 0, changedRows: 0 }
```

The provider reads that into the standard envelope:

```ts
{ rows: [], fields: [], rowCount: header.affectedRows, executionTime }
```

No rows, no fields, no `columnTypes`, and the affected-row count in `rowCount` -
which is the number the results footer renders. Three of the header's fields are
dropped because the result type models none of them: `insertId`, `changedRows` and
`warningStatus`.

`changedRows` being one of the dropped three has a consequence you should know
before you read that footer as a verdict. `affectedRows` is the **matched** count,
not the modified count. A no-op `UPDATE ... SET note = note` reports `1` while
`changedRows` is `0`. The footer is telling you how many rows the statement
matched. It is not telling you how many rows now hold a different value.

## Bounding results instead of racing them

Cancellation is a recovery. The cheaper move is not to send the unbounded
statement.

A bare `SELECT` from the editor is rewritten with a `LIMIT` before it reaches the
server. The default page size is 500 rows, and an explicitly unlimited run still
caps at 100,000. The analyzer that decides this reads both standard
`LIMIT n [OFFSET m]` and MySQL's own `LIMIT offset, count`, so a query you already
bounded is respected rather than bounded twice.

Two MySQL-specific readings sit inside that. `#` is a comment marker in this
dialect, and the readers are told which dialect they are reading, so
in `SELECT * FROM t # LIMIT 10` the commented-out bound is no longer read as a
real one and the statement no longer reaches the server unbounded. The same fix
settled a worse case: a `#-` sequence inside a CTE once read as a PostgreSQL
operator, which let a `)` inside a
comment close the CTE body, typed a `DELETE` as a `SELECT`, and appended a `LIMIT`
to it - a bound that MySQL 8 accepts and commits, deleting part of a table while
the grid reported a truncated result set.

None of that bounds execution time. A `LIMIT 500` over an unindexed join still
scans everything before it returns five hundred rows. It bounds the transfer and
the browser, not the server's work, which is exactly why the cancel path exists
and why its caveat is published rather than buried. The per-engine capability
lines on [the engine pages](/databases) and the boundaries listed with each
[feature](/features) are written the same way, for the same reason.
