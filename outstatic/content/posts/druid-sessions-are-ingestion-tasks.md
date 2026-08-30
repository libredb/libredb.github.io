---
title: Druid has no query sessions, so the panel shows tasks
status: published
author:
  name: LibreDB
  picture: ''
slug: druid-sessions-are-ingestion-tasks
description: Rows come from the task table and every column is relabelled to say so, because there is no session catalog and no query log anywhere to read.
coverImage: ''
tags:
  - value: engineering
    label: Engineering
  - value: databases
    label: Databases
publishedAt: 2026-05-14T09:00:00.000Z
---

Open the monitoring dashboard on an Apache Druid connection and the Sessions tab
lists rows. None of them is a session. Druid monitoring is sys tables and
`INFORMATION_SCHEMA` reads over the one SQL endpoint, and among those tables
there is no `sys.queries` and no connection catalog of any kind. What the panel
lists is ingestion tasks, and every column in the row has been relabelled to say
so out loud.

A panel here takes one of three shapes: it reads a system table, or it reads one
and calls the result something other than the panel's own name, or it sends no
statement at all because the fact it wants is not in SQL anywhere. All three are
in the dashboard at once.

## Which sys tables each Druid monitoring panel reads

The provider has no driver. Every statement, including every monitoring read, is
a JSON body posted to `POST /druid/v2/sql` on port `8888` (the Router) or `8082`
(the Broker) with the runtime's own `fetch`. So a monitoring panel here is a
`SELECT` and nothing more exotic:

| Panel | Statement source | What the number is |
| --- | --- | --- |
| Overview identity, uptime | `sys.servers` | version and start time from the Coordinator's row, Broker as fallback |
| Overview size | `sys.segments` | `SUM(size)` over active segments |
| Overview datasource count | `INFORMATION_SCHEMA.TABLES` | rows where `TABLE_SCHEMA = 'druid'` |
| Overview active connections | `sys.tasks` | the count of `RUNNING` tasks |
| Tables | `sys.segments` where `is_active = 1` | rows and bytes grouped by datasource |
| Storage | `sys.servers` where `server_type = 'historical'` | `curr_size` over `max_size` per historical |
| Sessions | `sys.tasks` where `status IN ('RUNNING','PENDING')` | ingestion tasks |
| Performance | none | zeroed |
| Slow queries | none | empty |
| Indexes | none | empty |

The `is_active = 1` filter on every `sys.segments` read is not a speed
optimisation. That table describes every segment the metadata store knows about,
including segments superseded by a compaction or by re-ingesting the same
interval. Summing all of them counts the same rows and bytes twice, so a
re-ingested datasource would appear to have doubled in size.

The storage division has the same character. `sys.servers` reports `max_size = 0`
for every process that is not a historical, so on an ordinary cluster the usage
percentage meets a zero denominator. It yields `0` there, not a flattering `100`
and not `NaN`.

## Four separate reads, so one denial is not fatal

The overview needs four facts and could ask for them in one statement. It does
not. `sys.servers`, `sys.segments`, `INFORMATION_SCHEMA.TABLES` and `sys.tasks`
are four separate round trips.

The reason is the permission model. On a cluster running
`druid-basic-security`, access to the `sys` schema is granted table by table. A
role that is allowed the datasource count but declined `sys.tasks` would, under
one joined statement, lose the whole overview to a single authorization failure.
Split, it loses one card.

Only three error categories are allowed to degrade a panel to empty:
`UNAUTHORIZED`, `FORBIDDEN` and `NOT_FOUND`. Anything else keeps propagating and
becomes a message the user reads. That boundary matters more than it sounds,
because an empty monitoring panel is the perfect hiding place for a mistake the
user made themselves.

Failures are classified by the `category` Druid reports, never by the HTTP
status, because the status misclassifies in both directions. `SELECT 1/0` - an
ordinary typo - answers HTTP 500 with `persona: "ADMIN"` and
`category: UNCATEGORIZED`. Reading 5xx as "the cluster is broken" would send
someone to check their host over a division by zero.

