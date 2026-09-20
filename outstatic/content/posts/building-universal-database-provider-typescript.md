---
title: Building a Universal Database Provider Architecture in TypeScript Without JDBC
status: published
author:
  name: Cevheri & LibreDB Engineering
  picture: ""
slug: building-universal-database-provider-typescript
description: How to architect a unified DatabaseProvider interface that bridges 15+ heterogeneous database engines without JDBC, managing dynamic module loading, schema normalization, and AI agent isolation at scale.
coverImage: ""
tags:
  - value: engineering
    label: Engineering
  - value: databases
    label: Databases
  - value: architecture
    label: Architecture
publishedAt: 2026-09-13T09:00:00.000Z
---

## Introduction: The Missing SPI in Modern Runtimes

In mature enterprise ecosystems like Java or .NET, developer tools that interact with databases rely on standardized, runtime-level Service Provider Interfaces (SPIs):

* **Java:** `java.sql.Driver`, `java.sql.Connection`, `java.sql.Statement`, and `java.sql.ResultSet` (JDBC).
* **.NET:** `System.Data.Common.DbConnection`, `DbCommand`, and `DbDataReader` (ADO.NET).

In these environments, database vendors—whether Oracle, [PostgreSQL](/blog/engine/postgresql/), MySQL, or Microsoft [SQL Server](/blog/engine/sqlserver/)—author driver JARs or DLLs that conform strictly to these runtime interfaces. The GUI or client application calls standard APIs without needing to know low-level wire protocol nuances, connection pool nuances, or engine-specific error classes.

### The JavaScript / TypeScript Gap

Node.js, Bun, and Deno lack a native, language-wide database driver standard equivalent to JDBC.

Instead, the npm ecosystem contains a fragmented collection of independent community drivers:
* PostgreSQL uses `pg` (node-postgres).
* MySQL uses `mysql2`.
* SQLite relies on native bindings like `better-sqlite3`, `bun:sqlite`, or `node:sqlite`.
* Oracle DB relies on `oracledb`.
* NoSQL databases like Redis (`ioredis`), MongoDB (`mongodb`), and [Cassandra](/blog/engine/cassandra/) (`cassandra-driver`) use entirely different paradigms (document descriptors, key-value commands, binary buffers).

Building a universal, self-hosted database IDE or management platform in TypeScript requires solving this fundamental problem: **How do you build a single, type-safe, performant, and secure application that can interact with 15+ relational, document, key-value, OLAP, and embedded database engines without a unifying runtime SPI?**

This article explores how **LibreDB Studio** solved this challenge by engineering a unified `DatabaseProvider` architecture.

---

## The Problem Statement

When building a universal database client in TypeScript, five major architecture constraints arise:

1. **Heterogeneous Engine Paradigm:** Relational databases (`PostgreSQL`, `MySQL`), Document databases (`MongoDB`), Key-Value stores (`Redis`), OLAP engines (`ClickHouse`, `Trino`, `Druid`), and Embedded engines (`SQLite`, `@libredb/libredb`) have zero overlapping query languages or connection lifecycle models.
2. **Cold Start & Memory Bloat:** Statically importing driver dependencies for 15+ database engines on application startup would result in massive bundle sizes and unacceptable RSS memory footprints.
3. **Schema Introspection Normalization:** The UI requires a uniform object tree (Containers → Folders → Objects → Columns/Indexes). However, PostgreSQL uses `pg_catalog`, MySQL uses `information_schema`, SQLite uses `pragma_*` functions, Redis uses key prefixes, and embedded engines use custom catalog registries.
4. **AI Agent Safety & Guardrails:** With Text-to-SQL and AI database agents executing queries, the architecture must enforce database-native read-only boundaries (e.g., prohibiting destructive SQL or file system operations) at the connection layer.
5. **Concurrency & Resource Lifecycle:** Embedded engines (like SQLite or embedded LibreDB) enforce single-writer file locks (`.lock`). Attempting to open concurrent handles to the same file causes system crashes or connection locks.

---

## Architecture Overview: The `DatabaseProvider` SPI & Adapter Pattern

To bridge this gap, LibreDB Studio implements a strict **Adapter / Strategy Pattern** centered around an abstract contract: `BaseDatabaseProvider`.

### Core Design Rules

