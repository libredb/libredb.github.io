// Single source of truth for the supported engine list. Every surface that
// names or counts the engines (hero subtitle, JSON-LD, SEO copy) must derive
// from this array — the 7/5/4 count drift across surfaces is what this fixes.
export const ENGINES = [
  'PostgreSQL',
  'MySQL',
  'Oracle',
  'SQL Server',
  'SQLite',
  'MongoDB',
  'Redis',
  'Couchbase',
  'ClickHouse',
  'Apache Druid',
] as const;
