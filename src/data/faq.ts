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
    a: 'Sixteen engines: PostgreSQL, MySQL, Oracle, SQL Server, SQLite, libSQL, DuckDB, ClickHouse, Apache Druid, Apache Trino, MongoDB, Couchbase, Redis, Cassandra, Elasticsearch and OpenSearch — relational, document, key-value, wide-column, analytical, search and federated query.',
  },
  {
    q: 'Is anything held back from the open-source build?',
    a: 'No. OIDC single sign-on, ER diagrams, the AI assistant and the MongoDB and Redis drivers are all in the MIT build. What costs money is someone else running it for you; no capability moves across that line to create a reason to upgrade.',
  },
  {
    q: 'Why does each engine list what it does not do?',
    a: 'Because a feature list quietly breaks on the fourth engine. Capability flags come from the provider itself, so a control that cannot work is hidden rather than offered and then failed — Cassandra has no joins, search engines have no row editing, ClickHouse has no foreign keys to draw.',
  },
  {
    q: 'How do I install it?',
    a: 'One container: docker run -d -p 3000:3000 libredb/libredb-studio. There is also an npx package, a Helm chart, an OpenShift operator bundle, an embeddable npm package and one-click templates for Railway, Dokploy, CapRover, DigitalOcean, Sealos and Fly.io — 27 channels, 22 of them live.',
  },
  {
    q: 'Does it work on a phone?',
    a: 'Yes. There is dedicated mobile navigation and a card view for results, because the query that matters is often the one you run on call, away from a laptop.',
  },
  {
    q: 'What does the database agent do?',
    a: 'You state an objective; the agent runs read-only, budgeted SQL and writes a report where every claim cites a result. It is available on PostgreSQL and SQLite.',
  },
  {
    q: 'How is it secured for a team?',
    a: 'OIDC single sign-on, role-based access control, an audit trail of every executed query, and risk analysis before a destructive statement runs. First boot generates its own secrets and prints them once; native channels bind to localhost by default.',
  },
] as const;
