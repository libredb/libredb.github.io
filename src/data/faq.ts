/**
 * Every answer here restates something the homepage already claims — the engine
 * list, the licence, the deploy channels, the honest-capability rule. Nothing is
 * invented for this page.
 */
export const faq = [
  {
    q: 'What does "the tool goes to the data" actually mean?',
    a: 'Studio runs as a container inside the same private network as your database, and you reach it over a URL. Nothing is exposed to the internet, no SSH tunnel is dug, and the data never travels — only the query and its result do.',
  },
  {
    q: 'Which databases are supported?',
    a: 'Forty-one engines: PostgreSQL, MySQL, Oracle, Db2 LUW, SQL Server, SQLite, libSQL, DuckDB, MongoDB, Redis, Couchbase, Firestore, ClickHouse, Apache Druid, Elasticsearch, OpenSearch, Trino, BigQuery, Databend, Snowflake, Apache Spark, Apache Cassandra, Prometheus, Apache Kafka, etcd, Neo4j, Milvus, Qdrant, InfluxDB (InfluxQL), InfluxDB 3 (SQL), Oxia, S3-compatible object storage, Kubernetes, MQTT, RabbitMQ, OPC UA, MTConnect, Modbus, NETCONF, SNMP and Sparkplug B — relational, document, key-value, wide-column, graph, vector, analytical, search, time-series, streaming and federated query. Twenty-seven more, such as MariaDB, TiDB, CockroachDB, Valkey and ScyllaDB, speak one of those wire protocols and connect through the same drivers, each measured against a live instance, so the drivers reach fifty-four named engines in all. LibreDB itself, the embedded store the playground runs on, is in the list on /databases but not in either count: those count the engines you point Studio at, not the one it carries.',
  },
  {
    q: 'Is anything held back from the open-source build?',
    a: 'No. OIDC single sign-on, ER diagrams, the AI assistant and the MongoDB and Redis drivers are all in the MIT build. Nothing is sold: there is no paid edition or hosted offering, and no capability is held back from the MIT build to create a reason to pay.',
  },
  {
    q: 'Why does each engine list what it does not do?',
    a: 'Because a feature list quietly breaks on the fourth engine. Capability flags come from the provider itself, so a control that cannot work is hidden rather than offered and then failed — Cassandra has no joins, search engines have no row editing, ClickHouse has no foreign keys to draw.',
  },
  {
    q: 'How do I install it?',
    a: 'One container: docker run -p 3000:3000 libredb/libredb-studio. There is also an npx package, a Helm chart, a certified chart in Rancher Partner Charts, an embeddable npm package and one-click templates for Railway, Dokploy, CapRover and Sealos, a DigitalOcean Marketplace listing and a fly.toml that fly launch reads — 46 channels, 39 of them live.',
  },
  {
    q: 'Does it work on a phone?',
    a: 'Yes. There is dedicated mobile navigation and a card view for results, because the query that matters is often the one you run on call, away from a laptop.',
  },
  {
    q: 'What does the database agent do?',
    a: 'You state an objective; the agent runs read-only, budgeted SQL and writes a report where every claim cites a result. It runs statements on PostgreSQL, SQLite, DuckDB and SQL Server; plan mode, which runs nothing, opens on every connection.',
  },
  {
    q: 'How is it secured for a team?',
    a: 'OIDC single sign-on, role-based access control, an audit trail of every executed query, and risk analysis before a destructive statement runs. First boot generates its own secrets and prints them once; native channels bind to localhost by default.',
  },
] as const;