1. **Zero Raw Protocol Drivers:** The provider layer does *not* re-implement low-level TCP/socket wire protocols from scratch. Instead, it wraps mature, battle-tested npm driver packages.
2. **No Heavy ORM Dependency for Targets:** Target database queries (data browsing, schema inspection, explain plans) execute via raw SQL or native driver commands. ORMs (like Prisma or Drizzle) are avoided for target inspection to ensure zero abstraction overhead and maximum query control.
3. **Unified Execution Lifecycle:** Every provider implements a standardized contract covering connection pooling, query execution, unified schema introspection, health monitoring, and maintenance.

---

## Deep Dive: Resolving Core Engineering Challenges

### Challenge 1: Zero-Overhead Dynamic Module Loading

Importing `oracledb`, `cassandra-driver`, `mysql2`, `@duckdb/node-api`, and `pg` statically on startup would force the runtime to allocate tens of megabytes of native memory for drivers that may never be used.

**Solution:** Dynamic `import()` dynamic module resolution in the Provider Factory.

```typescript
// src/lib/db/factory.ts
export async function createDatabaseProvider(
  connection: DatabaseConnection,
  options: ProviderOptions = {},
  execution: ProviderExecutionContext = {}
): Promise<DatabaseProvider> {
  switch (connection.type) {
    case "postgres": {
      const { PostgresProvider } = await import("./providers/sql/postgres");
      return new PostgresProvider(connection, options, execution);
    }
    case "mysql": {
      const { MySQLProvider } = await import("./providers/sql/mysql");
      return new MySQLProvider(connection, options);
    }
    case "sqlite": {
      const { SQLiteProvider } = await import("./providers/sql/sqlite");
      return new SQLiteProvider(connection, options, execution);
    }
    case "libredb": {
      const { LibreDBProvider } = await import("./providers/embedded/libredb");
      return new LibreDBProvider(connection, options);
    }
    default:
      throw new DatabaseConfigError(`Unsupported database type: ${connection.type}`);
  }
}
```

**Benefit:** Native binaries and driver modules are only loaded into memory when a user actively opens a connection of that specific type.

---

### Challenge 2: Unifying Heterogeneous Engine Schemas ("Object Surface API")

Different database types present structural metadata in fundamentally different ways:
* **Relational (PostgreSQL / MySQL):** Multi-level hierarchies (`Database` → `Schema` → `Tables`/`Views`/`Functions`/`Triggers`).
* **File-Based (SQLite):** Single schema (`main`), introspection via PRAGMA functions (`pragma_table_xinfo`, `pragma_index_list`).
* **Key-Value (Redis):** Single keyspace, pseudo-tables derived from colon-separated key prefixes (e.g., `user:*`).
* **Embedded (LibreDB):** In-process key-value store with an embedded catalog registry (`relational`, `document`, `keyspace`).

To render a unified sidebar tree in the UI, LibreDB Studio enforces a standardized **Object Surface API** across all providers:

```typescript
export interface DatabaseProvider {
  listContainers(parent?: readonly string[]): Promise<Container[]>;
  countObjects(container: readonly string[]): Promise<Record<string, KindCount>>;
  listObjects(container: readonly string[], kind: string): Promise<DatabaseObject[]>;
  describeObject(path: readonly string[], kind: string): Promise<ObjectDetail>;
  describeObjects(container: readonly string[], kind: string, limit?: number): Promise<ObjectDetailBatch>;
}
```

#### Normalization Example:
Whether inspecting a PostgreSQL table via `information_schema.columns` or an embedded LibreDB collection via `@libredb/libredb` catalog entries, the UI receives a uniform `ObjectDetail` shape:

```typescript
export interface ObjectDetail {
  path: string[];
  columns: ColumnSchema[];
  indexes: IndexSchema[];
  foreignKeys: ForeignKeySchema[];
}
```

---

### Challenge 3: AI Agent Isolation & Read-Only Execution Profiles

When an AI Agent or automated tool runs generated SQL queries against a user's database, returning a mutable connection pool poses catastrophic security risks (e.g., `DROP TABLE` injection, unwanted mutations).

LibreDB Studio introduces **Execution Profiles** (`agent-read-only`, `agent-operations`, `agent-handover`) managed in a physically separate provider cache:

```typescript
// src/lib/db/factory.ts
const profiledProviderCache = new Map<string, ProfiledCachedProvider>();

export async function acquireExecutionProfileProvider(
  connection: DatabaseConnection,
  profile: ExecutionProfile,
  options: ProviderOptions = {}
): Promise<DatabaseProvider> {
  // 1. Never return an existing connection from the user's writable pool.
  // 2. Open an isolated connection under the read-only execution profile.
  // 3. Enforce database-native read-only bounds.
}
```

