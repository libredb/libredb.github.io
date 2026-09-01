/**
 * Homepage content, lifted verbatim from design/Home.dc.html.
 * Copy is final — see README.md § Fidelity. Nothing here is paraphrased.
 */
import { site } from '../lib/site';

/* --- header / nav --------------------------------------------------------- */
export const navLinks = [
  { href: '#why', label: 'Why' },
  { href: '#how', label: 'How it works' },
  { href: '#databases', label: 'Databases' },
  { href: '#product', label: 'Product' },
  { href: '#open-source', label: 'Open source' },
  { href: '#deploy', label: 'Deploy' },
] as const;

/* --- hero ----------------------------------------------------------------- */
export const hero = {
  badge: `Open source · MIT · v${site.version}`,
  /** word-by-word lbWord entrance: line one plain, line two gradient-clipped */
  headline: {
    lineOne: ['You', 'created', 'the', 'database.'],
    lineTwo: ['The', 'editor', 'is', 'already', 'beside', 'it.'],
  },
  sub: 'LibreDB Studio is the database IDE that deploys next to your data instead of onto your laptop — one browser tab for PostgreSQL, MySQL, MongoDB, Redis and thirteen more engines, with SSO and audit built in.',
  primaryCta: { label: 'Open live demo', href: 'https://app.libredb.org' },
  secondaryCta: { label: 'Deploy in one click', href: '#deploy' },
  command: 'docker run -p 3000:3000 libredb/libredb-studio',
  commandNote: 'or npx @libredb/studio — no Docker needed. Running in about ten seconds.',
  frameAddress: 'studio.internal — live product tour',
} as const;

/**
 * The live demo runs one shared account whose credentials are published on purpose.
 * It is a normal user, not an admin — the maintenance toolkit and the audit trail
 * are admin-only, so what is reachable with these two strings is the editor, the
 * agent and the panels, and nothing that can be used to take the instance apart.
 *
 * This lives on the website rather than inside Studio: a self-hosted install must
 * never render a demo banner it has no use for, and putting the pair in the login
 * page would ship marketing copy into everyone's deployment.
 */
export const demoAccount = {
  email: 'demo@libredb.org',
  password: 'Demo2026',
  note: 'Shared account — nothing you leave in it stays private.',
} as const;

/* --- why it exists -------------------------------------------------------- */
export const why = {
  eyebrow: 'Why it exists',
  headline: { before: 'The database took ', gradient: 'forty seconds', after: '. Reaching it took the afternoon.' },
  body: [
    'You create a Postgres on Railway. It is ready before your coffee. Then you want to look inside it — so you expose a port to the internet, or install a desktop client and dig an SSH tunnel, or give up and drive it from a shell.',
    "Databases moved — into Kubernetes, into PaaS platforms, into a customer's VPC. The tools that read them did not. They are still desktop applications: heavy, licensed per seat, built for one database, one laptop, one person who never changes machines.",
  ],
  /** the four access scenarios the diagram cycles through every 2.6s */
  steps: [
    {
      t: 'Expose the port',
      sub: '5432 open to the internet, fingers crossed',
      chip: '✕ port forward',
      status: '✕ database exposed to the internet — closed by the first security review',
      from: 'desktop client',
      ok: false,
    },
    {
      t: 'Dig an SSH tunnel',
      sub: 'a bastion, keys, re-dug every morning',
      chip: '✕ ssh -L 5432',
      status: '✕ tunnel dropped — reconnect, re-authenticate, start over',
      from: 'desktop client',
      ok: false,
    },
    {
      t: 'Install a desktop client',
      sub: 'licensed per seat, tied to one laptop',
      chip: '✕ tcp · one seat',
      status: '✕ works — on one machine, for one person, until they change laptops',
      from: 'desktop client',
      ok: false,
    },
    {
      t: 'Run Studio inside the network',
      sub: 'one container, next to the database',
      chip: '✓ http · internal',
      status: '→ https://studio.internal — every browser, every phone on the team',
      from: 'any browser',
      ok: true,
    },
  ],
} as const;

