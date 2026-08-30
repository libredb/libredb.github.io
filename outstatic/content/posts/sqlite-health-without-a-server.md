---
title: There is no SQLite server to monitor
status: published
author:
  name: LibreDB
  picture: ''
slug: sqlite-health-without-a-server
description: Health is an integrity check, a journal mode and file sizes, and one per-table figure depends on which built-in driver the deployment is running.
coverImage: ''
tags:
  - value: engineering
    label: Engineering
  - value: databases
    label: Databases
publishedAt: 2026-01-29T09:00:00.000Z
---

A SQLite database is a file. It has no listener, no process of its own, no
session table and no statistics collector, so a SQLite database health check
cannot be the thing that word usually means. There is no `pg_stat_database` to
read, because there is no database server holding one. What exists is the file,
the pragmas the engine will answer, and whatever the operating system says about
bytes on disk.

That is a smaller set of readings than a monitoring dashboard has room for. The
question is what to put in the space that is left.

## What health can mean for a file

Studio connects to SQLite through the runtime's built-in driver: `bun:sqlite`
under Bun, `node:sqlite` (`DatabaseSync`) under Node, selected at connect time by
the `sqlite-driver` adapter. Not `better-sqlite3` - Bun refuses to load it, and a
native binding compiled against one runtime's ABI fails under the other. The
connection is a server-local file path, and the connection form collapses to a
single **Database File Path** input: no host, no port, no user, no password.
`getCapabilities()` reports `defaultPort: null` for the same reason.

Everything a server-backed dashboard reads follows from a running process that
counts while it works. SQLite counts almost nothing, so the monitoring tab here
answers four questions instead:

- Is the file internally consistent?
- Which journal mode is it in?
- How large are the database, the `-wal` and the `-shm` files?
- How many objects and rows does the schema hold?

Those are the readings that exist.

## Integrity, journal mode and file statistics

`getHealth()` runs `PRAGMA integrity_check` and `PRAGMA journal_mode` and
reports both as information rows, alongside `activeConnections: 1`.
`getOverview()` adds `sqlite_version()`, the file size and `sqlite_master`
counts, with `uptime` as `N/A` and `maxConnections: 1` - a single embedded
handle has no pool, and `getPoolStats` does not exist here.

Journal mode is worth reading rather than assuming. On connect the provider
opens the file `{ create: true, readwrite: true }` and sets
`PRAGMA foreign_keys = ON`, `journal_mode = WAL` and `synchronous = NORMAL`, so
a database Studio has opened normally will report WAL. A file another process
left in `delete` or `truncate` mode is a fact about that process, and the panel
shows it.

`getStorageStats()` reads `fs.statSync` on three paths - the database, its
`-wal` and its `-shm` - so the WAL growing while the main file stays flat is
visible without inference. Whole-database size in the schema browser comes from
`pragma_page_count * pragma_page_size`; row counts are `SELECT COUNT(*)` per
table, which is the only count SQLite offers.

The maintenance side matches: `vacuum`, `analyze`, `reindex` and `check` are the
declared operations, `check` being `PRAGMA integrity_check` again. `VACUUM`
rewrites the entire file, so it is declared `perEntity: false` with the label
*Vacuum Database* and `POST /api/db/maintenance` answers 400 for
`{type:"vacuum", target:"users"}`. The toolkit is admin-only.

## The counters that live behind an API no driver exposes

Here is the flat version. **There is no cache-hit ratio, no queries-per-second,
no buffer-pool usage, no slow queries and no per-index size on SQLite.** Only
`deadlocks: 0` is reported, which is a fact about the engine rather than a
measurement of this database.

The cache counters are not missing for want of a better query. SQLite's page
cache hit and miss figures live behind the C API - `sqlite3_db_status()` with
`SQLITE_DBSTATUS_CACHE_HIT` and `SQLITE_DBSTATUS_CACHE_MISS` - and neither
driver exposes a status call at all. Walking a live handle's prototype chain on
2026-08-23 gave the surface of each:

| Driver | Status call reachable? |
| --- | --- |
| `bun:sqlite` (Bun 1.3.14, SQLite 3.53.0) | none |
| `node:sqlite` (Node 24.14.0, SQLite 3.51.2) | none |