#### Engine-Native Read-Only Enforcement:

* **PostgreSQL:** Verifies read-only transaction parameters and unprivileged roles at connection open.
* **SQLite:** Enforces `PRAGMA query_only = true` at connection open AND before every statement execution:
  ```typescript
  // src/lib/db/providers/sql/sqlite.ts
  export function assertQueryOnlyEnabled(readback: unknown[]): void {
    const value = (readback[0] as { query_only?: unknown })?.query_only;
    if (value !== 1) {
      throw new ConnectionError("SQLite read-only profile could not enable query_only", "sqlite");
    }
  }
  ```

---

### Challenge 4: Single-Writer File Locks & SSH Tunnel Forwarding

#### 1. Single-Writer File Lock Reuse
File-based embedded engines like SQLite and `@libredb/libredb` take exclusive file locks (`.lock`). Attempting to open a second connection handle to the same file path (e.g., when testing a connection dialog while browsing) throws a `LOCKED` error.

To solve this, the factory inspects provider capabilities (`singleWriterFile: true`) and reuses active handles for read-only inspections rather than throwing lock errors:

```typescript
export function findOpenSingleWriterProvider(connection: DatabaseConnection): DatabaseProvider | null {
  const identity = fileIdentity(connection);
  if (!identity) return null;
  for (const entry of providerCache.values()) {
    if (entry.singleWriterFile === identity && entry.provider.isConnected()) {
      return entry.provider;
    }
  }
  return null;
}
```

#### 2. Automatic SSH Tunneling
For databases sitting behind secure bastions, the factory transparently wraps connection acquisition in an SSH tunnel scope:

```typescript
if (connection.sshTunnel?.enabled && connection.host && connection.port) {
  tunnel = await createSSHTunnel(connection.id, connection.sshTunnel, connection.host, connection.port);
  effectiveConnection = { ...connection, host: tunnel.localHost, port: tunnel.localPort };
}
```

---

## Code Walkthrough & Implementation Details

### The Abstract Provider Contract

Below is an abbreviated view of `BaseDatabaseProvider`:

```typescript
export abstract class BaseDatabaseProvider implements DatabaseProvider {
  public readonly type: DatabaseType;
  public readonly config: DatabaseConnection;

  protected constructor(config: DatabaseConnection, options: ProviderOptions = {}) {
    this.type = config.type;
    this.config = config;
    this.options = options;
    this.state = { connected: false, activeQueries: 0 };
  }

  public abstract connect(): Promise<void>;
  public abstract disconnect(): Promise<void>;
  public abstract query(sql: string, params?: unknown[]): Promise<QueryResult>;

  public abstract listContainers(parent?: readonly string[]): Promise<Container[]>;
  public abstract countObjects(container: readonly string[]): Promise<Record<string, KindCount>>;
  public abstract listObjects(container: readonly string[], kind: string): Promise<DatabaseObject[]>;
  public abstract describeObject(path: readonly string[], kind: string): Promise<ObjectDetail>;

  public abstract getOverview(): Promise<DatabaseOverview>;
  public abstract getPerformanceMetrics(): Promise<PerformanceMetrics>;
  public abstract getSlowQueries(options?: { limit?: number }): Promise<SlowQueryStats[]>;
  public abstract getActiveSessions(options?: { limit?: number }): Promise<ActiveSessionDetails[]>;

  protected redactConnectionString(connectionString: string): string {
    // Redacts credentials from URI strings (postgres://user:pass@host)
  }
}
```

---

## Key Takeaways & Lessons Learned

1. **Abstraction over Re-invention:** Do not attempt to write custom TCP wire protocol drivers in Node.js/TypeScript. Wrap established npm driver packages (`pg`, `mysql2`, `ioredis`) inside a standardized SPI abstraction layer.
2. **Dynamic Imports are Essential:** Loading database drivers dynamically via `import()` prevents cold-start delays and maintains a minimal RAM footprint.
3. **Decouple UI from Database Paradigms:** Provide a unified "Object Surface API" so the UI can render database objects, schemas, indexes, and columns seamlessly across SQL, NoSQL, Key-Value, and Embedded engines.
4. **Security by Design:** Separate AI agent execution pools from user writable pools at the provider layer, enforcing database-native read-only flags (`PRAGMA query_only`, read-only roles).

---

*This architecture powers LibreDB Studio, enabling it to manage over 15 database engines and embedded stores seamlessly within a unified TypeScript codebase.*
