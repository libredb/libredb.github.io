/**
 * Every engine shown in the hexagon grid and on /databases: the twenty-seven
 * external engines of libredb-studio's `EXTERNAL_DATABASE_TYPES`
 * (src/lib/db/compatibility.ts), plus LibreDB, the embedded store the product
 * carries, which is flagged `embedded` and is not counted.
 *
 * Counting rule, from the same file (`connectableProductCount`, #424's claim
 * discipline): a published engine count is the products a user can point the
 * app at, so the embedded store is out of it. Count with `externalEngines`, never
 * with `engines.length`. Each card's copy is transcribed from
 * libredb-studio/docs/providers/<type-id>.md; the transport strings and the
 * "what this engine does not do" lines are the honest-capability claim the
 * design is built around.
 *
 * `logo` points at a self-hosted copy under public/engines/; the prototype
 * hot-linked devicon / simpleicons CDNs (see scripts/fetch-engine-logos.sh).
 */
export type EngineCategory =
  | 'SQL'
  | 'Analytics'
  | 'Federated'
  | 'Document'
  | 'Key-value'
  | 'Wide-column'
  | 'Graph'
  | 'Vector'
  | 'Search'
  | 'Time-series'
  | 'Streaming';

export interface Engine {
  id: string;
  name: string;
  cat: EngineCategory;
  logo: string;
  desc: string;
  /** transport + default port, rendered under TRANSPORT */
  tr: string;
  /** the capability that is deliberately absent, rendered under "What this engine does not do" */
  not: string;
  /** true only for the store the product carries; it is shown, but never counted as an engine */
  embedded?: true;
}