Nothing SQL-reachable stands in either, and the near misses are worse than
nothing:

```sql
PRAGMA cache_size;  -- -2000: the configured page budget in KiB, not a hit count
PRAGMA cache_hit;   -- [] : not a pragma at all
PRAGMA cache_miss;  -- [] : same
PRAGMA stats;       -- []
```

SQLite answers an unknown pragma with zero rows rather than an error, so
`PRAGMA cache_hit` returns something that looks exactly like an empty reading
from a real counter. That is the trap. The field is omitted permanently, not
pending a better query, and `getHealth()` says so in its own string field:
`cacheHitRatio` is `N/A`.

Slow queries are the same shape of absence. `getSlowQueries()` returns `[]`
unconditionally, and the empty state is overridden away from PostgreSQL's
`pg_stat_statements` advice to the sentence that is actually true here: SQLite
keeps no statistics about finished statements, so there is nothing to enable.
Index `scans` is always `0` for the same reason - there is no usage counter to
read.

## Per-table size, and the driver it depends on

SQLite has no catalog column for a table's size. The only source is `dbstat`, a
virtual table reporting one row per b-tree page group, and it sits behind the
compile-time `SQLITE_ENABLE_DBSTAT_VTAB` option that the two built-in drivers do
not agree on. Measured 2026-08-24 against the same seeded database - 200 rows of
4 KB text in `big` with an index on it, 200 short rows in `small`, file
1,761,280 B:

| Driver | `SELECT name, SUM(pgsize) FROM dbstat GROUP BY name` |
| --- | --- |
| `bun:sqlite` | `no such table: dbstat` |
| `node:sqlite` | `big 823296`, `idx_big 929792`, `small 4096` |

So the same connection reports different per-table sizes depending on which
driver is under it, and `LIBREDB_SQLITE_DRIVER=bun|node` is what moves between
them. **Any size claim has to name the driver it was measured with.**

In practice the packaged deployments are on the measuring side. Every
distribution channel - the Docker image, `npx @libredb/studio`, the Homebrew
tap, the `.deb` and `.rpm` packages and the standalone tarballs - runs the built
app with `node server.js`, so they all use `node:sqlite` and all have `dbstat`.
`bun:sqlite` is what local development (`bun dev`) and the test suite run on;
under it the byte fields are omitted rather than estimated, and the Storage tab
shows `N/A` for the Tables and Indexes cards.

Per-index size is absent under both. `indexSize` is `N/A` and `indexSizeBytes`
is omitted, because SQLite publishes no per-index figure - under `node:sqlite`
an index's pages are added to its table's index bytes instead, implicit
`sqlite_autoindex_*` ones included, which is what the Storage tab's index total
is built from.

## Why a missing panel beats a populated wrong one

Both of those absences were once numbers.

Through 0.13.1 this provider reported a cache-hit ratio of `95` whenever
`PRAGMA cache_size` came back truthy - which it always does - and `99`
otherwise. The Performance panel then rated that figure *Excellent*. Nobody had
measured anything. The number was the provider's, not SQLite's, and it read as
an engine reading because it was sitting in a panel labelled like one.

Through 0.13.3 per-table size was `rowCount * 100`, documented in the code as
"assume 100 bytes average per row", and the Storage tab summed it into the Data
figure it drew beside the measured file size. On the database in the table
above, that estimate answered 20,000 B for both tables: 40 times under for
`big`, whose pages are 804 KB, and 5 times over for `small`, which is 4 KB. A
guess presented as a measurement, added to a real one.

A `0` would have been the same fabrication in a different digit, which is why
the byte fields are absent rather than zero, and why every consumer gates on the
absent `tableSizeBytes` instead of reading a placeholder.

The rule that came out of it governs the rest of this dashboard, and it is the
same rule every entry in the [feature list](/features) follows: a control that
cannot answer is absent, with the reason written where it would have been. An
empty panel is indistinguishable from a broken one, so the absence carries a
sentence. [The SQLite engine page](/databases) publishes that sentence before
anyone connects: there is no server to monitor, and health reads file size and
pragma statistics only.
