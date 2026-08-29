/**
 * Per-feature detail for /features.
 *
 * The six headline features live in `home.ts` (lifted verbatim from the design
 * handoff) and are the spine of this page too — this file only adds the depth a
 * dedicated page owes a reader, keyed by the same `n`.
 *
 * Source: libredb-studio README.md § "Key Features" and docs/AGENT.md. Every
 * `limit` is stated there too; none of them is softened here. Where the product
 * documents a boundary (agent mode's three engines, masking being client-side
 * only, the toolkit being admin-only), the boundary is part of the feature.
 */
export interface FeatureDetail {
  /** matches `features[].n` in home.ts */
  n: string;
  /** what it is, past the one-line summary */
  body: string;
  /** the concrete capabilities, as a reader would check them off */
  points: string[];
  /** the boundary the product documents — never omitted, never softened */
  limit: string;
}

export const featureDetails: FeatureDetail[] = [
  {
    n: '01',
    body: 'The editor is Monaco — the same core VS Code runs on — wired to the connected database rather than to a file on disk. Completion is drawn from the live catalog, so it offers your tables and your columns, not a generic SQL keyword list.',
    points: [
      'Schema-aware completion for tables, columns and keywords',
      'Multi-tab workspace, each tab with its own execution state',
      'Formatting and snippets; ⌘⏎ / Ctrl+⏎ runs the statement',
      'Schema diff across snapshots or two connections, with migration SQL generated',
      'A snapshot timeline — pick any two points and compare',
    ],
    limit:
      'Migration SQL is generated for PostgreSQL, MySQL, SQLite, Oracle and SQL Server, plus ClickHouse column modifications. Other engines diff but do not emit migrations.',
  },
  {
    n: '02',
    body: 'Plans come back from the engine and are drawn as a tree rather than printed as text: scan types, join strategies and costs laid out so the expensive node is the one you see first.',
    points: [
      'Graphical execution plans, node by node',
      'Scan type, join strategy and cost surfaced per node',
      'Reads each engine’s own plan output — nothing is simulated',
    ],
    limit:
      'Plan rendering follows the engine: PostgreSQL, MySQL, DuckDB, ClickHouse and Trino among others expose a plan this can draw. Where an engine has no plan interface, there is nothing to render.',
  },
  {
    n: '03',
    body: 'The diagram is discovered, not drawn by hand: foreign keys are read from the schema and laid out hierarchically by ELK.js, so the graph reflects what the database actually declares.',
    points: [
      'Real foreign-key edges with cardinality labels',
      'MiniMap navigation, table search and filter, compact mode',
      'Automatic hierarchical layout (ELK.js)',
      'Export as PNG or SVG',
    ],
    limit:
      'Edges come from declared foreign keys. A relationship your application enforces in code but never declares in the schema has nothing to discover, and will not appear.',
  },
  {
    n: '04',
    body: 'The model-backed helpers sit beside the editor: explain a plan in plain language, draft a statement from a description, get a risk read before a destructive statement runs. The connected schema goes with the request, so the answer names your tables.',
    points: [
      'Query explainer — EXPLAIN output translated, with suggestions',
      'Pre-execution risk analysis for DELETE, DROP and TRUNCATE',
      'Data profiler summaries written up in prose',
      'Gemini (default), OpenAI, Ollama, or any OpenAI-compatible endpoint',
      'Generated SQL is yours to read; nothing runs itself',
    ],
    limit:
      'With no LLM settings configured at all, the rail does not render and nothing leaves your network. Note that an API key is not the switch — Ollama and a custom endpoint count as a configured model without one.',
  },
  {
    n: '05',
    body: 'A monitoring surface read from each engine’s own reporting interface — seven tabs covering overview, performance, queries, sessions, tables, storage and the connection pool, refreshed on an interval you choose.',
    points: [
      'Time-series trends for connections, cache hit ratio, buffer pool and deadlocks',
      'Auto-refresh from 5s to 60s, with play/pause',
      'Colour-coded health thresholds — healthy, warning, critical',
      'Live pool metrics: total, active, idle, waiting',
      'One-click VACUUM, ANALYZE, REINDEX, UPDATE STATISTICS, DBCC CHECKDB, ALTER INDEX REBUILD',
      'An audit trail of every query executed across the organisation',
    ],
    limit:
      'The maintenance toolkit and the audit trail are admin-only. What each panel can show is bounded by what the engine reports — an embedded engine with no sessions shows storage, not connections.',
  },
  {
    n: '06',
    body: 'You state an objective and press Start. The run drafts SQL, reads what comes back, and composes a report in which every claim cites the result it came from. It never starts itself, never writes to the editor, and never executes what it recommends.',
    points: [
      'Three workflows — Investigate, Optimize, Assess',
      'Read-only enforced by the database, not by a parser: a read-only transaction on PostgreSQL, PRAGMA query_only re-asserted per statement on SQLite, a READ_ONLY handle plus an SQL guard on DuckDB',
      'Every statement passes a policy decision, an audit event and budget accounting before the driver is touched',
      'Bounded and metered on screen: 20 statements, 60s of database time, 200 rows per read, a 5-minute deadline',
      'Evidence or nothing — a claim with no citation cannot be composed',
      'The run states its own verdict: “Run answered” or “Run did not answer”',
    ],
    limit:
      'Agent mode reads PostgreSQL, SQLite and DuckDB only, because the read-only profile is database-native and exists only where a provider implements it. On any other engine a run ends engine-unsupported. Plan mode opens on every connection — it is toolless, runs nothing, and drafts a statement for you to run yourself. The embedded @libredb/studio package carries no agent surface at all.',
  },
];
