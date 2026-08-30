---
title: Two Oracle types that lose information on the way to a grid
status: published
author:
  name: LibreDB
  picture: ''
slug: oracle-number-and-timestamp-fidelity
description: A wide NUMBER arrives as a double and drops digits, and a timestamp with a zone folds its offset into UTC, so both are recorded rather than smoothed over.
coverImage: ''
tags:
  - value: engineering
    label: Engineering
  - value: databases
    label: Databases
publishedAt: 2026-04-28T09:00:00.000Z
---

Select a `NUMBER(38,0)` holding `12345678901234567890123456789012345678` and the
grid shows `1.2345678901234568e+37`. Nothing failed. No warning was raised. The
value left the server with thirty-eight digits and reached the grid carrying
seventeen. A second type is reduced the same way, and the server-side reading
that recovers both is at the end.

Both measurements below were taken on 2026-08-24 through the provider itself,
against Oracle AI Database 26ai Free with `oracledb` 6.10.0 in Thin mode, over a
probe table holding one populated row and one all-`NULL` row.

## How a value crosses from the driver into the grid

There is one path, and it is short. `query()` checks a connection out of the
`oracledb` pool and runs
`conn.execute(sql, binds, { outFormat: OUT_FORMAT_OBJECT, autoCommit: true, fetchTypeHandler })`.
Whatever JavaScript values come back are handed to `POST /api/db/query`, which
answers with `NextResponse.json`. So the wire format is `JSON.stringify` of the
driver's own row objects.

That single sentence decides everything else. The results grid, the row detail
sheet, the CSV export and the SQL export are all downstream of the same JSON. A
type that cannot survive `JSON.stringify` cannot survive any of them, and a type
that survives it in a lossy shape is lossy in all four places at once. Agent auto
mode is not on that list, because it does not run on Oracle at all: an auto run
here ends engine-unsupported. Plan mode opens, is toolless and executes nothing.

The driver's declared type name travels alongside, separately.
`result.metaData[].dbTypeName` is passed through into `QueryResult.columnTypes`
verbatim, keyed by column name. The Oracle driver hands over a type name rather
than a wire code, and the name is uppercase - the same spelling
`ALL_TAB_COLUMNS.DATA_TYPE` uses. Precision and scale sit beside the
name and are deliberately not folded into it: a computed `COUNT(*)` reports
precision 0, and `1/3` reports scale -127, so a `NUMBER(p,s)` reconstructed from
those would claim something Oracle never said.

## The digits go, and nothing says so

`NUMBER` arrives as a JavaScript `number`, which is a double. Two measured rows:

| Declared | Stored | Reaches the grid as |
| --- | --- | --- |
| `NUMBER(38,0)` | `12345678901234567890123456789012345678` | `1.2345678901234568e+37` |
| `NUMBER(20,4)` | `1234567890123456.7891` | `1234567890123456.8` |

The loss is silent: no error, no flag on the cell, no difference in appearance
between a value that survived and a value that did not. A `NUMBER(10,2)` invoice
total crosses with its digits intact. A `NUMBER(38,0)` identifier does not, and
the two sit in the same grid looking equally trustworthy.

There is a known fix and it is not applied. Fetching `NUMBER` as a string keeps
every digit - the same move that keeps a Cassandra `bigint` intact one provider
over. It is not in the product because it changes **every numeric cell Oracle
produces**: the ones the grid right-aligns, the ones the CSV writes, the ones the
SQL export puts inside an `INSERT`. A change of that blast radius is tracked on
its own rather than smuggled in beside an unrelated repair, and until it lands
the boundary is published instead of papered over.

## The stored offset that does not survive

The second type is `TIMESTAMP WITH TIME ZONE`, and here the answer is not
"tracked separately" but "not recoverable at this layer at all".

The driver hands over a JavaScript `Date`. A `Date` holds a UTC instant. It holds
no zone and no sub-millisecond digits. By the time any provider code sees the
value, the reduction has already happened:

| Stored | Arrives as |
| --- | --- |
| `2026-08-24 10:11:12.345678 +03:00` | `"2026-08-24T07:11:12.345Z"` |
| `2026-08-24 10:11:12.345678 -07:00` | `"2026-08-24T17:11:12.345Z"` |
| `2026-08-24 10:11:12.345678 ASIA/TOKYO` | `"2026-08-24T01:11:12.345Z"` |

The instant is right in all three. The offset is gone in all three, and `.345678`
has become `.345`.

