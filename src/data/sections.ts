import { deployTargets } from './deploy-targets';

/**
 * Section manifest — the single source of truth for the "schema explorer".
 * Each section is a table; selecting it runs `query` and renders its content
 * as a result set. Drives the Explorer tree, the desktop query chrome, and the
 * mobile per-section query cards.
 */
export interface SectionColumn {
  name: string;
  type: string; // SQL-ish type shown in the explorer tree
}

export interface SectionMeta {
  id: string;          // anchor id + data-section key
  table: string;       // table name shown in explorer + {table}.sql tab
  query: string;       // SQL shown in the editor (highlighted by <Sql/>)
  rows: number;        // result row count
  cols: number;        // result column count
  execMs: number;      // fake exec time badge
  columns: SectionColumn[];
  explain: string;     // AI-generated explanation shown in the Explain panel
  slug: string;        // URL slug ('' = home at '/')
  pageTitle: string;   // <title> when this section is its own page
  pageDescription: string;
  schema: 'studio' | 'database'; // Explorer grouping; platform has no sections
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
    explain: 'Returns the LibreDB Studio overview: a modern, AI-powered, browser-based SQL IDE with SSO across 7+ engines — free and open source under MIT.',
    slug: '',
    pageTitle: 'LibreDB Studio - AI-Powered Open-Source SQL IDE',
    pageDescription: 'LibreDB Studio - The Modern, AI-Powered Open-Source SQL IDE for Cloud-Native Teams',
    schema: 'studio',
  },
  {
    id: 'features',
    table: 'features',
    query: 'SELECT name, category, summary FROM features ORDER BY category;',
    rows: 17,
    cols: 3,
    execMs: 4,
    columns: [
      { name: 'name', type: 'VARCHAR' },
      { name: 'category', type: 'ENUM' },
      { name: 'summary', type: 'TEXT' },
    ],
    explain: 'Lists 17 capabilities grouped by area — from the Monaco SQL editor and NL2SQL Copilot to data masking and the DBA toolkit.',
    slug: 'features',
    pageTitle: 'Features — LibreDB Studio SQL IDE',
    pageDescription: 'Everything you need to master your data: Monaco SQL editor, NL2SQL Copilot, AI query safety, 7+ databases, pro data grid, visual EXPLAIN, ER diagrams, data masking, SSO and more.',
    schema: 'studio',
  },
  {
    id: 'providers',
    table: 'providers',
    query: 'SELECT name, type, driver FROM providers;',
    rows: 7,
    cols: 3,
    execMs: 2,
    columns: [
      { name: 'name', type: 'VARCHAR' },
      { name: 'type', type: 'VARCHAR' },
      { name: 'driver', type: 'VARCHAR' },
    ],
    explain: 'The database engines LibreDB Studio connects to — PostgreSQL, MySQL, Oracle, SQL Server, SQLite, MongoDB, Redis — behind one unified interface, plus LibreDB, our own embedded engine.',
    slug: 'providers',
    pageTitle: 'Supported Providers — PostgreSQL, MySQL, Oracle, SQL Server, MongoDB, Redis & LibreDB',
    pageDescription: 'One tool, all your databases. Connect LibreDB Studio to PostgreSQL, MySQL, Oracle, SQL Server, SQLite, MongoDB and Redis — plus LibreDB, our own open-source embedded engine — through one unified browser-based SQL IDE.',
    schema: 'studio',
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
    explain: 'Scores LibreDB Studio against DataGrip, DBeaver, pgAdmin and TablePlus on zero-install, mobile, AI, SSO and price — ordered by how free and open each is.',
    slug: 'compare',
    pageTitle: 'How LibreDB Studio Compares — vs DataGrip, DBeaver, pgAdmin, TablePlus',
    pageDescription: 'See why teams switch to LibreDB Studio: zero-install, mobile, AI-native, SSO and free — compared against DataGrip, DBeaver, pgAdmin and TablePlus.',
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
    explain: 'The production stack in four layers: frontend (Next.js 16, React 19), editor & data (Monaco, TanStack, ReactFlow), AI & auth (Gemini, OIDC), and devops (Docker, Bun).',
    slug: 'tech-stack',
    pageTitle: 'Tech Stack — LibreDB Studio',
    pageDescription: 'Built with a modern, production-ready stack: Next.js 16, React 19, TypeScript, Tailwind 4, Monaco, TanStack Table, ReactFlow, Gemini/OIDC, Docker and Bun.',
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
    explain: 'Three steps to run locally — clone & install, configure env, launch — plus a one-command Docker alternative.',
    slug: 'get-started',
    pageTitle: 'Get Started in Minutes — LibreDB Studio',
    pageDescription: 'Run LibreDB Studio locally in three steps — clone & install, configure, launch — or one-command Docker. Self-host the open-source AI SQL IDE.',
    schema: 'studio',
  },
  {
    id: 'faq',
    table: 'faq',
    query: 'SELECT question, answer FROM faq;',
    rows: 9,
    cols: 2,
    execMs: 2,
    columns: [
      { name: 'question', type: 'TEXT' },
      { name: 'answer', type: 'TEXT' },
    ],
    explain: 'The nine most common questions: pricing, self-hosting, AI providers, security & SSO, supported databases, and how it compares to legacy tools.',
    slug: 'faq',
    pageTitle: 'FAQ — LibreDB Studio',
    pageDescription: 'Frequently asked questions about LibreDB Studio: pricing, self-hosting, AI providers, security & SSO, supported databases, and how it compares to legacy tools.',
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
    explain: 'Every place LibreDB Studio runs — 39 targets across registries, self-hosted PaaS, Kubernetes, managed PaaS and cloud — from one open-source image.',
    slug: 'deploy',
    pageTitle: 'Deploy LibreDB Studio Anywhere — One-Click Apps, Helm, Docker & Cloud',
    pageDescription: 'Run the open-source LibreDB Studio SQL IDE anywhere: official Railway and CapRover one-click apps, Docker Hub & GHCR images, a Helm chart on Artifact Hub, npm, and every major open-source PaaS, managed PaaS, and cloud.',
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
    explain: 'A copy-paste docker-compose.yml: pulls the published ghcr.io image with every environment variable (auth, OIDC SSO, storage, AI/LLM, seed) — self-host in one command.',
    pageTitle: 'LibreDB Studio Docker Compose Example — Self-Host in Minutes',
    pageDescription: 'Copy-paste docker-compose.example.yml for LibreDB Studio. Run the open-source SQL IDE with one command using the ghcr.io/libredb/libredb-studio image. Includes every environment variable, SQLite/PostgreSQL storage, and OIDC SSO options.',
    schema: 'studio',
  },
];

export const sectionById: Record<string, SectionMeta> = Object.fromEntries(
  sections.map((s) => [s.id, s]),
);