/* --- "the tool goes to the data" band ------------------------------------- */
export const flowBand = {
  headline: { before: 'The tool ', gradient: 'goes to the data', after: '. Not the data to the tool.' },
  body: 'Take that seriously and it becomes a specification: the editor has to run in a browser, reach a phone, deploy like infrastructure and stay unrestricted. MIT is not generosity — it is a requirement of the architecture.',
  toggles: { out: 'Data → tool', in: 'Tool → data' },
  /** "out" = the old way (data travels), "in" = Studio's way (the tool travels) */
  out: {
    chip: '✕ 4,2 TB · copies out',
    destKicker: 'YOU',
    destTitle: 'Desktop client',
    destSub: 'one licensed laptop',
    caption: '✕ dumps, replicas, tunnels — terabytes travel to one machine',
  },
  in: {
    chip: '✓ https · queries only',
    destKicker: 'TEAM',
    destTitle: 'Any browser',
    destSub: 'laptop · phone · tablet',
    caption: '→ the data never leaves the network — a URL travels instead',
  },
  specs: ['runs in a browser', 'reaches a phone', 'deploys like infrastructure', 'MIT licensed'],
  dbMeta: '4,2 TB · in place',
} as const;

/* --- how it works --------------------------------------------------------- */
export const how = {
  eyebrow: 'How it works',
  headline: { before: 'From forty seconds to ', gradient: 'the whole team', after: '' },
  steps: [
    {
      n: '01',
      t: 'Create the database',
      d: 'A one-line provision, a Helm release, a managed instance — ready in forty seconds, inside a network your laptop cannot see.',
    },
    {
      n: '02',
      t: 'Deploy Studio beside it',
      d: 'One container next to the database. Same network, nothing exposed to the outside, no SSH tunnel dug. Docker, Helm, an operator, or a one-click template.',
    },
    {
      n: '03',
      t: 'Open a browser tab',
      d: "The editor is a URL. It reaches your laptop, your teammate's machine, and the phone you are holding during an incident. Nothing to install, ever again.",
    },
    {
      n: '04',
      t: 'Sign the whole team in',
      d: 'OIDC single sign-on, role-based access control, an audit trail of every executed query, and risk analysis before a destructive statement runs.',
    },
  ],
  terminal: [
    { tone: 'dim', prompt: '$', text: 'railway add postgres' },
    { tone: 'bright', prompt: '$', text: 'docker run -p 3000:3000 libredb/libredb-studio' },
    { tone: 'dim', prompt: '→', text: 'https://studio.internal — open anywhere' },
    { tone: 'dim', prompt: '✓', text: 'sso · rbac · query audit enabled' },
  ],
} as const;

/* --- databases ------------------------------------------------------------ */
export const databases = {
  eyebrow: 'Seventeen engines',
  headline: { lineOne: 'One interface.', gradient: 'Different engines.' },
  intro:
    "Relational, document, key-value, analytical, search and federated query — the same tree, editor and grid over each of them, and each engine's real limits declared rather than papered over.",
  notDoTitle: 'What this engine does not do',
  notDoNote:
    'Stated because the alternative is a feature list that quietly breaks on the fourth engine. Capability flags come from the provider itself — a control that cannot work is hidden, not offered and then failed.',
  footnote:
    'The claim is the span, not a count — seventeen engines, one interface. Per-engine detail lives in the provider docs.',
} as const;

/* --- product demo --------------------------------------------------------- */
export const product = {
  eyebrow: 'The product',
  headline: 'A serious IDE, not an admin panel',
  intro: 'Monaco under the hood, a virtualized grid over millions of rows, and the panels a DBA actually opens.',
  tabs: [
    { id: 'tour', label: 'Product tour', chip: 'studio — live tour' },
    { id: 'editor', label: 'SQL editor', chip: 'query.sql' },
    { id: 'diagram', label: 'ER diagram', chip: 'query.sql' },
    { id: 'health', label: 'Health', chip: 'query.sql' },
    { id: 'mobile', label: 'Mobile', chip: 'studio — on a phone' },
  ],
  connection: 'postgres · prod-eu',
  replay: '↻ replay',
  mobile: {
    eyebrow: 'The incident does not wait',
    title: 'The same editor reaches the phone in your pocket',
    body: 'Dedicated mobile navigation and card views for results — because the query that matters is often the one you run on call, away from a laptop.',
  },
  diagramNote: '3 foreign keys · discovered from the schema · export SVG / PNG',
} as const;