The obvious repair was measured and is worse. Asking for the column as a string
through a `fetchTypeHandler` is accepted, but what comes back is that same `Date`
put through `toString()` in the **Node process's** time zone. Read from a process
running at `+03:00`, all three rows above report `GMT+0300` - the reader's zone,
not the stored one - and the milliseconds are gone as well. That trades a correct
instant for a wrong-looking local rendering, so it was rejected. The process-wide
`oracledb.fetchAsString` refuses the identity outright with `NJS-021`, and the
driver exposes no offset beside the `Date`.

So the limit, stated plainly: **a wide NUMBER arrives as a JavaScript double and
loses digits silently, and a timestamp with a time zone arrives as a date with
its offset folded into UTC and sub-millisecond digits dropped.** A
`TIMESTAMP WITH LOCAL TIME ZONE` has no stored offset to lose, so for that type
only the sub-millisecond truncation applies. A plain `TIMESTAMP(6)` loses the
sub-millisecond digits too.

Not every awkward type ends this way. The two `INTERVAL` types used to reach the
wire as JSON objects - `{"months":7,"years":3}` - which the grid showed as a blob
and the SQL export wrote into an `INTERVAL` column, where Oracle refused it with
`ORA-01867`. Those are now normalized at the driver boundary into Oracle's own
signed literals, `+03-07` and `+05 06:07:08.9`, which Oracle accepts as plain
quoted strings in the position the export writes them. The difference: an
interval's information was all still there and only needed spelling correctly. A
folded offset is not there at all.

## Large objects, and the handler that makes them readable

The `fetchTypeHandler` in that `execute` call exists because of a third type, and
it shows what the failure mode looks like when a type does **not** degrade
quietly.

Without the handler, `oracledb` answers a LOB with a `Lob` stream object. Streams
are cyclic, so `JSON.stringify` throws - `Converting circular structure to JSON`
on Node, `cannot serialize cyclic structures` on Bun - and because the API route
serializes the whole response, **the entire SELECT failed**. No grid, no CSV, no
export. The in-process path did worse: the cell classified as JSON and the SQL
export wrote the stream's internals into an `INSERT`.

The handler maps `CLOB` and `NCLOB` to `oracledb.STRING` and `BLOB` to
`oracledb.BUFFER`, and leaves every other column on the driver's default. It is
attached per call rather than through the process-wide `oracledb.fetchAsString`
globals, which would also rewrite every schema and monitoring read.

A LOB is fetched whole, with no length cap. A cap was considered and rejected: a
truncated `CLOB` looks exactly like a complete one in the grid, and the SQL
export would write the truncation into the target as though it were the value.
The cost is measured - a 16,384,000-character `CLOB` fetched as a string took
66 ms and serialized to 16.4 MB of JSON in 18 ms - and the ceiling is the
runtime's own and fails loudly with `RangeError: Invalid string length`. A failed
query is a better outcome than a value that quietly lost its tail, which is the
standard the `NUMBER` path does not yet meet.

## Reading around both, on the server side

Oracle still has everything the client dropped. Ask for it in the same result
set, in the [editor](/features) you were already in:

```sql
SELECT
  TO_CHAR(big_id)                                 AS big_id_text,
  TO_CHAR(amount)                                 AS amount_text,
  TO_CHAR(ttz, 'YYYY-MM-DD HH24:MI:SS.FF6 TZR')   AS ttz_text
FROM ledger
WHERE id = :1
```

`TO_CHAR` over a `NUMBER` produces the digits as characters, and a `VARCHAR2`
crosses the driver boundary unchanged, so the wide identifier arrives intact. The
same call on the timestamp recovers both things the `Date` could not hold - the
stored region or offset through `TZR`, and the microseconds through `FF6`:

```
2026-08-24 10:11:12.345678 -07:00
```

Project the text column **beside** the native one rather than instead of it, so
the grid keeps a sortable value and you keep an exact one. When a wide `NUMBER`
is a key you intend to paste into another statement, take it from the `TO_CHAR`
column: the numeric cell may already be a different number.

The two boundaries do not have the same future. The `NUMBER` one is a fetch
change waiting to be made across every numeric cell at once, and measured the way
the LOB and interval changes were. The stored offset is not recoverable at this
layer at all: the driver reduces the value before provider code sees it, so
`TO_CHAR` is the answer rather than a stopgap. Both are listed on the
[engine pages](/databases) as what Oracle cannot answer here.