export const engines: Engine[] = [
  {
    id: 'postgresql',
    name: 'PostgreSQL',
    cat: 'SQL',
    logo: '/engines/postgresql.svg',
    desc: 'The reference engine — pooled connections, full catalog introspection, visual EXPLAIN, ER diagrams, live health and agent mode.',
    tr: 'pg pool · 5432',
    not: 'Nothing held back — every capability in the product ships here, including agent mode.',
  },
  {
    id: 'mysql',
    name: 'MySQL',
    cat: 'SQL',
    logo: '/engines/mysql.svg',
    desc: 'Pooled connections with information_schema introspection, EXPLAIN plans and performance_schema-backed monitoring.',
    tr: 'mysql2 pool · 3306',
    not: 'Agent mode is unavailable, as on every engine but PostgreSQL, SQLite, DuckDB and SQL Server.',
  },
  {
    id: 'oracle',
    name: 'Oracle',
    cat: 'SQL',
    logo: '/engines/oracle.svg',
    desc: 'Pooled connections with introspection through the ALL_* data-dictionary views and monitoring through the V$ views, each read guarded because they need privileges an app user may lack.',
    tr: 'oracledb pool · 1521',
    not: "Agent mode is unavailable here. Operate still reads the server's own reporting interface.",
  },
  {
    id: 'sqlserver',
    name: 'SQL Server',
    cat: 'SQL',
    logo: '/engines/sqlserver.svg',
    desc: 'Pooled connections with sys.* catalog introspection, DMV-backed monitoring and agent mode under a least-privilege read-only profile.',
    tr: 'mssql pool · 1433',
    not: "The editor has no Explain action: SQL Server's estimated plan is a session mode that a statement prefix cannot express. Only agent mode reads a plan, to admit a statement.",
  },
  {
    id: 'db2',
    name: 'Db2 LUW',
    cat: 'SQL',
    logo: '/engines/db2.svg',
    desc: 'IBM Db2 for Linux, UNIX and Windows over DRDA, through a Rust driver that needs no IBM client. Schema introspection, server-side paging, inline edits on tables, and RUNSTATS and REORG one table at a time.',
    tr: 'drda · 50000',
    not: 'No EXPLAIN, no query cancel and no Studio-side timeout in this version, and most monitoring panels are empty on purpose. Db2 for z/OS and for IBM i are out of scope.',
  },
  {
    id: 'sqlite',
    name: 'SQLite',
    cat: 'SQL',
    logo: '/engines/sqlite.svg',
    desc: 'The embedded engine — a file, no network. Full editor, ER diagrams, EXPLAIN and agent mode.',
    tr: 'file · embedded',
    not: 'There is no server to monitor: health reads file size and pragma statistics only.',
  },
  {
    id: 'libsql',
    name: 'libSQL',
    cat: 'SQL',
    logo: '/engines/libsql.svg',
    desc: "SQLite's dialect over the network — Turso and self-hosted sqld, spoken natively.",
    tr: 'hrana · 8080 (443 with TLS)',
    not: 'Monitoring reads only what SQLite pragmas and dbstat answer over Hrana: no uptime, cache hit ratio, slow queries or sessions, because libSQL publishes none.',
  },
  {
    id: 'duckdb',
    name: 'DuckDB',
    cat: 'Analytics',
    logo: '/engines/duckdb.svg',
    desc: 'In-process analytics with full EXPLAIN support and agent mode. Admins can query Parquet and CSV files directly; every other role is confined to the database file.',
    tr: 'file · embedded',
    not: 'Single-writer by design: no sessions to list, so health shows storage, not connections.',
  },
  {
    id: 'clickhouse',
    name: 'ClickHouse',
    cat: 'Analytics',
    logo: '/engines/clickhouse.svg',
    desc: 'HTTP interface with system.* introspection, EXPLAIN plans that show index usage, and query-log monitoring.',
    tr: 'http · 8123',
    not: 'No foreign keys exist, so ER diagrams show structure without discovered relations.',
  },
  {
    id: 'druid',
    name: 'Apache Druid',
    cat: 'Analytics',
    logo: '/engines/druid.svg',
    desc: 'SQL over HTTP with datasource and segment introspection for streaming analytics.',
    tr: 'http · 8888',
    not: 'Append-oriented: row editing is disabled rather than offered and then failed.',
  },
  {
    id: 'databend',
    name: 'Databend',
    cat: 'Analytics',
    logo: '/engines/databend.svg',
    desc: 'Self-hosted Databend and Databend Cloud warehouses over its own HTTP query API, with no driver. Catalogs, databases, tables, views and dynamic tables in the tree, EXPLAIN on a SELECT, and monitoring from system tables.',
    tr: 'http · 8000',
    not: 'No inline row or object edit: Databend declares no keys, so a row has no identity to update. Transactions are not exposed, and EXPLAIN ANALYZE is never sent.',
  },
  {
    id: 'trino',
    name: 'Trino',
    cat: 'Federated',
    logo: '/engines/trino.svg',
    desc: 'Federated SQL — one query across the catalogs you already have, from object storage to RDBMS.',
    tr: 'http · 8080',
    not: 'Trino queries catalogs; it does not manage a lakehouse. Writes depend on the underlying connector.',
  },
  {
    id: 'mongodb',
    name: 'MongoDB',
    cat: 'Document',
    logo: '/engines/mongodb.svg',
    desc: 'Document browsing, aggregation pipelines and index introspection over the native driver.',
    tr: 'driver · 27017',
    not: 'No SQL translation layer is faked — queries here are MongoDB queries.',
  },
  {
    id: 'couchbase',
    name: 'Couchbase',
    cat: 'Document',
    logo: '/engines/couchbase.svg',
    desc: 'SQL++ queries with bucket, scope and collection introspection over the documented REST surfaces.',
    tr: 'http · 8091',
    not: 'Agent mode is unavailable, as on every engine but PostgreSQL, SQLite, DuckDB and SQL Server.',
  },
  {
    id: 'redis',
    name: 'Redis',
    cat: 'Key-value',
    logo: '/engines/redis.svg',
    desc: 'Key browsing by pattern, type-aware value views and INFO-backed live monitoring.',
    tr: 'resp · 6379',
    not: 'No SQL, and none is pretended — the editor speaks commands here.',
  },
  {
    id: 'etcd',
    name: 'etcd',
    cat: 'Key-value',
    logo: '/engines/etcd.svg',
    desc: "Reads and writes a cluster through a subset of the etcdctl command line, with keys grouped by prefix and an admin's compaction, defragmentation and alarm disarm. Kubernetes-aware.",
    tr: 'grpc · 2379',
    not: "Writes under Kubernetes' own prefixes are refused before anything is sent, and Kubernetes secrets, protobuf and encrypted values are withheld on every surface. No agent execution and no MCP.",
  },
  {
    id: 'oxia',
    name: 'Oxia',
    cat: 'Key-value',
    logo: '/engines/oxia.svg',
    desc: 'Key lookups, lists and range scans over an Oxia namespace, written as oxia client commands, with its shards in the tree and every key in the Keys panel.',
    tr: 'grpc · 6648',
    not: "Read-only whatever the toggle says: Oxia has no authorization and usually holds Pulsar's metadata, so writes, watches and sessions wait for a design of their own.",
  },
  {
    id: 'libredb',
    name: 'LibreDB',
    cat: 'Key-value',
    logo: '/engines/libredb.svg',
    desc: 'The embedded ordered key-value store — a file, no server and no wire protocol. Mapped onto the interface by convention rather than by emulating SQL.',
    embedded: true,
    tr: 'file · embedded',
    not: 'No sessions and no index objects exist, so those two panels are absent with their reason rather than answered empty. Maintenance operations are refused, not faked.',
  },
  {
    id: 'cassandra',
    name: 'Cassandra',
    cat: 'Wide-column',
    logo: '/engines/cassandra.svg',
    desc: 'CQL editor with keyspace, table and type introspection for wide-column data.',
    tr: 'cql · 9042',
    not: 'No joins and no EXPLAIN — the grid respects partition-key query rules instead of hiding them.',
  },
  {
    id: 'neo4j',
    name: 'Neo4j',
    cat: 'Graph',
    logo: '/engines/neo4j.svg',
    desc: 'Cypher over Bolt, with node labels, relationship types, indexes and constraints in the tree, and a Graph tab that draws the nodes and relationships a result returns.',
    tr: 'bolt · 7687',
    not: "Read-only by construction: a read policy, the server's own classification and a READ session stand between a statement and a write. No EXPLAIN or PROFILE, no APOC and no LOAD CSV.",
  },
  {
    id: 'milvus',
    name: 'Milvus',
    cat: 'Vector',
    logo: '/engines/milvus.svg',
    desc: "Collections, exact counts, queries and vector searches over the gRPC API, typed as Milvus's own REST requests, with integers above 2^53 kept exact.",
    tr: 'grpc · 19530',
    not: "Reads only — an admin's Load and Release are the one state change, and a collection is never loaded implicitly. Server-side functions, model rankers and calls to an embedding provider are refused.",
  },
  {
    id: 'qdrant',
    name: 'Qdrant',
    cat: 'Vector',
    logo: '/engines/qdrant.svg',
    desc: "Collections, point reads, scrolls, counts, facets and queries over dense, sparse and multivector data, written as Qdrant's own REST requests.",
    tr: 'http · 6333',
    not: 'Writes nothing — every request is one of seventeen reads — and refuses every server-side inference input except the local BM25 model.',
  },
  {
    id: 'elasticsearch',
    name: 'Elasticsearch',
    cat: 'Search',
    logo: '/engines/elasticsearch.svg',
    desc: 'Elasticsearch SQL over indices, with mapping introspection and cluster health.',
    tr: 'http · 9200',
    not: 'Search engines are query-and-browse: no row editing, no ER diagrams.',
  },
  {
    id: 'opensearch',
    name: 'OpenSearch',
    cat: 'Search',
    logo: '/engines/opensearch.svg',
    desc: 'The same query-and-browse surface as Elasticsearch, against OpenSearch clusters.',
    tr: 'http · 9200',
    not: 'Search engines are query-and-browse: no row editing, no ER diagrams.',
  },
  {
    id: 'prometheus',
    name: 'Prometheus',
    cat: 'Time-series',
    logo: '/engines/prometheus.svg',
    desc: 'PromQL over the HTTP API, with the metric, rule and target browser beside it.',
    tr: 'http \u00b7 9090',
    not: 'Read-only: Studio calls the read APIs only, so there is nothing to write back.',
  },
  {
    id: 'influxdb',
    name: 'InfluxDB (InfluxQL)',
    cat: 'Time-series',
    logo: '/engines/influxdb.svg',
    desc: 'InfluxQL over the v1 query API on InfluxDB 1.x, 2.x and 3, with databases, measurements, tag keys and field keys in the tree.',
    tr: 'http \u00b7 8086',
    not: 'Read-only whatever the toggle says, and no Flux: Flux is a server-side language, and on a read-only token it still made the server issue HTTP requests, so no read-only Flux policy can be sound.',
  },
  {
    id: 'influxdb3',
    name: 'InfluxDB 3 (SQL)',
    cat: 'Time-series',
    logo: '/engines/influxdb3.svg',
    desc: 'InfluxDB 3 in SQL over /api/v3/query_sql, the DataFusion dialect its server runs: the tables of one database, their columns and their newest rows.',
    tr: 'http \u00b7 8181',
    not: 'Read-only, with no maintenance. Cloud Serverless and Cloud Dedicated serve SQL only over Arrow Flight, which Studio does not use; reach them with the InfluxQL type.',
  },
  {
    id: 'kafka',
    name: 'Apache Kafka',
    cat: 'Streaming',
    logo: '/engines/kafka.svg',
    desc: 'Topic, group and broker browser that reads by offset or by time.',
    tr: 'kafka \u00b7 9092',
    not: 'Read-only: it reads records, it does not produce them.',
  },
];

/** The engines a user points Studio at: every entry but the embedded store. This is the published count. */
export const externalEngines: Engine[] = engines.filter((e) => !e.embedded);

export const defaultEngineId = 'postgresql';

/**
 * The provider docs are named by the provider's canonical **type-id**, not by
 * the product name (docs/providers/README.md § Conventions). Two of our ids are
 * the product name instead, so they need mapping — without it the REFERENCE line
 * pointed at docs/providers/postgresql.md and sqlserver.md, neither of which
 * exists. Every other id already is the type-id.
 */
const TYPE_ID: Record<string, string> = {
  postgresql: 'postgres',
  sqlserver: 'mssql',
};

export const engineReference = (id: string) => `docs/providers/${TYPE_ID[id] ?? id}.md`;
