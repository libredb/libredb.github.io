---
title: Three ways a panel can say nothing, and why they differ
status: published
author:
  name: LibreDB
  picture: ''
slug: libredb-monitoring-refusal-taxonomy
description: Two panels refuse with their reason, one stays empty in the engine's own words, a third reads not measured, and each of those is a different claim about the database.
coverImage: ''
tags:
  - value: engineering
    label: Engineering
  - value: databases
    label: Databases
publishedAt: 2026-05-28T09:00:00.000Z
---

Open the monitoring dashboard on an embedded LibreDB file and several panels have
nothing in them. That is not a defect, and it is not one condition either. In
database monitoring, missing metrics have a meaning, and the meaning is different
in each panel: one was measured and came back at zero, one was never measurable,
one was asked and the engine has no record, and two were not asked at all because
there is nothing there to ask.

A blank rectangle can stand for any of them, and rendering all four the same way
leaves the reader to guess which one they are looking at. On a LibreDB connection
all four occur at once on the same screen, which makes it a workable place to pull
them apart.

## Refused, empty, N/A and zero

Here is the taxonomy, stated as four distinct claims about the world.

| Rendering | The claim it makes |
| --- | --- |
| A number, including `0` | This was measured. The reading is this. |
| `N/A` over *Not measured* | There is no counter here to read. |
| An empty list plus a sentence | The engine was asked and keeps no such record. |
| Absent, with its reason | There is no such object, so the question does not apply. |

An empty array is the dangerous one, because it looks like humility and is not.
`[]` in a Sessions panel says the store was asked who was connected and answered
nobody. That is a measurement. If nobody can be asked, the array is a fabricated
reading, and the panel has no way to tell it apart from a real one.

This is why refusing carries more information than answering empty. A refusal
names the reason at the point where the reason applies. An empty list hands the
reader a shape they already know how to misread.

The cost of getting it wrong was measured before the change. On a file holding a
25-row relational table, a 7-document collection and 4 raw key-value keys,
`getMonitoringData()` answered `"tableCount": 5` in the Overview and `"tables": []`
in the panel directly beside it. The dashboard reported zero tables on a database
with tables. LibreDB is the embedded engine of the zero-config first run, so that
is the first dashboard many people ever open.

## Why there is no session to list here

`getActiveSessions()` throws `LIBREDB_ACTIVE_SESSIONS_REFUSAL`. The panel is
absent and its reason is printed where it would have been.

The reason is structural. A `.libredb` file has no server and no wire protocol;
it is opened in-process by the `@libredb/libredb` package, inside the Studio
server that is drawing the dashboard. There is no session, connection or client
call anywhere in the shipped surface of that package to read.

The nearest thing to a registry is the exclusive lock sidecar `open()` takes, and
it was checked rather than assumed. Measured, `<path>.lock` holds four lines:

```text
libredb-lock
<pid>
<hostname>
<nonce>
```

That pid is this very server's own. There is no user, no statement and no start
time in it, so there is no session row to build even by inference. A single line
reading "this process" would be a claim about concurrency that the file cannot
support.

Note what is not refused: `getHealth()` still answers, with `activeConnections: 1`
and `activeSessions: []`. That is deliberate rather than inconsistent. The
connection dialog's Save is gated on `POST /api/db/test-connection`, which calls
health, so a throwing health check would lock the embedded engine out of the
product entirely. A health check exists to answer whether the thing is reachable.
A monitoring panel has the opposite obligation - it is the surface whose job is to
say what it could not read.

## Why there is no index object to describe

`getIndexStats()` throws `LIBREDB_INDEX_STATS_REFUSAL`, for a different reason
than sessions and worth separating.

The kernel is a single ordered key-value keyspace. A key's own byte order is the
only index there is, and it is not an object: nothing declares it, nothing names
it, nothing can be rebuilt or dropped. The persisted catalog records which lens a
namespace belongs to and, for a relational namespace, its declared columns - and
nothing that indexes them.

So an empty Indexes panel would read as *this database has no indexes yet*, which
is an invitation. It suggests the next step is to create one. On this engine
there is no next step; the state is permanent, not initial.

One number survives that refusal. `getOverview().indexCount` stays `0`, because
that genuinely is a measurement: the count of index objects is zero and always
will be. Zero and absent are the two claims easiest to confuse and the two it
matters most to keep apart. The same split governs the Performance tab, where
`getPerformanceMetrics()` returns an empty object and the Cache Hit, Buffer and
Deadlocks cards read `N/A` beside *Not measured* rather than a percentage or a `0`
badged healthy. There is no buffer pool here with hits and misses, so there is no
counter to read and nothing a ratio would be a ratio of.

## The scan cap that makes a count untrustworthy

The Tables panel does answer, and it answers from the same bounded scan the schema
tree uses, so the tree and the panel cannot disagree. One row per namespace, key
count as the row count, the namespace's lens (`relational`, `document` or `kv`)
in the schema column. The byte fields stay absent and `totalSize` reads `N/A`,
because the file format keeps no per-namespace size and a `0` would be summed by
the Storage tab as a measurement.

That scan stops at `LIBREDB_MAX_KEY_SCAN`, which is 10,000 keys, reached via
`kv.range('', '\u{10FFFF}')` over the whole keyspace. Past that point every count
is short by an unknown amount - not approximately right, but wrong by a quantity
nobody can state. So above the cap the panel refuses with
`LIBREDB_TABLE_STATS_TRUNCATED` instead of publishing the low number.

Here is the limit, plainly. On this engine, active sessions and index statistics
are refused with their reason rather than answered empty, and table statistics
refuse above the ten thousand key scan cap rather than publishing counts short by
an unknown amount. If your file is larger than that, this panel will tell you it
cannot count rather than count badly.

The schema tree still lists the namespaces it reached, and that is not a
contradiction: a list of namespaces is one reading's reach, while a row count is a
quantity. The first can be partial and still true. The second cannot.

## Reading the dashboard

Applied to a LibreDB connection, the monitoring panels sort like this. Overview,
Storage and Tables answer. Performance and Pool read `N/A` over *Not measured*.
Queries is empty and carries the engine's own sentence - *LibreDB keeps no
statistics about finished statements in this version* - which is the one panel
allowed to stay empty, precisely because the provider declares that sentence.
Sessions and the index statistics are absent with their reasons. The Vacuum
summary card reads `N/A` over *Not supported*, since `runMaintenance()` throws
here and a bloat count over no rows once produced a `0` badged green, which is a
clean bill of health for an operation that does not exist.

This is the rule the rest of the product runs on: [what each panel can show
is bounded by what the engine reports](/features), and every engine's deliberate
absences are published on [its own page](/databases) rather than discovered at
runtime. The dashboard is just where that rule is hardest to follow, because
blankness is cheap and a reason costs someone a paragraph.
