---
title: Hiding an edit control that could only ever fail
status: published
author:
  name: LibreDB
  picture: ''
slug: clickhouse-row-editing-alter-update
description: A bare update statement answers not implemented on this engine, so no editable cell is offered, and the documented route reports zero rows changed.
coverImage: ''
tags:
  - value: engineering
    label: Engineering
  - value: databases
    label: Databases
publishedAt: 2026-06-25T09:00:00.000Z
---

Open a ClickHouse table in the results grid and there is no EDIT toggle. Double-click
a cell and nothing happens. That is not a rendering bug and not a permission problem:
a ClickHouse update row, written the way the shared grid writes it, is a statement
this server refuses to run. The control is absent because the edit behind it could
only ever fail.

There is a second behaviour underneath it that looks equally broken and also is not.
The statement you are told to type instead succeeds, changes the row, and reports
that it wrote nothing.

Both were found the same way, against the pinned build the provider is verified on,
`clickhouse/clickhouse-server:26.7.1.1315`.

## What the shared grid editor emits

The results grid is one component for every engine. When a cell is committed it
builds the same shape it has always built: a bare update naming the table, the
changed column, and a `WHERE` clause identifying the row.

```sql
UPDATE events SET status = 'closed' WHERE id = 41;
```

On PostgreSQL that runs. On ClickHouse it does not, and it does not fail quietly at
the edge of the driver either, because there is no driver. The ClickHouse provider
carries no dependency at all: every statement is the body of a `POST /` on the
documented HTTP interface, default port `8123`, answered through the runtime's own
`fetch`. There is no connection pool and no session, so each statement is one
stateless request. The grid's update goes to the server verbatim and the server
answers.

## Why a ClickHouse update row cannot work that way

The answer is an HTTP `501` carrying exception code `48`, `NOT_IMPLEMENTED`. The
provider classifies it by that number rather than by the status line, which matters
more here than it sounds: on this interface a permission denial arrives as HTTP
`500`, not `403`, so any logic keyed on status codes would misread half the error
surface. The numeric code is the reliable signal, and `48` is unambiguous.

The server's own message names the exact precondition it wants, and it is more
useful than any wording the provider could substitute for it, so it is surfaced
verbatim:

```text
Lightweight updates are supported only for tables with materialized
_block_number column
```

A second, quieter failure sat behind the same control. The grid's hook joined
several pending row edits into one request. ClickHouse refuses that on its own:
multi-statement input is rejected by the server, code `62`,
`Multi-statements are not allowed`. This is why the provider does no client-side
statement splitting anywhere. One request, one statement, or nothing.

## Hiding a control instead of failing it

There were two ways to handle this and only one of them is defensible.

The easy way is to leave the toggle where it is and let the server's error land in
the user's face. It demos identically and costs nothing to build. What it costs is
paid later, by the person who edited a cell, waited, and now has a `NOT_IMPLEMENTED`
in a toast without knowing whether the problem is the engine, the row, or the
cluster.

So the provider declares `supportsInlineRowEdit: false`, and the interface renders
from that declaration. Neither the EDIT toggle nor an editable cell appears on a
ClickHouse connection. The [capability declarations behind each feature](/features)
are data rather than layout, which is why a missing control here is a stated
absence rather than a gap.

The same rule removed the Create Table modal on this engine, for a reason worth
reading as a sanity check on the first one. `CREATE TABLE t (id Int32, name String)`
is perfectly valid ClickHouse. But the shared modal's default column emits
`id SERIAL PRIMARY KEY` - code `50`, unknown data type family - and its UNIQUE
checkbox emits `UNIQUE`, code `62`, a syntax error. A flag that is true but produces
a control that can only emit invalid input is a defect, not a feature. DDL typed
directly into the editor works normally.

## The statement to type instead

ClickHouse's documented route for changing existing data is a mutation, and it is
spelled as an ALTER:

```sql
ALTER TABLE events UPDATE status = 'closed' WHERE id = 41;
```

Type it in the editor and it runs. The equivalent for removing rows is the
lightweight form:

```sql
DELETE FROM events WHERE id = 41;
```

Both are ordinary statements to this provider - one `POST`, one body, no rewriting.
The editor sends exactly what you type. Two things about the editor's own behaviour
are worth knowing while you are here: parameters bind only in ClickHouse's named
`{name:Type}` form, because that is what the HTTP interface accepts, and a statement
ending in a trailing `FORMAT` or `SETTINGS` clause is sent unchanged rather than
being fitted with a row limit, since `SELECT * FROM probe FORMAT TSV LIMIT 1` is a
hard syntax error.

## Why it reports zero rows changed

Run the ALTER above and the results panel says zero rows changed. Re-read the row
and the new value is there.

That number is not the provider's. A successful `INSERT`, `ALTER TABLE ... UPDATE`
or lightweight `DELETE FROM` answers `200` with no body at all on this interface;
the counts live in a response header, `X-ClickHouse-Summary`, whose values are all
strings:

```text
X-ClickHouse-Summary: {"read_rows":"2","written_rows":"2","result_rows":"2", ...}
```

For an `INSERT`, `written_rows` is the real figure. For `ALTER TABLE ... UPDATE` and
for a lightweight `DELETE FROM`, it is `0` even though the mutation genuinely
applied - live-verified, with the change confirmed by reading the row back. Both
statement types are queued as background mutations rather than applied
synchronously, and ClickHouse counts no rows written for either.

The provider reports that number verbatim. It does not derive a plausible-looking
count from the predicate, and it does not suppress the zero to avoid the question.
A fabricated two is worse than an honest zero, because the zero is falsifiable and
the two is not.

The [ClickHouse engine page](/databases) carries the transport and default port for
this connection. The boundary behind both halves of this post is stated here:
**inline row editing is not offered on ClickHouse, because a bare update answers
code `48` `NOT_IMPLEMENTED`, and the documented alternative reports zero rows
changed even when the mutation applied - which is the server's own figure, reported
verbatim.**
