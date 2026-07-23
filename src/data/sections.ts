import { deployTargets } from './deploy-targets';

/**
 * Section manifest — the single source of truth for the "schema explorer".
 * Each section is a table; selecting it runs `query` and renders its content
 * as a result set. Drives the Explorer tree, the desktop query chrome, and the
 * mobile per-section query cards.
 */
interface SectionColumn {
  name: string;
  type: string; // SQL-ish type shown in the explorer tree
}

export interface SectionMeta {
  id: string; // anchor id + data-section key
  table: string; // table name shown in explorer + {table}.sql tab
  query: string; // SQL shown in the editor (highlighted by <Sql/>)
  rows: number; // result row count
  cols: number; // result column count
  execMs: number; // fake exec time badge
  columns: SectionColumn[];
  explain: string; // AI-generated explanation shown in the Explain panel
  slug: string; // URL slug ('' = home at '/')
  pageTitle: string; // <title> when this section is its own page
  pageDescription: string;
  schema: 'studio' | 'database' | 'platform'; // Explorer grouping
}

export const sections: SectionMeta[] = [
  {
    id: 'home',
    table: 'home',
    query: 'SELECT * FROM libredb_studio;',
    rows: 1,
    cols: 3,
    execMs: 3,
    columns: [
      { name: 'headline', type: 'TEXT' },
      { name: 'tagline', type: 'TEXT' },
      { name: 'stats', type: 'JSONB' },
    ],
    explain:
      'Returns the LibreDB Studio overview: a modern, AI-powered, browser-based SQL IDE with SSO across 7+ engines — free and open source under MIT.',
    slug: '',
    pageTitle: 'LibreDB Studio - AI-Powered Open-Source SQL IDE',
    pageDescription: 'LibreDB Studio - The Modern, AI-Powered Open-Source SQL IDE for Cloud-Native Teams',
    schema: 'studio',
  },
  {
    id: 'features',
    table: 'features',
    query: 'SELECT name, category, summary FROM features ORDER BY category;',
    rows: 18,
    cols: 3,
    execMs: 4,
    columns: [
      { name: 'name', type: 'VARCHAR' },
      { name: 'category', type: 'ENUM' },
      { name: 'summary', type: 'TEXT' },
    ],
    explain:
      'Lists 18 capabilities grouped by area — from the Monaco SQL editor and NL2SQL Copilot to data masking, the DBA toolkit, and a zero-setup embedded LibreDB sample on first launch.',
    slug: 'features',
    pageTitle: 'Features — LibreDB Studio SQL IDE',
    pageDescription:
      'Everything you need to master your data: Monaco SQL editor, NL2SQL Copilot, AI query safety, 7+ databases, pro data grid, visual EXPLAIN, ER diagrams, data masking, SSO and more.',
    schema: 'studio',
  },
  {
    id: 'providers',
    table: 'providers',
    query: 'SELECT name, type, driver FROM providers;',
    rows: 8,
    cols: 3,
    execMs: 2,
    columns: [
      { name: 'name', type: 'VARCHAR' },
      { name: 'type', type: 'VARCHAR' },
      { name: 'driver', type: 'VARCHAR' },
    ],
    explain:
      'The database engines LibreDB Studio connects to — PostgreSQL, MySQL, Oracle, SQL Server, SQLite, MongoDB, Redis — behind one unified interface, plus LibreDB, our own embedded engine.',
    slug: 'providers',
    pageTitle: 'Supported Providers — PostgreSQL, MySQL, Oracle, SQL Server, MongoDB, Redis & LibreDB',
    pageDescription:
      'One tool, all your databases. Connect LibreDB Studio to PostgreSQL, MySQL, Oracle, SQL Server, SQLite, MongoDB and Redis — plus LibreDB, our own open-source embedded engine — through one unified browser-based SQL IDE.',
    schema: 'studio',
  },
  {
    id: 'database',
    table: 'manifesto',
    query: 'SELECT principle, stance FROM manifesto;',
    rows: 6,
    cols: 2,
    execMs: 2,
    columns: [
      { name: 'principle', type: 'TEXT' },
      { name: 'stance', type: 'TEXT' },
    ],
    explain:
      'The LibreDB engine manifesto: a small, readable, embeddable multi-model database you can read in one sitting — multi-model without the magic. early-beta; community-driven.',
    slug: 'database',
    pageTitle: 'LibreDB — the embedded, multimodal database you can read in one sitting',
    pageDescription:
      'LibreDB is a small, readable, embeddable, multi-model database in TypeScript. One ordered key-value core, three lenses (key-value, document, relational), zero dependencies, every line tested. Open source (MIT), early-beta.',
    schema: 'database',
  },
  {
    id: 'database_architecture',
    table: 'architecture',
    query: 'SELECT layer, role FROM architecture;',
    rows: 3,
    cols: 2,
    execMs: 3,
    columns: [
      { name: 'layer', type: 'TEXT' },
      { name: 'role', type: 'TEXT' },
    ],
    explain:
      'How LibreDB works: one ordered byte key-value kernel with thin kv/document/relational lenses on top (FoundationDB pattern). The file boundary is the trust boundary, and the write-ahead log is the database.',
    slug: 'database-architecture',
    pageTitle: 'Architecture — LibreDB: one core, three lenses',
    pageDescription:
      'Inside LibreDB: a single ordered key-value kernel with thin key-value, document, and relational lenses on top. The file boundary is the trust boundary; the write-ahead log is the only on-disk representation.',
    schema: 'database',
  },
  {
    id: 'database_reliability',
    table: 'reliability',
    query: 'SELECT guarantee, mechanism FROM reliability ORDER BY guarantee;',
    rows: 4,
    cols: 2,
    execMs: 4,
    columns: [
      { name: 'guarantee', type: 'TEXT' },
      { name: 'mechanism', type: 'TEXT' },
    ],
    explain:
      'Why you can trust an early-beta engine: a CRC-32 checksummed, fsync-before-commit write-ahead log, crash recovery proven by deterministic simulation testing, 100% core line coverage — plus an honest list of what it deliberately is NOT yet.',
    slug: 'database-reliability',
    pageTitle: 'Reliability — LibreDB crash recovery & deterministic simulation testing',
    pageDescription:
      'LibreDB durability: a length-framed, CRC-32 checksummed write-ahead log fsync-d before commit, crash recovery proven by deterministic simulation testing, and 100% core line coverage. Honest about its v1 limits.',
    schema: 'database',
  },
  {
    id: 'playground',
    table: 'playground',
    query: 'prefix users:  -- LibreDB kv command, runs in your browser via OPFS',
    rows: 3,
    cols: 3,
    execMs: 1,
    columns: [
      { name: 'kv', type: 'KV' },
      { name: 'document', type: 'JSONB' },
      { name: 'relational', type: 'TABLE' },
    ],
    explain:
      'A real LibreDB database running entirely in your browser, backed by OPFS — preloaded sample data across all three lenses, clickable commands, persists across reloads, with zero backend and no signup.',
    slug: 'playground',
    pageTitle: 'Playground — run LibreDB in your browser | LibreDB',
    pageDescription:
      'Run a real LibreDB database entirely in your browser, backed by OPFS. Preloaded sample data, clickable commands, zero backend, no signup.',
    schema: 'database',
  },
  {
    id: 'compare',
    table: 'compare',
    query: 'SELECT * FROM tools ORDER BY freedom DESC;',
    rows: 5,
    cols: 7,
    execMs: 5,
    columns: [
      { name: 'tool', type: 'VARCHAR' },
      { name: 'scores', type: 'BOOL[]' },
      { name: 'price', type: 'VARCHAR' },
    ],
    explain:
      'Scores LibreDB Studio against DataGrip, DBeaver, pgAdmin and TablePlus on zero-install, mobile, AI, SSO and price — ordered by how free and open each is.',
    slug: 'compare',
    pageTitle: 'How LibreDB Studio Compares — vs DataGrip, DBeaver, pgAdmin, TablePlus',
    pageDescription:
      'See why teams switch to LibreDB Studio: zero-install, mobile, AI-native, SSO and free — compared against DataGrip, DBeaver, pgAdmin and TablePlus.',
    schema: 'studio',
  },
  {
    id: 'tech_stack',
    table: 'tech_stack',
    query: 'SELECT layer, tools FROM tech_stack;',
    rows: 4,
    cols: 2,
    execMs: 3,
    columns: [
      { name: 'layer', type: 'VARCHAR' },
      { name: 'tools', type: 'TEXT[]' },
    ],
    explain:
      'The production stack in four layers: frontend (Next.js 16, React 19), editor & data (Monaco, TanStack, ReactFlow), AI & auth (Gemini, OIDC), and devops (Docker, Bun).',
    slug: 'tech-stack',
    pageTitle: 'Tech Stack — LibreDB Studio',
    pageDescription:
      'Built with a modern, production-ready stack: Next.js 16, React 19, TypeScript, Tailwind 4, Monaco, TanStack Table, ReactFlow, Gemini/OIDC, Docker and Bun.',
    schema: 'studio',
  },
  {
    id: 'get_started',
    table: 'get_started',
    query: 'SELECT step, title, command FROM quickstart ORDER BY step;',
    rows: 3,
    cols: 3,
    execMs: 1,
    columns: [
      { name: 'step', type: 'INT' },
      { name: 'title', type: 'VARCHAR' },
      { name: 'command', type: 'TEXT' },
    ],
    explain:
      'Run it in one command — Docker (ghcr.io image) or npx, no clone or build — then open localhost:3000. Building from source (clone, install, dev server) is the separate contributor path below.',
    slug: 'get-started',
    pageTitle: 'Get Started in Minutes — LibreDB Studio',
    pageDescription:
      'Run the open-source LibreDB Studio SQL IDE in one command — docker run ghcr.io/libredb/libredb-studio or npx @libredb/studio, no clone or build. Or build from source for local development.',
    schema: 'studio',
  },
  {
    id: 'faq',
    table: 'faq',
    query: 'SELECT question, answer FROM faq;',
    rows: 11,
    cols: 2,
    execMs: 2,
    columns: [
      { name: 'question', type: 'TEXT' },
      { name: 'answer', type: 'TEXT' },
    ],
    explain:
      'The eleven most common questions: pricing and licensing, self-hosting, AI providers, security & SSO, supported databases, sponsorship, and how it compares to legacy tools.',
    slug: 'faq',
    pageTitle: 'FAQ — LibreDB Studio',
    pageDescription:
      'Frequently asked questions about LibreDB Studio: pricing and Platform licensing, self-hosting, AI providers, security & SSO, supported databases, sponsorship, and how it compares to legacy tools.',
    schema: 'studio',
  },
  {
    id: 'security',
    table: 'security',
    query: 'SELECT control, detail FROM security_controls;',
    rows: 7,
    cols: 2,
    execMs: 3,
    columns: [
      { name: 'control', type: 'TEXT' },
      { name: 'detail', type: 'TEXT' },
    ],
    explain:
      'The security model in one place: OIDC SSO with PKCE, JWT in httpOnly cookies, RBAC, env-var seed credentials, TLS and SSH tunnels, display-level data masking, checksummed releases — and how to report a vulnerability.',
    slug: 'security',
    pageTitle: 'Security — LibreDB Studio',
    pageDescription:
      'How LibreDB Studio handles security: OIDC Single Sign-On with PKCE, JWT in httpOnly cookies, role-based access control, environment-variable seed credentials, TLS/SSH tunnels to databases, data masking, audited open source, and responsible vulnerability disclosure.',
    schema: 'studio',
  },
  {
    id: 'deploy',
    table: 'deploy',
    query: 'SELECT platform, category, method FROM deploy_targets ORDER BY category;',
    rows: deployTargets.length,
    cols: 3,
    execMs: 8,
    columns: [
      { name: 'platform', type: 'VARCHAR' },
      { name: 'category', type: 'VARCHAR' },
      { name: 'method', type: 'VARCHAR' },
    ],
    explain: `Every place LibreDB Studio ships today — ${deployTargets.length} live targets across registries, self-hosted PaaS, Kubernetes and managed PaaS — from one open-source image.`,
    slug: 'deploy',
    pageTitle: 'Deploy LibreDB Studio Anywhere — One-Click Apps, Helm, Docker & Cloud',
    pageDescription:
      'Run the open-source LibreDB Studio SQL IDE anywhere: official Railway, CapRover, Dokploy, Cosmos and Kubero one-click apps, Docker Hub & GHCR images, a Helm chart on Artifact Hub, npm, Homebrew, Snap, .deb/.rpm, and every major open-source PaaS, managed PaaS, and cloud.',
    schema: 'studio',
  },
  {
    id: 'docker_compose',
    table: 'docker_compose',
    slug: 'docker-compose-example',
    query: 'SELECT variable, default, description FROM env_vars;',
    rows: 21,
    cols: 3,
    execMs: 6,
    columns: [
      { name: 'variable', type: 'VARCHAR' },
      { name: 'default', type: 'VARCHAR' },
      { name: 'description', type: 'TEXT' },
    ],
    explain:
      'A copy-paste docker-compose.yml: pulls the published ghcr.io image with every environment variable (auth, OIDC SSO, storage, AI/LLM, seed) — self-host in one command.',
    pageTitle: 'LibreDB Studio Docker Compose Example — Self-Host in Minutes',
    pageDescription:
      'Copy-paste docker-compose.example.yml for LibreDB Studio. Run the open-source SQL IDE with one command using the ghcr.io/libredb/libredb-studio image. Includes every environment variable, SQLite/PostgreSQL storage, and OIDC SSO options.',
    schema: 'studio',
  },
  {
    id: 'platform',
    table: 'overview',
    query: 'SELECT capability, detail FROM access_governance;',
    rows: 6,
    cols: 2,
    execMs: 5,
    columns: [
      { name: 'capability', type: 'TEXT' },
      { name: 'detail', type: 'TEXT' },
    ],
    explain:
      'LibreDB Platform: managed, multi-tenant Database Access Governance for teams — authorized, audited database access built on the open-source LibreDB Studio engine. Live in beta; the commercial layer of the open-core model.',
    slug: 'platform',
    pageTitle: 'LibreDB Platform — Database Access Governance for Teams (beta)',
    pageDescription:
      'Stop distributing connection strings. LibreDB Platform is managed, multi-tenant database access governance — role-based access, encrypted credentials, per-connection permissions, and full query audit logging — built on the open-source LibreDB Studio engine. Live in beta.',
    schema: 'platform',
  },
];

export const sectionById: Record<string, SectionMeta> = Object.fromEntries(sections.map((s) => [s.id, s]));
