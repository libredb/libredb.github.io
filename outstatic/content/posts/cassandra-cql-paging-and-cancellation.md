---
title: Paging CQL, and the running statement you cannot stop
status: published
author:
  name: LibreDB
  picture: ''
slug: cassandra-cql-paging-and-cancellation
description: A second page is refused with its reason rather than silently re-serving the first, and there is no cancel path at all on this engine to fall back on.
coverImage: ''
tags:
  - value: engineering
    label: Engineering
  - value: databases
    label: Databases
publishedAt: 2026-02-26T09:00:00.000Z
---

The editor bounds every SELECT before it sends it, and on Apache Cassandra the
`LIMIT` / `OFFSET` pair that paging usually rests on has only its first half.
`LIMIT n` is correct CQL. `OFFSET n` is not in the grammar at all, so the shared
row limiter has to be overridden here in three places - and two of the three are
about text rather than about rows.

The statements below were measured against Apache Cassandra 5.0.9, the official
`cassandra:5.0.9` image, before the provider existed.

## Why there is no second page: CQL has LIMIT, and no OFFSET

The shared limiter appends a bound to a statement that carries none. That part is
right on CQL. Page two is where it stops:

```sql
SELECT id, name FROM probe.customers LIMIT 5 OFFSET 5
-- line 1:45 mismatched input 'OFFSET' expecting EOF
SELECT id, name FROM probe.customers OFFSET 5
-- line 1:37 mismatched input 'OFFSET' expecting EOF
```

There is no clause to write. Cassandra pages a result set on the wire: the server
hands back its own cursor for the next page, which is not an offset a fresh
statement can restate. A second page cannot be assembled by rewriting the text,
which is the only thing a query rewriter is allowed to do.

So the grid on this engine gives you a first page and nothing after it. What the
request does when it arrives anyway is the part worth reading.

## Refusing beats re-serving page one

There were three ways to answer a page-two request, and two of them are worse in
a way that is easy to miss.

**Send the clause anyway.** The user gets `mismatched input 'OFFSET'` about a
keyword they never typed, from a rewrite they never saw. The error is true and
unactionable: nothing in it says which layer wrote the word.

**Drop the clause silently.** This is the expensive one. Without `OFFSET` the
statement is page one again, and the editor appends what comes back to what it is
already showing. The user sees rows one through five, then rows one through five
again, presented as rows six through ten. Nothing errors. That is not a missing
feature, it is a wrong answer, and it is a wrong answer that looks like real data
in a screenshot.

**Refuse the request, with the reason.** `prepareQuery` declines a page after the
first and says why, and the editor reports that instead of pretending. The
refusal covers every SELECT, including one that already carries its own `LIMIT n`
and is therefore never rewritten - because the failure mode being avoided is not
the rewrite, it is the duplicate rows.

This is the same rule the [capability declarations](/features) follow everywhere
else in the product: a control that cannot work is absent with its reason
attached, rather than offered and then quietly wrong. The engine row on the
[databases page](/databases) states the same boundary before you connect.

## Keeping the filtering clause last when a bound is added

The second override is a clause-order fact. `ALLOW FILTERING` must be the last
thing in a CQL SELECT:

```sql
SELECT * FROM probe.orders WHERE amount > 5 LIMIT 3 ALLOW FILTERING
-- 3 rows
SELECT * FROM probe.orders WHERE amount > 5 ALLOW FILTERING LIMIT 3
-- line 1:60 mismatched input 'LIMIT'
```

The shared limiter appends, so on this dialect it would produce the second form
every time. The provider transposes the two clauses instead, preserving the
writer's own spacing, so the bound lands before `ALLOW FILTERING` rather than
after it.

The alternative was to leave a statement ending in `ALLOW FILTERING` unbounded.
That is exactly backwards: a user types those two words precisely when a scan is
about to happen, which is the statement that most needs a ceiling on the rows it
brings back.

One shape is knowingly left unbounded, and it is worth naming rather than
discovering. A statement whose last clause is `PER PARTITION LIMIT n` reads as
already bounded to the shared reader, so nothing is injected. `... PER PARTITION
LIMIT 2 LIMIT 3` is valid CQL, but adding the second bound would mean stripping
the clause the reader matched, and a rewriter that removes clauses is a rewriter
that can corrupt a statement.

## A statement whose rewrite would end inside a comment

The third override is not about rows at all. A CQL line comment may not be
closed by the end of the input:

```sql
SELECT * FROM probe.customers LIMIT 3 -- note
-- line 1:45 mismatched character '<EOF>' expecting set null
SELECT * FROM probe.customers LIMIT 3 -- note\n
-- 3 rows
SELECT * FROM probe.customers LIMIT 3 // note\n
-- 3 rows
```

Two facts are stacked there. `//` is a line comment in CQL as well as `--`; that
half is a shared grammar fact, probed on Cassandra 5.0.9 and on ScyllaDB
2026.2.4 rather than assumed from a neighbouring dialect. While it was a private
scan inside this provider, the shared readers were blind to it, and the statement
splitter cut `SELECT id FROM probe.customers // note; DROP TABLE probe.customers`
- one statement to this server, with both the semicolon and the write inside the
comment - into a read and a bare `DROP`.

The half that stays local to Cassandra is the end-of-input rule. The limiter
inserts its clause before trailing trivia, and the trim that follows drops the
newline that closed the comment. A valid statement becomes a syntax error, caused
entirely by the bound the user did not ask for. So a statement whose rewritten
form would end inside a line comment is left exactly as written, and the result is
reported as unlimited rather than as bounded. The check walks the shared span
reader, which is also what keeps a `//` inside a string literal - `WHERE url =
'http://x'` - from being read as the start of a comment.

## No cancel frame, no kill, no driver method

Everything above assumes the statement comes back. When it does not, this engine
offers nothing to press.

There is no query cancellation on Cassandra at all: the native protocol has no
cancel frame, CQL has no `KILL` statement, and the driver publishes no cancel
method - its client surface is `connect`, `execute`, `eachRow`, `stream`,
`batch`, `getReplicas`, `getState`, `log` and `shutdown` - so the only bound on a
running statement is a client-side read timeout. `cancelQuery()` is therefore not
implemented, and because both routes detect support by the method's presence, the
cancel endpoint answers *"Query cancellation is not supported for this database
type"* rather than reporting a cancellation that silently did nothing.

The timeout is the driver's `readTimeout`, 12000 ms by default, set from the
provider's query timeout. Read what it does precisely: after it expires this
client stops waiting. The coordinator carries on. The work does not stop, the
watching stops.

The per-statement server-side deadline is not available either. `USING TIMEOUT`
is not in 5.0's grammar: `SELECT * FROM probe.orders USING TIMEOUT 1ms` answers
`line 1:27 mismatched input 'USING' expecting EOF`.

Monitoring does list the node's running statements, read from
`system_views.queries` - thread id, task text and two microsecond readings. So you can watch a statement run, including
the read that is watching it, and there is no action attached to any row in that
list. Seeing is not reaching. The maintenance toolkit does not fill the gap
either: compaction, flush, cleanup and repair are `nodetool` actions over JMX, so
`supportsMaintenance` is false and the operations list is empty.

So bound the statement in the text, restrict the partition key, and read the
timeout as the thing it actually is - a limit on how long you will wait, not a
limit on how long the cluster will work.
