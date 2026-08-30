---
title: What silently degrades on a managed SQL Server database
status: published
author:
  name: LibreDB
  picture: ''
slug: sqlserver-azure-sql-restricted-dmvs
description: The one managed host the code recognises by name switches certificate validation on, and the same move narrows the monitoring and maintenance surface.
coverImage: ''
tags:
  - value: engineering
    label: Engineering
  - value: databases
    label: Databases
publishedAt: 2025-12-10T09:00:00.000Z
---

The Connections card reads N/A. The cache-hit ratio says "Not measured". The
Queries panel is an empty list with a sentence about a permission. Nothing is
broken: the host name ended in `.database.windows.net`, and on Azure SQL Database
restricted DMVs narrow monitoring in the same step that the transport starts
validating the certificate it is handed. Two changes off one host suffix, and they
are worth reading together.

## The host suffix that changes the TLS behaviour

`buildConfig()` in `src/lib/db/providers/sql/mssql.ts` sets `encrypt: true` for
every SQL Server connection, and then decides certificate validation from the
host name alone:

```ts
const isAzure = host.endsWith('.database.windows.net');
config.options.trustServerCertificate = !isAzure;
```

That is the whole detection. There is no vendor field, no probe, no account
lookup - a host that ends in that suffix validates the certificate, and a host
that does not, does not. An explicit `connection.ssl` overrides it:

| `connection.ssl.mode` | `encrypt` | `trustServerCertificate` |
| --- | --- | --- |
| unset | `true` | `false` for Azure, `true` otherwise |
| `disable` | `false` | - |
| `require` | `true` | `true` (encrypt, skip validation) |
| `verify-system` / `verify-ca` / `verify-full` | `true` | `false` (validate) |

The three verifying modes build one identical tedious call. Tedious exposes a
single knob and this provider never reads `connection.ssl.caCert`, so
`verify-ca` and `verify-full` do not deliver the CA pinning their names promise.
They validate the chain and the name against the host's own trust store, which is
what `verify-system` already means.

## Why validation is on there and off elsewhere

Because the default that is right for a managed host is wrong for a laptop. The
provider document gives the reason for the non-Azure branch in one clause: it
trusts a self-signed certificate so that on-prem dev servers connect without a CA.
A containerised SQL Server presents the certificate the engine generated at first
start, and validating that one fails. Measured on 2026-08-25 against
`mcr.microsoft.com/mssql/server:2022-latest`:
`{ encrypt: true, trustServerCertificate: true }` connected and reported
`sys.dm_exec_connections.encrypt_option = TRUE`, while
`{ encrypt: true, trustServerCertificate: false }` was refused with "Failed to
connect to 127.0.0.1:1433 - self signed certificate".

Out of the box, against a non-Azure host with no explicit `ssl` setting, the
connection is encrypted but not authenticated. It is protected against a passive reader on the
wire and not against a machine in the middle of it. If that server has a
certificate you trust, set the SSL mode to `verify-system` and the default stops
applying.

The paste box carries the same fact. An ADO.NET string with `Encrypt=True` and no
`TrustServerCertificate` keyword maps to `verify-full`, faithful to
`Microsoft.Data.SqlClient` 4.0 and later - which means a string that used to
connect to a self-signed on-prem server can now be refused. Paste
`TrustServerCertificate=True` beside it, or set the mode to `require` on the form
after pasting.

## The restricted DMVs, and what Azure SQL Database monitoring loses

Monitoring on this provider is DMV monitoring. `getMonitoringData()` fans out
reads over `sys.dm_exec_sessions`, `sys.dm_os_performance_counters`,
`sys.dm_exec_query_stats` joined to `sys.dm_exec_sql_text`, `sys.dm_exec_requests`,
`sys.dm_db_index_usage_stats`, and `sys.database_files`. Every one of those
sub-queries is independently privilege-guarded, because every one of them can be
refused on its own.