/** the SQL typed out character-by-character in the editor tab */
export const demoSql: Array<[token: 'cm' | 'kw' | 'pl' | 'str' | 'num', text: string]> = [
  ['cm', '-- checkout latency, last 24 h\n'],
  ['kw', 'SELECT'],
  ['pl', ' o.id, u.email, o.total_cents, o.created_at\n'],
  ['kw', 'FROM'],
  ['pl', '   orders o\n'],
  ['kw', 'JOIN'],
  ['pl', '   users u '],
  ['kw', 'ON'],
  ['pl', ' u.id = o.user_id\n'],
  ['kw', 'WHERE'],
  ['pl', '  o.status = '],
  ['str', "'pending'"],
  ['pl', '\n'],
  ['kw', 'ORDER BY'],
  ['pl', ' o.created_at '],
  ['kw', 'DESC'],
  ['pl', '\n'],
  ['kw', 'LIMIT'],
  ['num', '  50'],
  ['pl', ';'],
];

export const demoStatus = {
  typing: '⌘⏎ to run',
  typed: '⌘⏎ to run',
  running: 'running…',
  done: '50 rows · 14 ms',
} as const;

export const demoRows = [
  { id: 'b91c-4a…', email: 'ada@acme.dev', total: '12400', at: '2026-08-27 09:14:02' },
  { id: '4e2a-90…', email: 'kim@acme.dev', total: '8950', at: '2026-08-27 09:11:47' },
  { id: '77d0-c3…', email: 'noor@acme.dev', total: '41200', at: '2026-08-27 09:08:19' },
  { id: 'c3ab-11…', email: 'leo@acme.dev', total: '3300', at: '2026-08-27 08:59:55' },
  { id: '90ff-7e…', email: 'mia@acme.dev', total: '27860', at: '2026-08-27 08:57:31' },
] as const;

export const demoTree = [
  { kind: 'schema', label: '▸ public' },
  { kind: 'table', label: '▤ orders', count: '184k', active: true },
  { kind: 'col', label: 'id', type: 'uuid PK', tone: 'key' },
  { kind: 'col', label: 'user_id', type: 'FK', tone: 'fk' },
  { kind: 'col', label: 'status', type: 'text', tone: 'plain' },
  { kind: 'col', label: 'total_cents', type: 'int4', tone: 'plain' },
  { kind: 'table', label: '▤ users', count: '12.4k' },
  { kind: 'table', label: '▤ order_items', count: '512k' },
  { kind: 'table', label: '▤ products', count: '2.1k' },
  { kind: 'table', label: '▤ payments', count: '96k' },
] as const;

export const erTables = [
  {
    name: '▤ users',
    left: 24,
    top: 40,
    width: 172,
    cols: [
      { n: 'id', t: 'uuid PK', tone: 'key' },
      { n: 'email', t: 'text', tone: 'plain' },
    ],
  },
  {
    name: '▤ orders',
    left: 240,
    top: 130,
    width: 172,
    cols: [
      { n: 'id', t: 'uuid PK', tone: 'key' },
      { n: 'user_id', t: 'FK', tone: 'fk' },
      { n: 'status', t: 'text', tone: 'plain' },
    ],
  },
  {
    name: '▤ order_items',
    left: 452,
    top: 40,
    width: 184,
    cols: [
      { n: 'order_id', t: 'FK', tone: 'fk' },
      { n: 'product_id', t: 'FK', tone: 'fk' },
      { n: 'qty', t: 'int4', tone: 'plain' },
    ],
  },
  {
    name: '▤ products',
    left: 452,
    top: 246,
    width: 184,
    cols: [
      { n: 'id', t: 'uuid PK', tone: 'key' },
      { n: 'price_cents', t: 'int4', tone: 'plain' },
    ],
  },
] as const;

export const erPaths = [
  { d: 'M196 96 C 220 96, 216 168, 240 168', dur: '1.2s' },
  { d: 'M412 176 C 432 176, 428 96, 452 96', dur: '1.3s' },
  { d: 'M452 282 C 428 282, 436 122, 452 118', dur: '1.1s' },
] as const;

