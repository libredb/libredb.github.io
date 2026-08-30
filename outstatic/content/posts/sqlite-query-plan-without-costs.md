---
title: A SQLite plan tree with no numbers on it
status: published
author:
  name: LibreDB
  picture: ''
slug: sqlite-query-plan-without-costs
description: The query plan returns step descriptions and nothing else, so the rendering shows structure and answers index questions rather than cost questions.
coverImage: ''
tags:
  - value: engineering
    label: Engineering
  - value: databases
    label: Databases
publishedAt: 2026-06-20T09:00:00.000Z
---

A query that was fast on a laptop is slow on the box holding the real file, and the
first instinct is to ask the engine what it costs. Run SQLite EXPLAIN QUERY PLAN and
what comes back is a short list of sentences. No cost. No estimated rows. No
milliseconds. Nothing is being hidden by the tool: the number was never in the
engine's response.

## What the plan statement returns here

The SQLite provider declares `supportsExplain: true` with
`explainFormat: "sqlite-queryplan"`, so the EXPLAIN control is live on every SQLite
connection and the plan comes from the engine itself. The engine answers with rows
describing steps: which table each step touches, whether it reaches that table
through an index or reads it end to end, and how the steps nest.

The limit, stated before you go looking for it: the query plan returns step
descriptions only. This engine reports no per-node cost, row estimate or timing, so
no metrics are shown beside the tree. There is no setting that turns them on,
because there is nothing to turn on. A plan panel that showed a cost here would be
showing a number this provider made up.

That rule was learned elsewhere in this provider. Through 0.13.1 the monitoring code
reported a cache-hit ratio of 95 whenever `PRAGMA cache_size` came back truthy,
which it always does, and the performance panel rated the invented figure
"Excellent". SQLite's page-cache counters live behind `sqlite3_db_status()` in the C
API, which neither driver the provider can load exposes, so the field is now omitted
permanently. A missing panel is honest. A populated wrong one is not.

## Rendering steps as a tree

The rows come back flat. Each carries an `id`, the `parent` id of the step it sits
under, and a `detail` string; the nesting has to be rebuilt from those two numbers.
Drawn as a list the details read as an undifferentiated sequence; drawn as a tree
they read as the shape of the query. That nesting is most of the information content
here, so it is what the rendering spends its space on.

A three-table join against the bundled Sample (Employees) database renders as this:

```sql
EXPLAIN QUERY PLAN
SELECT e.first_name, d.dept_name
FROM employee e
JOIN dept_emp de ON de.emp_no = e.emp_no
JOIN department d ON d.dept_no = de.dept_no
WHERE e.hire_date > '2000-01-01';
```

```text
SCAN de USING COVERING INDEX sqlite_autoindex_dept_emp_1
SEARCH e USING INTEGER PRIMARY KEY (rowid=?)
SEARCH d USING INDEX sqlite_autoindex_department_1 (dept_no=?)
```

Three lines, and every question you can answer from them is a structural one.
`dept_emp` is the driver of the join, not `employee` as the query text suggests, and
it is read through the index SQLite built for its composite primary key - from that
index alone, since both columns the join needs are in it. The other two tables are
reached one row at a time: `employee` by rowid, `department` through the index
behind its unique `dept_no`.

Read what is absent as well. The `hire_date` predicate appears nowhere in those
three lines: it is a search term against no index, so it is applied to rows after
they are fetched, and the plan does not mention it at all.

A sort no existing order could satisfy does get its own step:

```text
SCAN e
USE TEMP B-TREE FOR ORDER BY
```

That second line is one of the more useful things the plan says: it names work the
query text does not.

What you cannot answer is which of these lines took the most wall clock. The plan
does not rank its steps, and the tree does not invent a ranking by drawing one node
larger than another.

## Search and scan, and what each says about an index

| Step begins | What the engine is doing | What it says about your index |
| --- | --- | --- |
| `SCAN t` | Visiting every row of `t` | No index was usable here, or the planner chose not to use one |
| `SEARCH t USING INDEX ix (col=?)` | Seeking into `ix`, then to the row | `ix` is in use, and the parenthesised term names the columns the seek reached |
| `SCAN t USING COVERING INDEX ix` | Reading the index, never the table | `ix` carries every column this step needs, so no row is fetched |
| `SEARCH t USING INTEGER PRIMARY KEY (rowid=?)` | Looking the row up by rowid | Straight to the row; no separate index involved |

A name beginning `sqlite_autoindex_` is the plan pointing at an index you never
declared, created for a `PRIMARY KEY` or `UNIQUE` constraint. Both named indexes
above are of that kind, and neither appears in the schema explorer's index list,
which skips `sqlite_*` auto-indexes.

A `SCAN` is not automatically a defect: scanning a hundred-row lookup table is
correct, and adding an index to it is churn. A `SCAN` on the large table on the
inner side of a join usually is one, and the plan is where you see it happening at
all.

The parenthesised term is the part people skip. It names which columns of the index
the seek actually reached, and on a composite index the leading column decides. An
index on `(dept_no, hire_date)` queried only by `hire_date` shows up as a plain
`SCAN` on a database that has never been analyzed; after `ANALYZE` the same query
can use that index with the leading column enumerated rather than seeked, which the
plan writes as `(ANY(dept_no) AND hire_date>? AND hire_date<?)`. Either way the plan
is where you find out that the definition and the predicate disagree.

## Why there is no cost, cardinality or timing

A cost model needs statistics, and SQLite's are minimal by design. `sqlite_stat1`
exists only after an explicit `ANALYZE`, carries no null fraction, and writes no row
at all for a table with no index, so a row estimate is there for indexed tables and
not otherwise - as true for agent mode's grounding read, which reads those rows
directly, as for the planner. The planner uses what it has and reports its decision
rather than its arithmetic.

Timing is a separate absence with the same shape. SQLite keeps no statistics about
finished statements: `getSlowQueries()` returns an empty list unconditionally, and
the monitoring panel's empty state says so in those words rather than repeating
PostgreSQL's advice about enabling an extension that does not exist here. Per-index
usage counts are the same story - index `scans` is always `0`, because there is no
usage counter to read.

This is what the engine grid means when the SQLite row on
[the databases page](/databases) says there is no server to monitor. The absences
all come from one fact: an embedded engine with a single file and no server process
keeps no runtime accounting for anyone to query.

## Questions to take somewhere else

The plan answers structure. For the rest, go to a surface that measures something:

- **"Which of these steps is slow?"** Not from the plan, and not from the engine's
  own statistics either. Measure it outside: run the original and the rewrite
  against the same file and compare what you observe.
- **"Is this index worth keeping?"** The schema explorer reads
  `PRAGMA index_list` and `PRAGMA index_info` and shows the definition. Usage counts
  are not available here, so the decision is made from plans and definitions, not
  from a hit counter.
- **"What should I change?"** Agent mode's auto run works on SQLite, one of the
  three engines it runs on at all, with PostgreSQL and DuckDB. It reads through a
  read-only profile: a
  second, physically separate handle to the same file, with `PRAGMA query_only` set
  and verified again before every statement. It takes the catalog out of
  `sqlite_master` rather than the pragma table-valued functions the statement guard
  refuses, and composes a report whose every claim cites the result it came from.
  The statements it drafts for you, it does not run - the handle it holds refuses
  writes. The rest is on [the features page](/features).
- **"Have the statistics gone stale?"** Run `ANALYZE`. It is in the maintenance
  toolkit, which is admin-only, and on SQLite it is offered per table as well as for
  the whole database. It will not add numbers to the plan tree. It will change which
  index the planner picks, which the plan tree does show.
