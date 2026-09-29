---
title: Twelve database projects now list LibreDB Studio in their docs
status: published
author:
  name: LibreDB
  picture: ''
slug: twelve-database-projects-list-libredb-studio
description: 'PostgreSQL, Redis, ClickHouse, MariaDB, DuckDB, Trino, YugabyteDB, StarRocks, DragonflyDB, OpenSearch, Apache Cloudberry and Aiven now list LibreDB Studio in their official documentation. Every entry went through the project''s own review.'
coverImage: ''
tags:
  - value: news
    label: News
publishedAt: 2026-09-30T00:00:00.000Z
---

Twelve database projects now list LibreDB Studio in their official
documentation or ecosystem pages:

- [PostgreSQL](https://www.postgresql.org/download/products/1#:~:text=LibreDB%20Studio)
- [Redis](https://redis.io/docs/latest/develop/tools/#libredb-studio)
- [ClickHouse](https://clickhouse.com/docs/integrations/connectors/tools/gui#libredb-studio)
- [MariaDB](https://mariadb.com/docs/server/clients-and-utilities/graphical-and-enhanced-clients/libredb-studio)
- [DuckDB](https://duckdb.org/docs/preview/guides/sql_editors/libredb_studio)
- [Trino](https://trino.io/ecosystem/client-application#libredb-studio)
- [YugabyteDB](https://docs.yugabyte.com/stable/integrations/tools/libredb-studio/)
- [StarRocks](https://docs.starrocks.io/docs/integrations/IDE_integrations/LibreDB_Studio/)
- [DragonflyDB](https://www.dragonflydb.io/docs/integrations/libredb-studio)
- [OpenSearch](https://opensearch.org/community-projects/#:~:text=LibreDB%20Studio)
- [Apache Cloudberry (Incubating)](https://cloudberry.apache.org/docs/ecosystem/sql-clients/libredb-studio/)
- [Aiven](https://aiven.io/docs/products/postgresql/howto/connect-libredb-studio)

## Why a docs page matters to us

A documentation page is where someone goes after they have already picked a
database and are asking what to use with it. Being there means the project's
maintainers looked at the tool and agreed it works with their engine.

## What LibreDB Studio is

A database editor you deploy next to your database, as a container, a Helm
chart or a Kubernetes operator, and open in the browser. No port opened to the
internet, no SSH tunnel, no desktop client on every laptop.

It ships eighteen drivers. Twenty-eight more engines speak one of those wire
protocols and connect through an existing driver. Each of the twenty-eight was
tested against a live instance, and the
[compatibility table](https://github.com/libredb/libredb-studio/blob/main/docs/providers/README.md)
says how much works on each: eighteen fully, nine partially, one in the query
editor only.

Everything is MIT licensed, including SSO, role-based access and the AI
assistant. There is no paid edition.

    docker run -d -p 3000:3000 ghcr.io/libredb/libredb-studio:latest

Source: [github.com/libredb/libredb-studio](https://github.com/libredb/libredb-studio)
· Demo: [app.libredb.org](https://app.libredb.org)