export const healthStats = [
  { label: 'Active sessions', value: '24', fill: 48 },
  { label: 'Cache hit ratio', value: '99.2%', fill: 99 },
  { label: 'Database size', value: '4.2 GB', fill: 34 },
] as const;

export const slowQueries = {
  title: 'Slowest queries · last hour',
  rows: [
    { sql: 'SELECT … FROM order_items JOIN products ON …', fill: 84, tone: 'warn', ms: '1840 ms' },
    { sql: 'UPDATE orders SET status = … WHERE created_at < …', fill: 41, tone: 'info', ms: '902 ms' },
    { sql: 'SELECT count(*) FROM payments WHERE settled = false', fill: 22, tone: 'ok', ms: '488 ms' },
  ],
  note: "read from the engine's own reporting interface · sessions can be terminated from here",
} as const;

/* --- features ------------------------------------------------------------- */
export const featuresSection = {
  eyebrow: 'What ships',
  headline: { before: 'Everything a database IDE ', gradient: 'owes you', after: '' },
} as const;

export const features = [
  {
    n: '01',
    icon: 'code',
    t: 'Schema-aware SQL editor',
    d: 'Monaco under the hood — table and column completion, formatting, snippets, ⌘⏎ to run.',
  },
  {
    n: '02',
    icon: 'share',
    t: 'Visual EXPLAIN',
    d: 'Plan trees for PostgreSQL, MySQL, DuckDB, ClickHouse, Trino and more — scan types, joins and costs, drawn.',
  },
  {
    n: '03',
    icon: 'diagram',
    t: 'ER diagrams',
    d: 'Foreign-key graphs discovered from the schema. Pan, filter, and export as SVG or PNG.',
  },
  {
    n: '04',
    icon: 'sparkles',
    t: 'AI that knows your schema',
    d: 'Explain a query or draft one in plain language — Gemini, OpenAI, Ollama or any compatible endpoint. Generated SQL is yours to read before it runs.',
  },
  {
    n: '05',
    icon: 'activity',
    t: 'Live health dashboard',
    d: "Sessions, slow queries, cache hit ratios and storage — read from each engine's own reporting interface.",
  },
  {
    n: '06',
    icon: 'bot',
    t: 'The database agent',
    d: 'State an objective; the agent runs read-only, budgeted SQL and writes a report where every claim cites a result.',
  },
] as const;

/* --- open source ---------------------------------------------------------- */
export const openSource = {
  eyebrow: 'Open source',
  headline: { before: 'Nothing sits behind an ', gradient: 'enterprise wall', after: '' },
  intro:
    'LibreDB Studio is MIT because it has to go everywhere. What costs money is someone else running it for you — no capability moves across that line to create a reason to upgrade.',
  tableHead: ['Capability', 'LibreDB Studio', 'Typical community editions'],
  rows: [
    { cap: 'OIDC single sign-on', us: 'in the MIT build', them: 'Enterprise, AWS only' },
    { cap: 'ER diagrams', us: 'in the MIT build', them: 'PRO editions' },
    { cap: 'AI assistant', us: 'in the MIT build', them: 'Enterprise' },
    { cap: 'MongoDB and Redis', us: 'in the MIT build', them: 'absent from community driver sets' },
  ],
  tableNote:
    'License and feature scope only, each line with a primary source — the full table lives on the comparison page.',
  stats: [
    { v: '100%', l: 'line coverage, enforced as a CI gate' },
    { v: '17', l: 'engines — SQL, NoSQL, analytics and search' },
    { v: '33', l: 'distribution channels, 26 of them live' },
    { v: 'MIT', l: 'license. All of it, nothing held back' },
  ],
} as const;

