---
title: Oracle monitoring depth is a privilege question
status: published
author:
  name: LibreDB
  picture: ''
slug: oracle-monitoring-privilege-question
description: A least-privilege application user gets a dashboard that renders with gaps, because each dynamic-view read is guarded on its own rather than as one block.
coverImage: ''
tags:
  - value: engineering
    label: Engineering
  - value: databases
    label: Databases
  - value: security
    label: Security
publishedAt: 2026-01-23T09:00:00.000Z
---

`ORA-00942: table or view "SYS"."V_$SYSSTAT" does not exist`. That is what the
performance read answers for a user granted only `CREATE SESSION`, measured on
2026-08-23 against Oracle AI Database 26ai Free. Nothing is misconfigured. On
Oracle, `V$SESSION` permission denied is the ordinary monitoring outcome for an
application user, because Oracle's own *Database Reference* says that after
installation only `SYS` or a user with `SYSDBA` has access to the dynamic
performance tables. Everything below follows from that one sentence.

The interesting part is not that panels are empty. It is which panels, and which
grant fills each one.

## Which dynamic views each panel needs

The Oracle provider reads the `V$` dynamic-performance views, plus `USER_*` and
`ALL_*` for object statistics and `DBA_DATA_FILES` for storage. Each monitoring
method has its own source, and therefore its own privilege requirement:

| Reading | Source view | What is gone without it |
| --- | --- | --- |
| Health | `V$SESSION`, `USER_SEGMENTS`, `V$SYSSTAT`, `V$SQL` | the active-connection count and the cache-hit ratio |
| Overview | `V$VERSION`, `V$INSTANCE`, `V$SESSION`, `V$PARAMETER`, `USER_SEGMENTS`, `USER_TABLES` / `USER_INDEXES` | version, instance, connection count, the published session ceiling |
| Performance | `V$SYSSTAT` | the cache-hit ratio, which is the whole of this reading |
| Queries | `V$SQL`, top-N by `ELAPSED_TIME` | the slow-query list, which comes back `[]` |
| Sessions | `V$SESSION` joined to `V$SQL` | the session list, and with it the `SID,SERIAL#` a kill needs |
| Tables | `ALL_TABLES` + `USER_SEGMENTS` | nothing: these are the user's own objects |
| Storage | `DBA_DATA_FILES`, falling back to `USER_SEGMENTS` | per-tablespace figures; the fallback still answers |

Two rows in that table still answer for a schema user who has never been near a
`V$` grant. Tables reads the connecting user's own segments. Storage tries
`DBA_DATA_FILES` first and falls back to those same segments when that read is
refused, so it answers either way - with the user's own segment sizes rather
than per-tablespace figures. The pool tab is not in the table because it is not
a server read: the figures come from the `oracledb` pool inside the container,
so it reports the same way regardless of what Oracle will let this user see.

## Why every sub-query is guarded separately

The straightforward implementation issues the monitoring reads together and lets
the first `ORA-00942` end the call. What the user then sees is a dashboard that
failed, and a failed dashboard says nothing about which of eight reads was
refused.

So each sub-query is wrapped in its own try/catch and degrades on its own. A
refused `V$SQL` costs the Queries panel and leaves the Tables panel intact. A
refused `V$SYSSTAT` costs the cache-hit ratio and leaves the version string
standing. The default a guard degrades to is `N/A` or `[]` where the shape has
somewhere to say "not measured" - and, where it does not, nothing at all.

This is the same rule the rest of the product follows for engine capabilities:
[a control that cannot work](/features) is absent with the reason written where
it would have been, rather than offered and then failed. Here the reason is a
grant rather than an engine limit, which makes it more actionable, not less.

## What a session-only user actually sees

Take the measured case - a user with `CREATE SESSION` and nothing else - and
walk the tabs.

The Overview tab draws its Connections card as `N/A` with the words "not
published" under it, and the connections trend chart drops that sample instead
of plotting a point at zero. The Performance tab says "Not measured" where the
cache-hit ratio belongs. The Queries panel is empty, and its empty state on this
engine reads: *Query stats come from V$SQL, which this user needs SELECT on to
read.* The Sessions panel is empty for the same reason. Tables and Storage are
populated. The Pool tab is populated.