Server-scoped DMVs need `VIEW SERVER STATE` (`VIEW SERVER PERFORMANCE STATE` on
SQL Server 2022 and later, which `VIEW SERVER STATE` implies). Microsoft's
reference for `sys.dm_exec_sessions` states the managed case separately: on Azure
SQL Database the view requires `VIEW DATABASE STATE`, which cannot be granted in
`master`. That is the mechanism behind the empty panel. It is a permission model,
not an outage, and it is the same shape a least-privilege login gets on a machine
you own.

Maintenance narrows in the same direction. The toolkit here is `analyze` /
`check` / `optimize` / `kill`, labelled Update Statistics, Check Database, Rebuild
Indexes and Kill Session. Check Database issues `DBCC CHECKDB WITH NO_INFOMSGS`,
which takes no object, so it is offered as a whole-database card and never as a
per-table control - `POST /api/db/maintenance` answers 400 to
`{type:"check", target:"Orders"}` rather than quietly checking the database while
naming one table. The whole toolkit, and the audit trail, are admin-only.

On the managed service some server-scoped dynamic management views and the
database check operation behave differently or are restricted, so parts of
monitoring and maintenance degrade to N/A or empty. The other managed variants have not been
reachable and are untested.

What survives is worth naming too, because it is not nothing. Where the grants
exist, blocked-session detection is real here (`blocking_session_id > 0` from
`sys.dm_exec_sessions` joined to `sys.dm_exec_requests`) and index scan counts are
real usage data from `sys.dm_db_index_usage_stats`, seeks plus scans plus lookups.
Both readings sit under the limit the [feature list](/features) already states,
that what each panel can show is bounded by what the engine reports. On this engine
that reads as the widest DMV surface of any engine in Studio, and a dashboard a
single permission can still empty.

## How the panels report that restriction

The rule this codebase applies is that an absence must not be published as a
measurement. A refused read is never rounded down to zero.

| Reading | On a refusal | On a genuine zero |
| --- | --- | --- |
| Cache-hit ratio | `getHealth().cacheHitRatio` is `"N/A"`, `getPerformanceMetrics()` omits it, the tab renders "Not measured" | kept, shown as `0.0%` |
| Health connection count | the key is absent from the object and from the `POST /api/db/health` body | reported as `0` |
| Monitoring Connections card | `N/A` over "not published", and the sample is dropped from the trend chart | drawn as a point |
| Slow queries, sessions, table and index stats | `[]` | `[]` with the real answer, which reads the same |

The Connections card is the one that earned this design. The count was once
initialised to `0` and the guard left that `0` standing, so a busy server reported
itself idle on the strength of a permission error, and every refresh added a real
zero point to the sparkline. The cache-hit ratio had the matching bug in the other
direction: an unreadable ratio was published as `0%`, and the Overview card rates
a low ratio "Needs tuning", so a least-privilege login saw a cache fault SQL
Server had never reported.

`getPerformanceMetrics()` reports only the buffer-cache hit ratio - no
queries-per-second, no deadlocks, no buffer-pool usage - and omits even that when
`sys.dm_os_performance_counters` cannot be read. The Queries panel's empty state
names the cause: query stats come from `sys.dm_exec_query_stats`, which needs the
`VIEW SERVER STATE` permission. The grant is the part a DBA can act on, which is
why the panel names it.

## Managed variants that have not been reached at all

Azure SQL Database is the only managed offering this code recognises by name, and
recognising a host suffix is not the same as having measured the service. The
restriction above is Microsoft's documented requirement for those views, read
against what this provider does with a refused read; the live figures in this post
were measured on SQL Server 2022 CU26 and on the `2022-latest` container image, not
on a managed instance. Azure SQL Managed Instance, Microsoft Fabric and Azure
Synapse sit on the provider README's list of managed services no instance was
reachable for, tracked in libredb-studio issue #424. They have no row, no tier and
no capability claim.

Nothing above is stated about them. Which branch of the certificate check a host
takes is decided by its name and nothing else, and what any of those three do with
server-scoped DMVs, with `DBCC CHECKDB`, or with a certificate has not been
measured here.

Untested is not unsupported, and it is not supported either. It is the third state,
and it is the one this post publishes.
