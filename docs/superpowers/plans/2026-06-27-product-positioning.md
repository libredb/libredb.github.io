# Product Positioning & Website IA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the single-product (Studio) website into a brand-house site for three products — Studio (hero), the open-source Database engine (`/database` credibility trio), and the commercial Platform (light open-core presence) — without diluting Studio's prominence.

**Architecture:** The site is an Astro static "SQL IDE shell". `src/data/sections.ts` is the single source of truth; `[section].astro` generates a page per section, `Explorer.astro` renders the left tree, and section components under `src/components/sections/` render bodies inside `StudioShell` → `SectionShell`. We add a `schema` grouping layer (`schemas.ts` + a `schema` field on each section), rename `/databases`→`/providers`, add three `database` engine pages, three light Studio↔engine bridges, and a home open-core family block.

**Tech Stack:** Astro 6, Tailwind CSS 4, TypeScript, `bun test` (bun:test runner), `@astrojs/sitemap`.

## Global Constraints

- **Studio stays the hero.** Homepage hero (`HomeSection.astro` headline/CTAs) and primary nav weight are unchanged; new content is secondary/lower.
- **Database is pre-alpha, community-framed.** No production "Get Started" CTA on engine pages. CTAs are community only: GitHub star, npm, docs.
- **Platform is light.** A lean internal `/platform` overview page (narrative) whose CTA opens the live app; no pricing page on-site. (Revised mid-execution from external-link-only — see the spec's Platform section.) External links use `target="_blank" rel="noopener noreferrer"`.
- **Engine repo URLs (verbatim):** GitHub `https://github.com/libredb/libredb-database`; npm `https://www.npmjs.com/package/@libredb/libredb`; guides `https://github.com/libredb/libredb-database/tree/main/docs/guides`.
- **Platform URL (verbatim):** `https://platform.libredb.org` (live, beta).
- **Engine facts must stay honest** (sourced from the engine repo): pre-alpha `0.0.x`; one ordered key-value core + three lenses (kv/document/relational); zero runtime dependencies; ~712 lines of shipped code; `core.ts` under 600 lines; 2.83 kB bundled (min+brotli, 4 kB CI budget); 100% core line coverage; deterministic simulation testing; O(n) scans / no secondary indexes / single-process / RAM-bounded in v1.
- **Preserve Explorer data hooks.** Keep `data-explorer-item`, `data-explorer-toggle`, `data-explorer-cols`, `data-section-link`, `data-explorer-search` attributes intact (wired by `src/scripts/studio.ts`).
- **Per-task build check:** run `bunx astro build` (NOT `bun run build`) to verify compilation without triggering the docker-compose sync step that mutates tracked files. Tests: `bun test src/data/`.
- **Responsive:** wide content (code blocks, tables) must scroll inside `overflow-x-auto`; never break the page's horizontal layout.

---

### Task 1: Schema data model foundation

**Files:**
- Create: `src/data/schemas.ts`
- Modify: `src/data/sections.ts` (interface + add `schema: 'studio'` to all 9 sections)
- Test: `src/data/sections.test.ts`

**Interfaces:**
- Produces: `SchemaMeta` interface and `schemas: SchemaMeta[]` (ids `'studio' | 'database' | 'platform'`); `SectionMeta` gains required field `schema: 'studio' | 'database'`.
- Consumes: nothing (first task).

- [ ] **Step 1: Write the failing test**

Add to `src/data/sections.test.ts`:

```ts
import { schemas } from './schemas';

test('every section declares a schema of studio or database', () => {
  for (const s of sections) {
    expect(['studio', 'database']).toContain(s.schema);
  }
});

test('all existing (non-database) sections are schema "studio"', () => {
  const studioIds = ['home', 'features', 'compare', 'tech_stack', 'get_started', 'faq', 'deploy', 'docker_compose'];
  for (const id of studioIds) {
    expect(sectionById[id].schema).toBe('studio');
  }
});

test('schemas manifest has studio, database, platform in order', () => {
  expect(schemas.map((s) => s.id)).toEqual(['studio', 'database', 'platform']);
  const platform = schemas.find((s) => s.id === 'platform');
  expect(platform?.external?.href).toBe('https://platform.libredb.org');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/data/sections.test.ts`
Expected: FAIL — `Cannot find module './schemas'` (and `schema` undefined).

- [ ] **Step 3: Create `src/data/schemas.ts`**

```ts
// src/data/schemas.ts
// Schema grouping for the Explorer tree. One connection (libredb.org), three
// schemas: studio (production hero), database (pre-alpha engine), platform
// (commercial, external). Sections belong to studio or database; platform has
// no internal sections — only an external link.

export interface SchemaMeta {
  id: 'studio' | 'database' | 'platform';
  label: string;            // tree heading
  badge?: string;           // e.g. "pre-alpha", "beta · teams"
  badgeClass?: string;      // styling hook (Tailwind classes)
  external?: { label: string; href: string }; // platform: link row, no section
}

export const schemas: SchemaMeta[] = [
  { id: 'studio', label: 'studio' },
  {
    id: 'database',
    label: 'database',
    badge: '🧪 pre-alpha',
    badgeClass: 'text-warn border border-warn/40',
  },
  {
    id: 'platform',
    label: 'platform',
    badge: 'beta · teams',
    badgeClass: 'text-ai border border-ai/40',
    external: { label: 'overview', href: 'https://platform.libredb.org' },
  },
];
```

- [ ] **Step 4: Add `schema` to the `SectionMeta` interface**

In `src/data/sections.ts`, add to the `SectionMeta` interface (after `pageDescription: string;`):

```ts
  pageDescription: string;
  schema: 'studio' | 'database'; // Explorer grouping; platform has no sections
```

- [ ] **Step 5: Add `schema: 'studio'` to all 9 existing sections**

In `src/data/sections.ts`, add the line `schema: 'studio',` to each of these section objects (one line per object): `home`, `features`, `databases`, `compare`, `tech_stack`, `get_started`, `faq`, `deploy`, `docker_compose`. Example for `home`:

```ts
    slug: '',
    pageTitle: 'LibreDB Studio - AI-Powered Open-Source SQL IDE',
    pageDescription: 'LibreDB Studio - The Modern, AI-Powered Open-Source SQL IDE for Cloud-Native Teams',
    schema: 'studio',
  },
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `bun test src/data/sections.test.ts`
Expected: PASS (all tests, including the 3 new ones). The "every section declares a schema" test fails loudly if any of the 9 was missed.

- [ ] **Step 7: Commit**

```bash
git add src/data/schemas.ts src/data/sections.ts src/data/sections.test.ts
git commit -m "feat: add schema grouping data model (studio/database/platform)"
```

---

### Task 2: Rename `/databases` → `/providers`

**Files:**
- Modify: `src/data/sections.ts` (the `databases` section)
- Rename: `src/components/sections/DatabasesSection.astro` → `src/components/sections/ProvidersSection.astro`
- Modify: `src/pages/[section].astro` (import + COMPONENTS key)
- Modify: `astro.config.mjs` (301 redirect)
- Test: `src/data/sections.test.ts`

**Interfaces:**
- Consumes: `SectionMeta.schema` (Task 1).
- Produces: section id `'providers'`, slug `'providers'`; route `/providers`; redirect `/databases → /providers`.

- [ ] **Step 1: Write the failing test**

Add to `src/data/sections.test.ts`:

```ts
test('providers section replaces databases (id, slug, table)', () => {
  expect(sectionById['databases']).toBeUndefined();
  const p = sectionById['providers'];
  expect(p).toBeDefined();
  expect(p.slug).toBe('providers');
  expect(p.table).toBe('providers');
  expect(p.schema).toBe('studio');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/data/sections.test.ts`
Expected: FAIL — `sectionById['providers']` is undefined; `databases` still defined.

- [ ] **Step 3: Rename the section in `src/data/sections.ts`**

Replace the entire `databases` section object with:

```ts
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
```

- [ ] **Step 4: Rename the component file**

```bash
git mv src/components/sections/DatabasesSection.astro src/components/sections/ProvidersSection.astro
```

- [ ] **Step 5: Update `src/pages/[section].astro`**

Change the import line:

```astro
import ProvidersSection from '../components/sections/ProvidersSection.astro';
```

Change the `COMPONENTS` map key (remove `databases`, add `providers`):

```ts
const COMPONENTS: Record<string, any> = {
  features: FeaturesSection,
  providers: ProvidersSection,
  compare: CompareSection,
  tech_stack: TechStackSection,
  get_started: GetStartedSection,
  faq: FaqSection,
  deploy: DeploySection,
  docker_compose: DockerComposeSection,
};
```

- [ ] **Step 6: Add the 301 redirect in `astro.config.mjs`**

Add a `redirects` key to the `defineConfig` object (after `site:`):

```js
export default defineConfig({
  site: 'https://libredb.org',
  redirects: {
    '/databases': '/providers',
  },
  integrations: [sitemap({
    lastmod: new Date(),
  })],
```

- [ ] **Step 7: Run tests and build**

Run: `bun test src/data/sections.test.ts`
Expected: PASS.
Run: `bunx astro build`
Expected: build succeeds; `dist/providers/index.html` exists; `dist/databases/index.html` is a redirect page pointing to `/providers`.

Verify the redirect file:
Run: `grep -l "providers" dist/databases/index.html`
Expected: matches (redirect target present).

- [ ] **Step 8: Commit**

```bash
git add src/data/sections.ts src/components/sections/ProvidersSection.astro src/pages/[section].astro astro.config.mjs src/data/sections.test.ts
git commit -m "feat: rename /databases to /providers with 301 redirect"
```

---

### Task 3: Add LibreDB as a native provider (Usage B bridge)

**Files:**
- Modify: `src/components/sections/ProvidersSection.astro` (add 8th provider card)
- Modify: `src/data/sections.ts` (providers `rows` 7→8, explain unchanged from Task 2)

**Interfaces:**
- Consumes: `ProvidersSection.astro` (Task 2).
- Produces: nothing downstream.

- [ ] **Step 1: Add the LibreDB entry to the `databases` array in `ProvidersSection.astro`**

Append this object as the last item of the `databases: DB[]` array (after Redis):

```ts
  { name: 'LibreDB', type: 'embedded · our own', driver: '@libredb/libredb', color: 'text-ai', summary: 'Our own open-source embedded engine. Open a .libredb file directly — no server. Browse relational, document, and key-value lenses; query with a small get / put / prefix / range grammar (not SQL). Ships as a ready-to-use sample on first launch.' },
```

- [ ] **Step 2: Make the LibreDB card link to `/database`**

In `ProvidersSection.astro`, the cards are rendered by `{databases.map((d) => (<article ...>...))}`. Replace the `<article>` block so the LibreDB card links to the engine page while others stay static. Change the map body to:

```astro
    {databases.map((d) => (
      <article class="flex flex-col bg-panel p-5 transition-colors hover:bg-raised">
        <div class="flex items-baseline justify-between gap-3">
          <h3 class={`text-[16px] font-bold ${d.color}`}>
            {d.name === 'LibreDB'
              ? <a href="/database" class="hover:underline">{d.name} <span aria-hidden="true">→</span></a>
              : d.name}
          </h3>
          <span class="text-[11.5px] text-faint">{d.type} · {d.driver}</span>
        </div>
        <p class="mt-2 text-[13px] leading-relaxed text-dim">{d.summary}</p>
      </article>
    ))}
```

- [ ] **Step 3: Bump the providers row count in `src/data/sections.ts`**

In the `providers` section, change `rows: 7,` to `rows: 8,`.

- [ ] **Step 4: Verify build**

Run: `bunx astro build`
Expected: build succeeds. `dist/providers/index.html` contains "LibreDB" and the `/database` link.
Run: `grep -c 'href="/database"' dist/providers/index.html`
Expected: ≥ 1.

- [ ] **Step 5: Commit**

```bash
git add src/components/sections/ProvidersSection.astro src/data/sections.ts
git commit -m "feat: list LibreDB as a native embedded provider on /providers"
```

---

### Task 4: Database engine sections data

**Files:**
- Modify: `src/data/sections.ts` (add 3 `database` sections)
- Test: `src/data/sections.test.ts`

**Interfaces:**
- Consumes: `SectionMeta.schema` (Task 1).
- Produces: section ids `'database'` (slug `database`), `'database_architecture'` (slug `database-architecture`), `'database_reliability'` (slug `database-reliability`), all `schema: 'database'`. These ids must have COMPONENTS entries (Tasks 5–7).

- [ ] **Step 1: Write the failing test**

Add to `src/data/sections.test.ts`:

```ts
test('three database-schema sections exist with correct slugs', () => {
  const dbSections = sections.filter((s) => s.schema === 'database');
  expect(dbSections.map((s) => s.id).sort()).toEqual(
    ['database', 'database_architecture', 'database_reliability'].sort(),
  );
  expect(sectionById['database'].slug).toBe('database');
  expect(sectionById['database_architecture'].slug).toBe('database-architecture');
  expect(sectionById['database_reliability'].slug).toBe('database-reliability');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/data/sections.test.ts`
Expected: FAIL — database sections undefined.

- [ ] **Step 3: Append the 3 sections in `src/data/sections.ts`**

Add these objects to the `sections` array, immediately after the `providers` section object (so the Explorer renders them in order):

```ts
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
    explain: 'The LibreDB engine manifesto: a small, readable, embeddable multi-model database you can read in one sitting — multi-model without the magic. Pre-alpha; community-driven.',
    slug: 'database',
    pageTitle: 'LibreDB — the embedded, multimodal database you can read in one sitting',
    pageDescription: 'LibreDB is a small, readable, embeddable, multi-model database in TypeScript. One ordered key-value core, three lenses (key-value, document, relational), zero dependencies, every line tested. Open source (MIT), pre-alpha.',
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
    explain: 'How LibreDB works: one ordered byte key-value kernel with thin kv/document/relational lenses on top (FoundationDB pattern). The file boundary is the trust boundary, and the write-ahead log is the database.',
    slug: 'database-architecture',
    pageTitle: 'Architecture — LibreDB: one core, three lenses',
    pageDescription: 'Inside LibreDB: a single ordered key-value kernel with thin key-value, document, and relational lenses on top. The file boundary is the trust boundary; the write-ahead log is the only on-disk representation.',
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
    explain: 'Why you can trust a pre-alpha engine: a CRC-32 checksummed, fsync-before-commit write-ahead log, crash recovery proven by deterministic simulation testing, 100% core line coverage — plus an honest list of what it deliberately is NOT yet.',
    slug: 'database-reliability',
    pageTitle: 'Reliability — LibreDB crash recovery & deterministic simulation testing',
    pageDescription: 'LibreDB durability: a length-framed, CRC-32 checksummed write-ahead log fsync-d before commit, crash recovery proven by deterministic simulation testing, and 100% core line coverage. Honest about its v1 limits.',
    schema: 'database',
  },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/data/sections.test.ts`
Expected: PASS for the new test. NOTE: `bunx astro build` will still FAIL until Tasks 5–7 add COMPONENTS entries — that is expected; do not build yet.

- [ ] **Step 5: Commit**

```bash
git add src/data/sections.ts src/data/sections.test.ts
git commit -m "feat: add database engine sections data (manifesto, architecture, reliability)"
```

---

### Task 5: Database manifesto page + shared CTA footer

**Files:**
- Create: `src/components/sections/DatabaseCtaFooter.astro` (shared by Tasks 5–7)
- Create: `src/components/sections/DatabaseSection.astro`
- Modify: `src/pages/[section].astro` (import + COMPONENTS key `database`)
- Modify: `src/data/section-seo.ts` (JSON-LD for `database`)

**Interfaces:**
- Consumes: section id `'database'` (Task 4); `SectionHeader.astro` (existing).
- Produces: `DatabaseCtaFooter.astro` (no props) reused by architecture & reliability pages; COMPONENTS entry `database`.

- [ ] **Step 1: Create the shared CTA footer `src/components/sections/DatabaseCtaFooter.astro`**

```astro
---
// Shared honest status box + community CTAs for all three /database pages.
// Community framing ONLY — no production "Get Started".
const GH = 'https://github.com/libredb/libredb-database';
const NPM = 'https://www.npmjs.com/package/@libredb/libredb';
const DOCS = 'https://github.com/libredb/libredb-database/tree/main/docs/guides';
---
<div class="mt-10 border border-warn/40 bg-panel p-6">
  <h3 class="flex items-center gap-2 text-[15px] font-bold text-warn">
    <span aria-hidden="true">🧪</span> Pre-alpha — not production ready
  </h3>
  <p class="mt-2 max-w-2xl text-[13.5px] leading-relaxed text-dim">
    LibreDB is early (<code class="text-fg">0.0.x</code>). The architecture is in place and every line
    of the core is tested, but the API may still change and it is not yet meant for production data.
    Star it, follow along, and help shape it.
  </p>
  <div class="mt-5 flex flex-col gap-3 sm:flex-row">
    <a href={GH} target="_blank" rel="noopener noreferrer"
       class="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-5 py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-primary-bright">
      <span aria-hidden="true">★</span> Star on GitHub
    </a>
    <a href={NPM} target="_blank" rel="noopener noreferrer"
       class="inline-flex items-center justify-center gap-2 rounded-md border border-edge-strong bg-panel px-5 py-2.5 text-[14px] font-semibold text-fg transition-colors hover:border-line hover:bg-raised">
      npm: @libredb/libredb
    </a>
    <a href={DOCS} target="_blank" rel="noopener noreferrer"
       class="inline-flex items-center justify-center gap-2 rounded-md border border-edge-strong bg-panel px-5 py-2.5 text-[14px] font-semibold text-fg transition-colors hover:border-line hover:bg-raised">
      Read the guides <span aria-hidden="true">→</span>
    </a>
  </div>
</div>
```

- [ ] **Step 2: Create `src/components/sections/DatabaseSection.astro`**

```astro
---
import SectionHeader from './SectionHeader.astro';
import DatabaseCtaFooter from './DatabaseCtaFooter.astro';

const principles = [
  { name: 'Simple', stance: 'Against the database experience that forces you into a giant ORM, an admin panel, and a vendor ecosystem just to manage your own data. Not at war with ORMs — at war with being forced into one.' },
  { name: 'No magic', stance: 'The query is visible. The schema is visible. Errors are not hidden. Plans are explained. No unnecessary veil between data and developer.' },
  { name: 'Readable', stance: 'Small enough to read in one sitting. The kernel is under 600 lines. Readability is not marketing — it is a design constraint.' },
  { name: 'Embeddable', stance: 'bun add @libredb/libredb and go. Zero runtime dependencies, in-process, nothing else to install or run.' },
  { name: 'Multi-model', stance: 'One ordered key-value core; key-value, document, and relational are thin lenses over it — not three engines bolted together.' },
  { name: 'Reliable', stance: 'Readable does not mean toy. Every line of the core is tested; crash recovery is proven by deterministic simulation testing.' },
];
---
<div class="mx-auto max-w-5xl">
  <!-- Pre-alpha badge -->
  <span class="inline-flex items-center gap-2 rounded-full border border-warn/40 px-3 py-1 text-[12.5px] text-warn">
    <span aria-hidden="true">🧪</span> Pre-alpha · open source (MIT)
  </span>

  <!-- Hero -->
  <h1 class="mt-6 text-3xl font-extrabold leading-[1.1] tracking-tight text-bright sm:text-4xl lg:text-5xl">
    The embedded, multimodal database<br class="hidden sm:block" />
    you can <span class="text-primary">read in one sitting.</span>
  </h1>
  <p class="mt-5 max-w-2xl text-[15px] leading-relaxed text-muted">
    <strong class="font-semibold text-fg">Multi-model without the magic.</strong>
    One core, three lenses, every line tested. A small, readable, embeddable database in TypeScript —
    built on one idea: a database can be powerful and still be understood by opening its source.
  </p>

  <!-- The wedge (featured callout) -->
  <div class="mt-8 border-l-2 border-primary bg-panel p-5">
    <p class="text-[15px] font-semibold text-bright">
      Competes with the database textbook and the “I’ll just use a <code class="text-primary">Map</code> for now” hack —
      not with Postgres.
    </p>
    <p class="mt-2 text-[13.5px] text-dim">The database you read, learn from, hack on, and embed fast.</p>
  </div>

  <!-- Manifesto principles -->
  <div class="mt-10">
    <SectionHeader title="What we are building" subtitle="Strength comes not from what we add, but from what we deliberately refuse." />
    <div class="grid grid-cols-1 gap-px overflow-hidden border border-edge bg-edge sm:grid-cols-2">
      {principles.map((p) => (
        <article class="flex flex-col bg-panel p-5">
          <h3 class="text-[15px] font-bold text-primary">{p.name}</h3>
          <p class="mt-2 text-[13px] leading-relaxed text-dim">{p.stance}</p>
        </article>
      ))}
    </div>
  </div>

  <!-- Embed snippet (Usage A) -->
  <div class="mt-10">
    <SectionHeader title="Embed it in an afternoon" subtitle="The same database speaks all three lenses — here they are in one file." />
    <div class="overflow-x-auto border border-edge bg-canvas">
      <pre class="p-4 text-[12.5px] leading-relaxed text-fg"><code>{`bun add @libredb/libredb

import { open, kv, doc, table } from "@libredb/libredb";

// In-memory for tests, or open({ path: "data.libredb" }) for a durable file.
const db = open();

// 1. Key-value — a durable, ordered, string-keyed map.
kv(db).set("user:1", "Ada");

// 2. Document — a collection of JSON documents.
doc(db, "logs").put("l1", { level: "info", at: 1 });

// 3. Relational — a schema-validated, typed table.
const users = table(db, "users", {
  primaryKey: "id",
  columns: { id: "string", name: "string", age: "number" },
});
users.insert({ id: "1", name: "Ada", age: 36 });
users.where({ name: "Ada" }).select("id", "age").toArray();`}</code></pre>
    </div>
  </div>

  <!-- One core, three faces + reverse bridge to Studio -->
  <div class="mt-10 border border-edge bg-panel p-6">
    <h3 class="text-[16px] font-bold text-bright">One core, three faces</h3>
    <p class="mt-2 max-w-2xl text-[13.5px] leading-relaxed text-dim">
      LibreDB <strong class="text-fg">Database</strong> is the plain core of data.
      LibreDB <strong class="text-fg">Studio</strong> is the understandable face of data.
      LibreDB <strong class="text-fg">Platform</strong> is the manageable form of data for teams.
      All three speak the same spine.
    </p>
    <p class="mt-4 text-[13.5px] text-dim">
      Want to see it live? <a href="/" class="text-primary hover:underline">LibreDB Studio</a> opens with a
      ready-to-use LibreDB sample — all three lenses, zero setup.
    </p>
  </div>

  <DatabaseCtaFooter />
</div>
```

- [ ] **Step 3: Wire the component into `src/pages/[section].astro`**

Add the import:

```astro
import DatabaseSection from '../components/sections/DatabaseSection.astro';
```

Add to the `COMPONENTS` map:

```ts
  database: DatabaseSection,
```

- [ ] **Step 4: Add JSON-LD for the manifesto page in `src/data/section-seo.ts`**

Add a `database` key to the `sectionSeo` object (alongside `deploy` and `docker_compose`):

```ts
  database: [
    {
      '@context': 'https://schema.org',
      '@type': 'SoftwareSourceCode',
      name: 'LibreDB',
      description: 'A small, readable, embeddable, multi-model database in TypeScript. One ordered key-value core, three lenses, zero dependencies, every line tested.',
      programmingLanguage: 'TypeScript',
      codeRepository: 'https://github.com/libredb/libredb-database',
      license: 'https://opensource.org/licenses/MIT',
    },
    {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'LibreDB',
      applicationCategory: 'DeveloperApplication',
      operatingSystem: 'Cross-platform (Bun, Node 22+)',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      softwareVersion: 'pre-alpha (0.0.x)',
    },
  ],
```

- [ ] **Step 5: Verify build**

Run: `bunx astro build`
Expected: build succeeds; `dist/database/index.html` exists and contains "Multi-model without the magic" and the JSON-LD `SoftwareSourceCode`.
Run: `grep -c 'SoftwareSourceCode' dist/database/index.html`
Expected: ≥ 1.

- [ ] **Step 6: Commit**

```bash
git add src/components/sections/DatabaseCtaFooter.astro src/components/sections/DatabaseSection.astro src/pages/[section].astro src/data/section-seo.ts
git commit -m "feat: add /database manifesto page with embed snippet and community CTAs"
```

---

### Task 6: Database architecture page

**Files:**
- Create: `src/components/sections/DatabaseArchitectureSection.astro`
- Modify: `src/pages/[section].astro` (import + COMPONENTS key `database_architecture`)

**Interfaces:**
- Consumes: section id `'database_architecture'` (Task 4); `DatabaseCtaFooter.astro` (Task 5); `SectionHeader.astro`.

- [ ] **Step 1: Create `src/components/sections/DatabaseArchitectureSection.astro`**

```astro
---
import SectionHeader from './SectionHeader.astro';
import DatabaseCtaFooter from './DatabaseCtaFooter.astro';

const lenses = [
  { name: 'kv', tag: 'the proof', desc: 'The ordered key-value core, usable directly. A durable, ordered, string-keyed map — the thinnest possible lens.' },
  { name: 'document', tag: 'the differentiator', desc: 'Collections of JSON documents under string ids, with by-id CRUD and an in-engine find() predicate.' },
  { name: 'relational', tag: 'the reach', desc: 'Schema-validated typed tables with where / select / join — a relational view, deliberately not a SQL engine.' },
];
---
<div class="mx-auto max-w-5xl">
  <SectionHeader
    title="One core, three lenses"
    subtitle="LibreDB follows the FoundationDB pattern: one small ordered key-value core, with thin model lenses on top."
  />

  <!-- The lenses -->
  <div class="grid grid-cols-1 gap-px overflow-hidden border border-edge bg-edge sm:grid-cols-3">
    {lenses.map((l) => (
      <article class="flex flex-col bg-panel p-5">
        <div class="flex items-baseline justify-between gap-2">
          <h3 class="text-[15px] font-bold text-primary">{l.name}</h3>
          <span class="text-[11px] text-faint">{l.tag}</span>
        </div>
        <p class="mt-2 text-[13px] leading-relaxed text-dim">{l.desc}</p>
      </article>
    ))}
  </div>

  <!-- The stack diagram (drawn in the site's aesthetic; no imported PNGs) -->
  <div class="mt-6 overflow-x-auto border border-edge bg-canvas">
    <pre class="p-4 text-[12px] leading-relaxed text-dim"><code>{`        kv      document      relational      ← lenses (open edge)
         \\         |             /
          \\        |            /
           +--------+----------+
                    |  one narrow transact() port
        ============|=====================  TRUST BOUNDARY
                    |
              core.ts  ← the kernel (guarded)
              ordered KV · txns · WAL · recovery
                    |
              FileSystem seam (node:fs, or SimFS for crash tests)`}</code></pre>
  </div>

  <!-- Trust boundary -->
  <div class="mt-10">
    <SectionHeader title="The file boundary is the trust boundary" subtitle="" />
    <div class="grid grid-cols-1 gap-px overflow-hidden border border-edge bg-edge sm:grid-cols-2">
      <article class="flex flex-col bg-panel p-5">
        <h3 class="text-[15px] font-bold text-warn">Below the line — guarded</h3>
        <p class="mt-2 text-[13px] leading-relaxed text-dim">
          <code class="text-fg">core.ts</code> is where data can be corrupted, so every line passes heavy review
          and deterministic crash tests. It stays small because it is genuinely minimal.
        </p>
      </article>
      <article class="flex flex-col bg-panel p-5">
        <h3 class="text-[15px] font-bold text-ok">Above the line — open</h3>
        <p class="mt-2 text-[13px] leading-relaxed text-dim">
          Lenses, query surface, and catalog are open and fast to contribute to — the worst a bug can do is present
          a bad view; it reaches the store only through one narrow port.
        </p>
      </article>
    </div>
  </div>

  <!-- The WAL is the database -->
  <div class="mt-10 border-l-2 border-primary bg-panel p-5">
    <h3 class="text-[15px] font-bold text-bright">The WAL <em>is</em> the database</h3>
    <p class="mt-2 max-w-2xl text-[13.5px] leading-relaxed text-dim">
      Most databases keep a write-ahead log separate from data files. LibreDB does not: the file you open
      <em>is</em> the sequence of every committed transaction, replayed into an in-memory sorted array on open.
      No separate data file, no buffer pool — the same lineage as Redis AOF mode. Two boxes instead of three,
      which is how the kernel stays small enough to understand.
    </p>
  </div>

  <DatabaseCtaFooter />
</div>
```

- [ ] **Step 2: Wire into `src/pages/[section].astro`**

Add the import:

```astro
import DatabaseArchitectureSection from '../components/sections/DatabaseArchitectureSection.astro';
```

Add to the `COMPONENTS` map:

```ts
  database_architecture: DatabaseArchitectureSection,
```

- [ ] **Step 3: Verify build**

Run: `bunx astro build`
Expected: build succeeds; `dist/database-architecture/index.html` exists and contains "One core, three lenses".

- [ ] **Step 4: Commit**

```bash
git add src/components/sections/DatabaseArchitectureSection.astro src/pages/[section].astro
git commit -m "feat: add /database-architecture page (one core, three lenses)"
```

---

### Task 7: Database reliability page

**Files:**
- Create: `src/components/sections/DatabaseReliabilitySection.astro`
- Modify: `src/pages/[section].astro` (import + COMPONENTS key `database_reliability`)

**Interfaces:**
- Consumes: section id `'database_reliability'` (Task 4); `DatabaseCtaFooter.astro` (Task 5); `SectionHeader.astro`.

- [ ] **Step 1: Create `src/components/sections/DatabaseReliabilitySection.astro`**

```astro
---
import SectionHeader from './SectionHeader.astro';
import DatabaseCtaFooter from './DatabaseCtaFooter.astro';

const numbers = [
  { n: '~712', l: 'lines of shipped code', cls: 'text-primary' },
  { n: '0', l: 'runtime dependencies', cls: 'text-ok' },
  { n: '2.83 kB', l: 'bundled (min+brotli)', cls: 'text-ai' },
  { n: '100%', l: 'core line coverage', cls: 'text-warn' },
];

const notForYet = [
  { area: 'Production at scale', why: 'It is pre-alpha; today’s beachhead is test/dev.' },
  { area: 'Secondary indexes / planner', why: 'Queries are O(n) scans by design in v1 (on the roadmap).' },
  { area: 'Concurrent / networked access', why: 'It is embedded and single-process — no replication or client/server.' },
  { area: 'SQL wire compatibility', why: 'No SQL text, no existing-driver ecosystem — a relational view, not a SQL engine.' },
];
---
<div class="mx-auto max-w-5xl">
  <SectionHeader
    title="Crash recovery you can trust"
    subtitle="Readable does not mean toy. We earn trust through tests, not line counts."
  />

  <!-- The numbers -->
  <div class="grid grid-cols-2 border border-edge sm:grid-cols-4">
    {numbers.map((s, i) => (
      <div class:list={[
        'px-5 py-6',
        i % 2 === 0 ? 'border-r border-edge' : '',
        i < 2 ? 'border-b border-edge sm:border-b-0' : '',
        i === 3 ? 'sm:border-r-0' : 'sm:border-r',
      ]}>
        <div class={`text-2xl font-bold ${s.cls}`}>{s.n}</div>
        <div class="mt-1 text-[12.5px] text-dim">{s.l}</div>
      </div>
    ))}
  </div>

  <!-- Durability + DST -->
  <div class="mt-10 grid grid-cols-1 gap-px overflow-hidden border border-edge bg-edge sm:grid-cols-2">
    <article class="flex flex-col bg-panel p-5">
      <h3 class="text-[15px] font-bold text-bright">A write-ahead log, fsync-d before commit</h3>
      <p class="mt-2 text-[13px] leading-relaxed text-dim">
        A transaction that returns has been written to a length-framed, CRC-32 checksummed log and fsync-d
        <em>before</em> the commit becomes visible. A crash can only ever damage the last, un-fsync-d record —
        which recovery detects and truncates, leaving a valid committed prefix.
      </p>
    </article>
    <article class="flex flex-col bg-panel p-5">
      <h3 class="text-[15px] font-bold text-bright">Deterministic simulation testing</h3>
      <p class="mt-2 text-[13px] leading-relaxed text-dim">
        The crash/recovery path is proven by running the real engine against a seeded in-memory filesystem that
        tears, corrupts, and crashes the log on command — then checking that recovery is always a valid committed
        prefix. The FoundationDB-style approach that keeps the durability claims honest.
      </p>
    </article>
  </div>

  <!-- When NOT to use (honest limits) -->
  <div class="mt-10">
    <SectionHeader title="When NOT to use it (yet)" subtitle="These limits are deliberate v1 scope, not hidden gaps. LibreDB’s strength comes from what it refuses." />
    <div class="overflow-x-auto border border-edge">
      <table class="w-full text-left text-[13px]">
        <thead class="bg-panel text-faint">
          <tr>
            <th class="px-4 py-2 font-semibold">You need…</th>
            <th class="px-4 py-2 font-semibold">Why not yet</th>
          </tr>
        </thead>
        <tbody>
          {notForYet.map((r) => (
            <tr class="border-t border-edge">
              <td class="px-4 py-2.5 font-medium text-fg">{r.area}</td>
              <td class="px-4 py-2.5 text-dim">{r.why}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>

  <DatabaseCtaFooter />
</div>
```

- [ ] **Step 2: Wire into `src/pages/[section].astro`**

Add the import:

```astro
import DatabaseReliabilitySection from '../components/sections/DatabaseReliabilitySection.astro';
```

Add to the `COMPONENTS` map:

```ts
  database_reliability: DatabaseReliabilitySection,
```

- [ ] **Step 3: Verify build**

Run: `bunx astro build`
Expected: build succeeds; `dist/database-reliability/index.html` exists and contains "Crash recovery you can trust". All four database/provider routes now build.

- [ ] **Step 4: Commit**

```bash
git add src/components/sections/DatabaseReliabilitySection.astro src/pages/[section].astro
git commit -m "feat: add /database-reliability page (DST, durability, honest limits)"
```

---

### Task 8: Explorer schema grouping

**Files:**
- Modify: `src/components/studio/Explorer.astro`

**Interfaces:**
- Consumes: `schemas` (Task 1), `sections` with `schema` field (Task 1/4).
- Produces: a three-schema grouped tree. Preserves all `data-*` hooks.

- [ ] **Step 1: Update the imports in `Explorer.astro` frontmatter**

Replace the frontmatter import block with:

```astro
---
import { sections } from '../../data/sections';
import { schemas } from '../../data/schemas';

interface Props {
  active?: string;
  idPrefix?: string; // to keep ids unique between desktop sidebar & mobile drawer
  showConnectionsLabel?: boolean;
}
const { active = 'home', idPrefix = 'exp', showConnectionsLabel = true } = Astro.props;
const internalCount = sections.length; // total internal sections across schemas
---
```

- [ ] **Step 2: Replace the `<nav>` tree block**

Replace the entire `<nav class="flex-1 ...">...</nav>` element with the following (this preserves every `data-*` hook and the column sub-lists, and adds per-schema headings + badges + the platform external row):

```astro
  <!-- Tree -->
  <nav class="flex-1 overflow-y-auto px-2 pb-3" aria-label="Schema explorer">
    {schemas.map((schema) => (
      <div class="mb-1">
        <div class="flex items-center gap-1.5 px-2 py-1 text-muted">
          <span aria-hidden="true">▾</span><span aria-hidden="true">▦</span>
          <span>{schema.label}</span>
          {schema.badge && (
            <span class:list={['ml-1 rounded px-1.5 text-[10px] uppercase tracking-wide', schema.badgeClass]}>
              {schema.badge}
            </span>
          )}
        </div>

        {schema.external ? (
          <ul class="mt-0.5">
            <li>
              <a
                href={schema.external.href}
                target="_blank"
                rel="noopener noreferrer"
                class="exp-row group flex items-center justify-between gap-2 py-1.5 pl-8 pr-3"
              >
                <span class="flex items-center gap-2 truncate text-muted">
                  <span class="text-dim" aria-hidden="true">↗</span>
                  <span class="truncate">{schema.external.label}</span>
                </span>
                <span class="text-[11px] text-faint" aria-hidden="true">↗</span>
              </a>
            </li>
          </ul>
        ) : (
          <ul class="mt-0.5">
            {sections.filter((s) => s.schema === schema.id).map((s) => (
              <li data-explorer-item={s.id}>
                <div class:list={['exp-row group flex items-center gap-1 pr-2', active === s.id && 'active']}>
                  <button
                    type="button"
                    class="flex h-7 w-5 shrink-0 items-center justify-center text-faint hover:text-fg"
                    aria-expanded="false"
                    aria-label={`Toggle ${s.table} columns`}
                    aria-controls={`${idPrefix}-cols-${s.id}`}
                    data-explorer-toggle={s.id}
                  >
                    <span class="caret-icon" aria-hidden="true">▸</span>
                  </button>
                  <a
                    href={s.slug === '' ? '/' : `/${s.slug}`}
                    class="flex flex-1 items-center justify-between gap-2 py-1.5 pl-0.5 pr-1"
                    data-section-link={s.id}
                  >
                    <span class="flex items-center gap-2 truncate">
                      <span class="text-dim" aria-hidden="true">▤</span>
                      <span class="truncate">{s.table}</span>
                    </span>
                    <span class="text-[11px] text-faint">{s.rows}</span>
                  </a>
                </div>
                <ul class="hidden pl-9 pb-1" id={`${idPrefix}-cols-${s.id}`} data-explorer-cols={s.id}>
                  {s.columns.map((c) => (
                    <li class="flex items-center justify-between py-1 pr-3 text-[12px]">
                      <span class="flex items-center gap-2 text-muted">
                        <span class="text-primary/70" aria-hidden="true">◆</span>{c.name}
                      </span>
                      <span class="text-[10.5px] uppercase tracking-wide text-faint">{c.type}</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </div>
    ))}
  </nav>
```

- [ ] **Step 3: Update the Explorer header count badge**

The header badge currently reads `{sections.length}`. Leave it as `{internalCount}` (defined in Step 1, same value — total internal sections). Replace `{sections.length}` with `{internalCount}` in the "Explorer header" block.

- [ ] **Step 4: Verify build and that search hooks survive**

Run: `bunx astro build`
Expected: build succeeds.
Run: `grep -c 'data-explorer-item' dist/index.html`
Expected: ≥ 11 (9 studio + 3 database = 12 items appear twice — desktop + mobile drawer — so expect ≥ 22; any value ≥ 11 confirms the hooks render). 
Run: `grep -c 'platform.libredb.org' dist/index.html`
Expected: ≥ 1 (external row present).

- [ ] **Step 5: Manual smoke check (dev server)**

Run: `bunx astro dev` and open `http://localhost:4321/`. Confirm: three schema headings (studio, database 🧪 pre-alpha, platform beta · teams); database group lists manifesto/architecture/reliability; platform row opens `platform.libredb.org` in a new tab; the explorer search box still filters items; caret toggles still expand column lists. Stop the server when done.

- [ ] **Step 6: Commit**

```bash
git add src/components/studio/Explorer.astro
git commit -m "feat: group Explorer tree by schema (studio/database/platform)"
```

---

### Task 9: Home open-core family block + sample teaser

**Files:**
- Modify: `src/components/sections/HomeSection.astro`

**Interfaces:**
- Consumes: nothing new. Adds a secondary block below the existing hero (hero unchanged — Global Constraint).

- [ ] **Step 1: Add the family block to `HomeSection.astro`**

In `HomeSection.astro`, insert this block immediately BEFORE the closing `</div>` of the outer `<div class="mx-auto max-w-5xl px-1">` wrapper (i.e. after the "Hint" `<p>` and before the final `</div>`). Do NOT modify the headline, subtitle, CTAs, or stats above it.

```astro
  <!-- The LibreDB family / open-core (secondary; Studio stays the hero above) -->
  <div class="mt-12 border-t border-edge pt-8">
    <p class="text-[11px] uppercase tracking-wider text-faint">The LibreDB family — one spine, three faces</p>
    <div class="mt-4 grid grid-cols-1 gap-px overflow-hidden border border-edge bg-edge sm:grid-cols-3">
      <a href="/database" class="flex flex-col bg-panel p-5 transition-colors hover:bg-raised">
        <div class="flex items-baseline justify-between gap-2">
          <h3 class="text-[15px] font-bold text-fg">database</h3>
          <span class="text-[10.5px] text-warn">OSS · pre-alpha</span>
        </div>
        <p class="mt-2 text-[12.5px] leading-relaxed text-dim">The plain core — an embedded, multimodal engine you can read in one sitting.</p>
      </a>
      <a href="/" class="flex flex-col bg-raised p-5 ring-1 ring-inset ring-primary/40">
        <div class="flex items-baseline justify-between gap-2">
          <h3 class="text-[15px] font-bold text-primary">studio</h3>
          <span class="text-[10.5px] text-ok">OSS · stable</span>
        </div>
        <p class="mt-2 text-[12.5px] leading-relaxed text-dim">The readable face — the AI-powered SQL IDE for every database. <span class="text-primary">← you are here</span></p>
      </a>
      <a href="https://platform.libredb.org" target="_blank" rel="noopener noreferrer" class="flex flex-col bg-panel p-5 transition-colors hover:bg-raised">
        <div class="flex items-baseline justify-between gap-2">
          <h3 class="text-[15px] font-bold text-ai">platform <span aria-hidden="true">↗</span></h3>
          <span class="text-[10.5px] text-ai">beta</span>
        </div>
        <p class="mt-2 text-[12.5px] leading-relaxed text-dim">Managed for teams — Database Access Governance: authorized, audited, multi-tenant.</p>
      </a>
    </div>
    <p class="mt-4 text-[13px] leading-relaxed text-dim">
      <span class="sql-com">-- open core: Studio is free &amp; open; Platform funds the open-source work.</span><br />
      <span class="sql-com">-- Studio opens live with a ready-to-use LibreDB sample across all three lenses, zero setup.</span>
    </p>
  </div>
```

- [ ] **Step 2: Verify build**

Run: `bunx astro build`
Expected: build succeeds; `dist/index.html` contains "The LibreDB family" and links to `/database` and `platform.libredb.org`.

- [ ] **Step 3: Commit**

```bash
git add src/components/sections/HomeSection.astro
git commit -m "feat: add open-core family block + sample teaser to home"
```

---

### Task 10: Features zero-setup sample card

**Files:**
- Modify: `src/components/sections/FeaturesSection.astro` (add 18th card)
- Modify: `src/data/sections.ts` (`features` rows 17→18, explain text)

**Interfaces:**
- Consumes: nothing new.

- [ ] **Step 1: Add the sample card to the `features` array in `FeaturesSection.astro`**

Append this object as the last item of the `features: Feature[]` array (after 'DBA Toolkit'):

```ts
  { name: 'Opens Ready-to-Use', category: 'CORE', summary: 'No empty screen on first launch — Studio ships with a live Sample (LibreDB) connection powered by our open-source embedded engine. Explore relational, document, and key-value side by side, no server required. Editable, deletable, off by one env flag.' },
```

- [ ] **Step 2: Update the `features` row count and explain in `src/data/sections.ts`**

In the `features` section: change `rows: 17,` to `rows: 18,`, and change the `explain` to:

```ts
    explain: 'Lists 18 capabilities grouped by area — from the Monaco SQL editor and NL2SQL Copilot to data masking, the DBA toolkit, and a zero-setup embedded LibreDB sample on first launch.',
```

- [ ] **Step 3: Verify build**

Run: `bunx astro build`
Expected: build succeeds; `dist/features/index.html` contains "Opens Ready-to-Use".

- [ ] **Step 4: Commit**

```bash
git add src/components/sections/FeaturesSection.astro src/data/sections.ts
git commit -m "feat: add zero-setup LibreDB sample feature card"
```

---

### Task 11: Header & Footer navigation

**Files:**
- Modify: `src/components/Header.astro`
- Modify: `src/components/Footer.astro`

**Interfaces:**
- Consumes: routes `/providers`, `/database` (Tasks 2, 5).

- [ ] **Step 1: Update Header nav links in `src/components/Header.astro`**

Replace the desktop navigation block (the `<div class="hidden md:flex items-center gap-8">` group) with:

```astro
      <div class="hidden md:flex items-center gap-8">
        <a href="/features" class="text-muted hover:text-fg transition-colors text-sm font-medium">Features</a>
        <a href="/providers" class="text-muted hover:text-fg transition-colors text-sm font-medium">Providers</a>
        <a href="/database" class="text-muted hover:text-fg transition-colors text-sm font-medium">Database <span class="text-warn">🧪</span></a>
        <a href="/deploy" class="text-muted hover:text-fg transition-colors text-sm font-medium">Deploy</a>
        <a href="https://platform.libredb.org" target="_blank" rel="noopener noreferrer" class="text-muted hover:text-fg transition-colors text-sm font-medium">Platform <span aria-hidden="true">↗</span></a>
      </div>
```

(Tech Stack and Get Started are dropped from the top nav to make room; they remain reachable via the Explorer and their routes are unchanged.)

- [ ] **Step 2: Update Footer "Product" link group in `src/components/Footer.astro`**

In the `sections` array, replace the `product` group's `links` with (rename Databases→Providers; add Database + Platform):

```ts
    links: [
      { label: "Features", href: "/features" },
      { label: "Providers", href: "/providers" },
      { label: "Database (pre-alpha)", href: "/database" },
      { label: "Platform (beta)", href: "https://platform.libredb.org", external: true },
      { label: "Tech Stack", href: "/tech-stack" },
      { label: "Deploy", href: "/deploy" },
      { label: "Live Demo", href: "https://app.libredb.org", external: true },
    ],
```

- [ ] **Step 3: Verify build**

Run: `bunx astro build`
Expected: build succeeds; `dist/index.html` header contains `href="/providers"`, `href="/database"`, and `platform.libredb.org`; no `href="/databases"` remains in nav.
Run: `grep -c 'href="/databases"' dist/index.html`
Expected: `0`.

- [ ] **Step 4: Commit**

```bash
git add src/components/Header.astro src/components/Footer.astro
git commit -m "feat: update header & footer nav for providers, database, platform"
```

---

### Task 12: Full verification & cleanup

**Files:**
- No source changes — integration verification only.

**Interfaces:**
- Consumes: all prior tasks.

- [ ] **Step 1: Run the full test suite**

Run: `bun test src/data/`
Expected: PASS (all tests green, including the new schema/providers/database assertions).

- [ ] **Step 2: Run the real production build**

Run: `bun run build`
Expected: build succeeds (this runs `scripts/sync-docker-compose.mjs` then `astro build`). Note: this step mutates the tracked `docker-compose.example.yml` file(s) by design.

- [ ] **Step 3: Verify all new routes and the redirect exist in `dist/`**

Run:
```bash
ls dist/providers/index.html dist/database/index.html dist/database-architecture/index.html dist/database-reliability/index.html dist/databases/index.html
```
Expected: all five exist (`dist/databases/index.html` is the redirect page → `/providers`).

- [ ] **Step 4: Confirm Studio is still the hero (no regressions)**

Run: `grep -c 'The Modern' dist/index.html`
Expected: ≥ 1 (the Studio hero headline is intact on home).

- [ ] **Step 5: Revert build-mutated compose files**

Run:
```bash
git checkout -- $(git diff --name-only | grep 'docker-compose.example.yml')
```
Expected: working tree clean except intended source changes (verify with `git status`).

- [ ] **Step 6: Final commit (if any non-compose changes remain) and branch summary**

```bash
git status
# If nothing remains to commit, the feature is complete on this branch.
```

---

## Self-Review

**Spec coverage:**
- Namespace collision `/databases`→`/providers` + 301 → Task 2. ✅
- Engine home `/database` (3-table credibility trio: manifesto/architecture/reliability) → Tasks 4–7. ✅
- Schema grouping (`schemas.ts`, `SectionMeta.schema`, Explorer by schema, platform external) → Tasks 1, 8. ✅
- Bridge 1 (Studio→engine): features sample card → Task 10; home family block + teaser → Task 9. ✅
- Bridge 2 (engine→Studio reverse link) → in DatabaseSection (Task 5). ✅
- Bridge 3 (`/providers` LibreDB native entry, Usage B) → Task 3. ✅
- Usage A embed snippet on `/database` → Task 5. ✅
- Platform: open-core family block (Task 9) + nav (Task 11); lean internal `/platform` page with CTA→app + Explorer `↗ open app` row (added post-plan, Task 13). No on-site pricing. ✅
- SEO: 301 redirect (Task 2), `database` JSON-LD (Task 5). ✅
- Header/Footer updates → Task 11. ✅
- Tests updated → Tasks 1, 2, 4; full run Task 12. ✅
- Studio stays hero (hero/home untouched; checked) → Global Constraint + Task 12 Step 4. ✅

**Placeholder scan:** No TBD/TODO; every code step contains full content. ✅

**Type consistency:** `SchemaMeta` / `schemas` (Task 1) consumed by Explorer (Task 8) and the platform test (Task 1). `SectionMeta.schema` added in Task 1, set on all sections in Tasks 1/2/4, read in Task 8. Section ids `providers`, `database`, `database_architecture`, `database_reliability` defined in Tasks 2/4 and mapped in COMPONENTS in Tasks 2/5/6/7 — names match exactly. `DatabaseCtaFooter` (Task 5) imported by Tasks 5/6/7 with the same path. ✅