/* --- deploy --------------------------------------------------------------- */
export const deploy = {
  eyebrow: 'Deploy',
  headline: { before: 'It installs like ', gradient: 'infrastructure', after: ', because it is' },
  intro:
    'A container, a Helm chart, a certified Rancher listing, a one-click template, or an npm package embedded inside your own product.',
  tabs: [
    {
      id: 'docker',
      label: 'Docker',
      command: 'docker run -p 3000:3000 libredb/libredb-studio',
      note: '# zero-config first run — secrets generated at boot, printed once',
    },
    {
      id: 'npx',
      label: 'npx',
      command: 'npx @libredb/studio',
      note: '# no Docker needed — binds to 127.0.0.1 by default',
    },
    {
      id: 'helm',
      label: 'Helm',
      command: 'helm install studio ./charts/libredb-studio',
      note: '# also a certified chart in Rancher Partner Charts',
    },
    {
      id: 'embed',
      label: 'Embed',
      command: 'npm i @libredb/studio',
      note: '# mount the editor inside the product that created the database',
    },
    {
      id: 'cloud',
      label: 'One-click',
      platforms: ['Railway →', 'Dokploy →', 'CapRover →', 'DigitalOcean →', 'Sealos →'],
      note: '# one click on the platform that already runs your database',
    },
  ],
  channelsCount: '33',
  channelsLabel: 'distribution channels — 26 live',
  channels: [
    'Docker Hub',
    'Helm chart',
    'Rancher Partner Charts',
    'npm',
    'Homebrew',
    'Snap',
    'deb / rpm',
    'Railway',
    'Dokploy',
    'CapRover',
    'DigitalOcean',
    'Sealos',
    'Fly.io',
  ],
  channelsNote:
    'Every published artifact carries a build provenance attestation, and native channels bind to localhost by default.',
  channelsLink: 'Every channel →',
} as const;

/* --- CTA ------------------------------------------------------------------ */
export const cta = {
  headline: { before: 'Bring the editor ', gradient: 'to the data', after: '.' },
  body: 'Open the live demo, or have your own Studio running next to your database in about a minute.',
  primary: { label: 'Open live demo', href: 'https://app.libredb.org' },
  secondary: { label: 'Deploy Studio', href: '#deploy' },
  repoLabel: 'github.com/libredb/libredb-studio ↗',
} as const;

/* --- footer --------------------------------------------------------------- */
const gh = 'https://github.com/libredb/libredb-studio';

export const footer = {
  blurb: 'The database editor that deploys next to your data. Open source under MIT — nothing held back.',
  groups: [
    {
      title: 'Product',
      links: [
        { label: 'Features', href: '/features' },
        { label: 'Databases', href: '/databases' },
        { label: 'How it compares', href: '/compare' },
        { label: 'Playground', href: '/playground' },
        { label: 'Live demo', href: 'https://app.libredb.org' },
      ],
    },
    {
      title: 'Deploy',
      links: [
        { label: 'Docker Compose', href: '/docker-compose' },
        { label: 'Every channel', href: '/deploy' },
        { label: 'Get started', href: '/get-started' },
        { label: 'Documentation', href: `${gh}/tree/main/docs` },
      ],
    },
    {
      title: 'Company',
      links: [
        { label: 'Open source', href: '/open-source' },
        { label: 'Supporters', href: '/supporters' },
        { label: 'Security model', href: '/security' },
        { label: 'Vendor support', href: '/support' },
        { label: 'LibreDB Platform', href: '/platform' },
        { label: 'Privacy', href: '/privacy-policy' },
      ],
    },
    {
      title: 'Projects',
      links: [
        { label: 'LibreDB Studio', href: gh },
        { label: 'LibreDB database', href: '/libredb-database' },
        { label: 'Blog', href: '/blog' },
        { label: 'FAQ', href: '/faq' },
      ],
    },
  ],
  /**
   * Not a fifth column, and not for want of room.
   *
   * These are not sections of the site — they are the same organisation
   * somewhere else. Ranking them beside Product and Deploy asked the reader to
   * scan a navigation column to find out we have a LinkedIn, and it pushed the
   * grid to a second row, which spent a band of empty page on the least
   * important links in the footer. They belong on the base line with the other
   * identity marks: the copyright and the version.
   */
  social: [
    { label: 'GitHub', href: gh },
    { label: 'X', href: 'https://x.com/libredb' },
    { label: 'LinkedIn', href: 'https://www.linkedin.com/company/libredb' },
    { label: 'YouTube', href: 'https://www.youtube.com/@libredb' },
    { label: 'Sponsor', href: 'https://github.com/sponsors/libredb' },
  ],
  legal: 'Copyright © 2026 LibreDB',
  versionChip: `◆ studio ${site.version}`,
} as const;
