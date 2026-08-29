/**
 * The seventeen engines shown in the hexagon grid (design/Home.dc.html → engineData).
 * Copy, transport strings and the "what this engine does not do" lines are final —
 * they are the honest-capability claim the design is built around.
 *
 * `logo` points at a self-hosted copy under public/engines/; the prototype
 * hot-linked devicon / simpleicons CDNs (see scripts/fetch-engine-logos.sh).
 */
export type EngineCategory = 'SQL' | 'Analytics' | 'Federated' | 'Document' | 'Key-value' | 'Wide-column' | 'Search';

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
    not: 'Agent mode is unavailable, as on every engine but PostgreSQL, SQLite and DuckDB.',
  },
  {
    id: 'oracle',
    name: 'Oracle',
    cat: 'SQL',
    logo: '/engines/oracle.svg',
    desc: 'Pooled connections with introspection and monitoring through the ALL_* and DBA_* data-dictionary views.',
    tr: 'oracledb pool · 1521',
    not: "Agent mode is unavailable here. Operate still reads the server's own reporting interface.",
  },
  {
    id: 'sqlserver',
    name: 'SQL Server',
    cat: 'SQL',
    logo: '/engines/sqlserver.svg',
    desc: 'Pooled connections with sys.* catalog introspection, estimated plans and DMV-backed monitoring.',
    tr: 'mssql pool · 1433',
    not: 'Agent mode is unavailable here; the editor, diagrams and health are identical.',
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
    tr: 'hrana · 443',
    not: 'Monitoring is limited to what the sqld server itself exposes.',
  },
  {
    id: 'duckdb',
    name: 'DuckDB',
    cat: 'Analytics',
    logo: '/engines/duckdb.svg',
    desc: 'In-process analytics — query Parquet and CSV files directly, with full EXPLAIN support and agent mode.',
    tr: 'file · embedded',
    not: 'Single-writer by design: no sessions to list, so health shows storage, not connections.',
  },
  {
    id: 'clickhouse',
    name: 'ClickHouse',
    cat: 'Analytics',
    logo: '/engines/clickhouse.svg',
    desc: 'HTTP interface with system.* introspection, EXPLAIN pipelines and query-log monitoring.',
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
    id: 'trino',
    name: 'Apache Trino',
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
    not: 'Agent mode is unavailable, as on every engine but PostgreSQL, SQLite and DuckDB.',
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
    id: 'libredb',
    name: 'LibreDB',
    cat: 'Key-value',
    logo: '/engines/libredb.svg',
    desc: 'The embedded ordered key-value store — a file, no server and no wire protocol. Mapped onto the interface by convention rather than by emulating SQL.',
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
    id: 'elasticsearch',
    name: 'Elasticsearch',
    cat: 'Search',
    logo: '/engines/elasticsearch.svg',
    desc: 'Query DSL and browsing over indices, with mapping introspection and cluster health.',
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
];

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