The schema tree goes further and touches no `sys` table at all: datasources and
columns come from `INFORMATION_SCHEMA` only. A cluster that declines to describe
its servers still renders a full sidebar.

## Relabelling a session panel that lists tasks

Returning an empty Sessions tab would have been defensible and would have been
wrong. A multi-hour ingestion saturating the MiddleManagers is real activity, and
a blank panel would report a quiet cluster. Tasks are the only activity Druid can
describe, so they are what the panel shows - and each row is made self-describing
rather than dressed up as a connection:

| Session field | Druid value |
| --- | --- |
| `applicationName` | the constant `Druid ingestion task` |
| `pid` | `task_id` |
| `database` | `datasource`, or the literal `none` for a task such as `noop` |
| `state` | `RUNNING` or `PENDING` |
| `query` | the task type: `index_parallel`, `compact`, `kill` |
| `user` | `unknown` |
| `durationMs` | `CURRENT_TIMESTAMP - created_time` |

Two of those are deliberate refusals. `user` is `unknown` because `sys.tasks`
records no submitter identity; borrowing the connection's own user would credit
that account with a task it did not submit. And the age is computed from two
readings of the server's clock rather than from `sys.tasks.duration`, because
that column is `-1` for a task that has not finished, which is every task this
query selects. Projecting it would print `-1ms` on every row, so it is not
projected at all.

The `applicationName` constant is the load-bearing part. It is what stops a
reader skimming the tab from concluding that Druid has a connection catalog after
all.

## Metrics that reach an emitter, never a table

**The Performance tab is zeroed and sends no statement, because Druid's metrics
reach an emitter rather than a readable table, and the slow-query list is
permanently empty because no system table and no endpoint holds finished
queries.**

Druid's cache, query and ingestion metrics are emitted - to statsd, to Kafka, to
an HTTP endpoint, to the log. None of them lands anywhere SQL can read, and no
configuration setting moves them into `sys`.

Two consequences follow. `cacheHitRatio` in the health summary is
the string `N/A`, not a number: that field is typed as a string, so it can say
*not measured*, and a fabricated low number would trip the cache-ratio threshold
alert into reporting a fault that does not exist. Inside the performance metrics
themselves the same ratio is a required field, so it carries a neutral `0` while
every other metric in that type is optional and is left out entirely - a zero
there would read as a measurement of zero, which is a different and false claim.
The second consequence is `maxConnections`, which is `0` because Druid publishes
no connection limit anywhere in SQL. It has no pool - each statement is one
stateless HTTP request.

## Panels that send no statement at all

Three more panels send no statement either, and the silence is the design.

**Slow queries.** Druid keeps no query log: no system table, no endpoint, no
file. The empty state says exactly that, in place of the rows. The panel does not
send a probe to discover it, because there is nothing to probe.

**Indexes.** Druid indexes every dimension inside its segment, but those indexes
have no name, no size and no usage counter. There is no index object a row could
describe, so `indexCount` is `0` and the list is empty.

**Maintenance.** Nothing in the maintenance vocabulary - vacuum, analyze,
reindex, optimize, check, kill - has a SQL-reachable Druid analogue. Compaction
and retention are Coordinator and task concerns. `kill` is impossible for a
second, independent reason: with no `sys.queries` there is nowhere honest to read
a cancellable query id from. So the controls do not render, and the Vacuum
summary card reads `N/A` rather than counting zero bloated tables and awarding a
green OK for an operation that cannot run.

The distinction the dashboard keeps is between *absent* and *empty*. An absent
panel means the engine could not answer; an empty panel means zero is a real
measurement. Druid holds no finished queries and no index objects, so zero is the
true count and an empty list states it correctly. A denied panel is a different
claim, and the two are not allowed to look alike.

None of this is unique to Druid in kind, only in which panels it hits. The
[monitoring feature page](/features) states the same boundary in general terms -
what a panel can show is bounded by what the engine reports - and the
[engine pages](/databases) carry each engine's line next to its transport and
default port.