**The limit worth stating plainly: on Oracle the performance reading reports
only the cache-hit ratio - there is no queries-per-second figure, no deadlock
count and no buffer-pool gauge - and it omits even that ratio when `V$SYSSTAT`
cannot be read. The active-connection count is omitted rather than reported as
zero when `V$SESSION` is denied.** A ratio genuinely measured as zero is kept and
shown as `0.0%`; an instance that really has no active session measures `0`, and
that `0` is a reading.

Two related gaps are not privilege questions and will not close with a grant.
`getIndexStats().scans` is always `0` because Oracle's index usage counters are
not read here, and table row counts come from `ALL_TABLES.NUM_ROWS`, an optimizer
estimate that can be stale or `NULL` until `DBMS_STATS` has run.

## Absent rather than zero, and why it matters for alerts

Both fields used to be initialised to `0`, with the guard leaving that `0`
standing. `ORA-00942` therefore arrived downstream as a measured statement: no
active sessions, on an instance Oracle had said nothing about. The cache ratio
was worse. It published `0%`, and the Overview card rates a low ratio "Needs
tuning" - so a least-privilege application user was shown a cache fault that
Oracle never reported.

An alert cannot tell those apart, because a threshold takes a number and has no
place to put a refusal. Zero active connections is a page at 03:00. A missing
key is a configuration finding. The absence is spelled with an explicit
measured-number helper and a conditional spread, never `|| undefined`, because
`|| undefined` would swallow the real zero along with the refusal.

One field is deliberately not optional beside them. `maxConnections` comes from
the `V$PARAMETER` `sessions` ceiling, and there `0` already means "no limit
published" - the same fact as absence - so a refused read leaves the `0` and the
card says so. The count is read first inside that shared block precisely so a
refused ceiling cannot carry a measured count away with it.

## The grants that fill each gap

The views themselves carry the `V_$` prefix; what an application queries is the
`V$` public synonym over them. The grant is on the underlying view, and it is
per view, which is what makes the mapping above worth having - a DBA can hand
over exactly the panel that is being asked for:

```sql
-- Sessions panel, and the connection counts in Health and Overview
GRANT SELECT ON SYS.V_$SESSION TO app_user;

-- Performance tab: the cache-hit ratio
GRANT SELECT ON SYS.V_$SYSSTAT TO app_user;

-- Queries panel, and the SQL text shown beside a session
GRANT SELECT ON SYS.V_$SQL TO app_user;

-- Overview: version, instance, and the published session ceiling
GRANT SELECT ON SYS.V_$VERSION   TO app_user;
GRANT SELECT ON SYS.V_$INSTANCE  TO app_user;
GRANT SELECT ON SYS.V_$PARAMETER TO app_user;

-- Storage: per-tablespace figures instead of the USER_SEGMENTS fallback
GRANT SELECT ON SYS.DBA_DATA_FILES TO app_user;
```

Nothing there is required to use the product. A user with only `CREATE SESSION`
and object privileges gets the editor, the schema tree, the ER diagram, row
editing, the Tables and Storage panels, and Agent plan mode, which is toolless
and executes nothing. Agent auto mode is a different question, and no grant
reaches it: auto runs on PostgreSQL, SQLite and DuckDB only, and an auto run
started against Oracle ends engine-unsupported. The `V$` grants buy
observability and nothing else.

They are also not free, and the [security page](/security) is the argument for
treating them that way: `V$SESSION` exposes what every other session in the
instance is running, across schemas the grantee cannot otherwise read. Killing a
session is a further step again - the operation issues `ALTER SYSTEM KILL
SESSION '<SID,SERIAL#>'`, and the maintenance toolkit and the audit trail are
admin-only inside the product regardless of what the database user could do.

The useful version of this decision is per panel. Somebody wants the slow-query
list; that is one grant on one view, and the blast radius of that grant is
readable in a sentence. The alternative that gets
reached for instead - a blanket dictionary grant, or a DBA role handed to the
application user - fills every panel at once, and is the reason the empty ones
are worth mapping one by one first.
