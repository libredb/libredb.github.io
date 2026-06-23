# Multi-Page Studio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn each Explorer "table" into its own real, indexable URL (incl. `/docker-compose-example` as a 9th table), navigated via Astro View Transitions, removing the in-page hash swap — while keeping the IDE shell and all interactions identical.

**Architecture:** Builds on `StudioShell.astro` (single-section shell) from the deploy-unify branch. A single dynamic route `src/pages/[section].astro` generates every non-home section page from a slug manifest; `index.astro` is `/` (home). Explorer links become real URLs. `studio.ts` drops the swap/hash engine and re-wires per navigation via `astro:page-load`. `<ClientRouter/>` + `transition:persist` give SPA-smooth navigation with persistent chrome.

**Tech Stack:** Astro 6 (`astro:transitions` ClientRouter, `getStaticPaths`, `astro:components` `Code`), Tailwind v4, TypeScript, `bun:test`. Build: `bunx astro build` (NOT `bun run build`). Dev: `bun run dev` → :4321.

## Global Constraints
- Homepage model A: `/` = home/hero only; every other section is its own page. No single-scroll landing.
- Explorer/MobileTopBar section links are REAL URLs (`/`, `/features`, `/deploy`, `/docker-compose-example`), never `/#id`.
- In-page hash swap REMOVED: no `setActive` section-toggling, no `hashchange`/`popstate` engine in `studio.ts`.
- `/deploy` and `/docker-compose-example` keep their EXACT current URLs + their structured data (deploy ItemList; docker-compose HowTo + SourceCode) for SEO continuity.
- Single source: deploy content only in `DeploySection.astro`; docker-compose content only in `DockerComposeSection.astro`.
- Design tokens only (no raw hex). `text-white` on `bg-primary` buttons is an accepted project-wide convention.
- View Transitions: chrome (TopBar, Explorer, StatusBar, Console, CommandPalette) uses `transition:persist`; respect `prefers-reduced-motion`.
- Out of scope (stay standalone, keep Header/Footer): `/privacy-policy`, `404`.
- Slugs: home→`''`(`/`), features→`features`, databases→`databases`, compare→`compare`, tech_stack→`tech-stack`, get_started→`get-started`, faq→`faq`, deploy→`deploy`, docker_compose→`docker-compose-example`.
- Verify each task with `bunx astro build` (must pass) + stated checks.

## File Structure
```
src/data/sections.ts                                MOD  + slug/pageTitle/pageDescription on 8; + docker_compose (9th) (Task 1)
src/data/sections.test.ts                           NEW  slug invariants (Task 1)
src/data/section-seo.ts                             NEW  id → JSON-LD[] (deploy, docker_compose) (Task 1)
src/components/sections/DockerComposeSection.astro   NEW  single-source compose content (Task 2)
src/pages/[section].astro                           NEW  dynamic route for the 8 non-home sections (Task 3)
src/pages/deploy.astro                              DEL  (Task 3, with route)
src/pages/docker-compose-example.astro              DEL  (Task 3, with route)
src/pages/index.astro                               MOD  home-only single section + home SEO (Task 4)
src/components/studio/Explorer.astro                MOD  real-URL links (Task 5)
src/components/studio/MobileTopBar.astro            MOD  forward URL link model (Task 5)
src/scripts/studio.ts                               MOD  drop swap/hash; URL nav; astro:page-load lifecycle; active sync (Task 6)
src/styles/global.css                               MOD  remove swap display rule; single-section always shown (Task 6)
src/layouts/Layout.astro                            MOD  add <ClientRouter/> (Task 7)
src/components/studio/{StudioShell,TopBar,StatusBar,Explorer,Console,CommandPalette}.astro  MOD  transition:persist (Task 7)
src/components/Footer.astro, Header.astro           MOD  internal links → real URLs (Task 8)
```

---

### Task 1: Slug + SEO manifest, docker_compose table, section-seo

**Files:**
- Modify: `src/data/sections.ts`
- Create: `src/data/section-seo.ts`
- Test: `src/data/sections.test.ts`

**Interfaces:**
- Produces: `SectionMeta` gains `slug: string`, `pageTitle: string`, `pageDescription: string`. A 9th section `docker_compose` is added. `sectionSeo: Record<string, object[]>` exports per-section JSON-LD arrays.

- [ ] **Step 1: Write the failing test**

```ts
// src/data/sections.test.ts
import { test, expect } from 'bun:test';
import { sections, sectionById } from './sections';

test('every section has a unique slug; home is empty', () => {
  const slugs = sections.map((s) => s.slug);
  expect(new Set(slugs).size).toBe(slugs.length);
  expect(sectionById['home'].slug).toBe('');
  expect(sectionById['tech_stack'].slug).toBe('tech-stack');
  expect(sectionById['get_started'].slug).toBe('get-started');
  expect(sectionById['docker_compose'].slug).toBe('docker-compose-example');
});

test('docker_compose table exists with page SEO', () => {
  const d = sectionById['docker_compose'];
  expect(d).toBeDefined();
  expect(d.pageTitle.length).toBeGreaterThan(0);
  expect(d.pageDescription.length).toBeGreaterThan(0);
});

test('every section has page SEO fields', () => {
  for (const s of sections) {
    expect(typeof s.slug).toBe('string');
    expect(s.pageTitle.length).toBeGreaterThan(0);
    expect(s.pageDescription.length).toBeGreaterThan(0);
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/data/sections.test.ts`
Expected: FAIL (slug/pageTitle undefined; docker_compose missing).

- [ ] **Step 3: Extend `SectionMeta` and every section**

In `src/data/sections.ts`, add to the `SectionMeta` interface:
```ts
  slug: string;          // URL slug ('' = home at '/')
  pageTitle: string;     // <title> when this section is its own page
  pageDescription: string;
```
Add these three fields to each existing section (verbatim values):
```
home:        slug: '',        pageTitle: 'LibreDB Studio - AI-Powered Open-Source SQL IDE',
             pageDescription: 'LibreDB Studio - The Modern, AI-Powered Open-Source SQL IDE for Cloud-Native Teams'
features:    slug: 'features',     pageTitle: 'Features — LibreDB Studio SQL IDE',
             pageDescription: 'Everything you need to master your data: Monaco SQL editor, NL2SQL Copilot, AI query safety, 7+ databases, pro data grid, visual EXPLAIN, ER diagrams, data masking, SSO and more.'
databases:   slug: 'databases',    pageTitle: 'Supported Databases — PostgreSQL, MySQL, Oracle, SQL Server, MongoDB, Redis',
             pageDescription: 'One tool, all your databases. Connect to PostgreSQL, MySQL, Oracle, SQL Server, SQLite, MongoDB and Redis through one unified browser-based SQL IDE.'
compare:     slug: 'compare',      pageTitle: 'How LibreDB Studio Compares — vs DataGrip, DBeaver, pgAdmin, TablePlus',
             pageDescription: 'See why teams switch to LibreDB Studio: zero-install, mobile, AI-native, SSO and free — compared against DataGrip, DBeaver, pgAdmin and TablePlus.'
tech_stack:  slug: 'tech-stack',   pageTitle: 'Tech Stack — LibreDB Studio',
             pageDescription: 'Built with a modern, production-ready stack: Next.js 16, React 19, TypeScript, Tailwind 4, Monaco, TanStack Table, ReactFlow, Gemini/OIDC, Docker and Bun.'
get_started: slug: 'get-started',  pageTitle: 'Get Started in Minutes — LibreDB Studio',
             pageDescription: 'Run LibreDB Studio locally in three steps — clone & install, configure, launch — or one-command Docker. Self-host the open-source AI SQL IDE.'
faq:         slug: 'faq',          pageTitle: 'FAQ — LibreDB Studio',
             pageDescription: 'Frequently asked questions about LibreDB Studio: pricing, self-hosting, AI providers, security & SSO, supported databases, and how it compares to legacy tools.'
deploy:      slug: 'deploy',       pageTitle: 'Deploy LibreDB Studio Anywhere — One-Click Apps, Helm, Docker & Cloud',
             pageDescription: 'Run the open-source LibreDB Studio SQL IDE anywhere: official Railway and CapRover one-click apps, Docker Hub & GHCR images, a Helm chart on Artifact Hub, npm, and every major open-source PaaS, managed PaaS, and cloud.'
```
Add the 9th section to the `sections` array (after `deploy`):
```ts
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
  },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/data/sections.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Create `section-seo.ts`**

```ts
// src/data/section-seo.ts
// Per-section structured data injected into <head> by the dynamic route.
import { deployTargets } from './deploy-targets';

const SITE = 'https://libredb.org';
const REPO = 'https://github.com/libredb/libredb-studio';
const rawFileURL = `${SITE}/docker-compose.example.yml`;

export const sectionSeo: Record<string, object[]> = {
  deploy: [
    {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: 'LibreDB Studio deployment targets',
      about: { '@id': 'https://libredb.org/#application' },
      itemListElement: deployTargets.map((t, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: t.name,
        url: t.deployUrl ?? t.docsUrl ?? t.url,
      })),
    },
  ],
  docker_compose: [
    {
      '@context': 'https://schema.org',
      '@type': 'HowTo',
      name: 'Run LibreDB Studio with Docker Compose',
      description: 'Self-host the open-source LibreDB Studio SQL IDE using Docker Compose.',
      totalTime: 'PT5M',
      tool: [{ '@type': 'HowToTool', name: 'Docker' }, { '@type': 'HowToTool', name: 'Docker Compose' }],
      step: [
        { '@type': 'HowToStep', position: 1, name: 'Download the compose file', text: 'Download docker-compose.example.yml and rename it to docker-compose.yml.', url: `${SITE}/docker-compose-example/` },
        { '@type': 'HowToStep', position: 2, name: 'Configure environment', text: 'Set JWT_SECRET (min 32 chars), ADMIN_PASSWORD and USER_PASSWORD in your .env file.', url: `${SITE}/docker-compose-example/` },
        { '@type': 'HowToStep', position: 3, name: 'Start the container', text: 'Run "docker compose up -d" and open http://localhost:3000.', url: `${SITE}/docker-compose-example/` },
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'SoftwareSourceCode',
      name: 'docker-compose.example.yml',
      description: 'Ready-to-use Docker Compose configuration for LibreDB Studio.',
      programmingLanguage: 'YAML',
      codeRepository: REPO,
      url: rawFileURL,
      license: 'https://opensource.org/licenses/MIT',
      about: { '@id': 'https://libredb.org/#application' },
    },
  ],
};
```

- [ ] **Step 6: Build + commit**

Run: `bunx astro build` → PASS (5 pages). `bun test src/data/` → all pass.
```bash
git add src/data/sections.ts src/data/sections.test.ts src/data/section-seo.ts
git commit -m "feat: section slugs + page SEO, docker_compose table, per-section JSON-LD"
```

---

### Task 2: `DockerComposeSection.astro` (single source)

**Files:**
- Create: `src/components/sections/DockerComposeSection.astro`

**Interfaces:**
- Produces: a self-contained section component rendering the docker-compose content (quick-start + copy, full yml via `<Code>`, 5 env-var tables, links row, copy `<script>`, `.compose-code` style). No props.

- [ ] **Step 1: Create the component by lifting the existing page body**

Create `src/components/sections/DockerComposeSection.astro`. Move the content from the current `src/pages/docker-compose-example.astro` into it, with these exact adaptations:
- Frontmatter imports: keep `import { Code } from 'astro:components';` and change the raw import path to `import composeYaml from '../../data/docker-compose.example.yml?raw';` (one level deeper than the page). Keep the `siteURL`, `rawFileURL`, `repoURL`, `exampleFileURL`, `issueURL`, `quickStart`, and `envGroups` consts EXACTLY as in the current page. DROP the `title`, `description`, `howToSchema`, `sourceCodeSchema` consts (these move to `section-seo.ts`/`[section].astro`, Task 1/3) and DROP the `Layout`/`Header`/`Footer` imports.
- Body: take everything currently inside `<main class="pt-24 pb-16"><div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8"> … </div></main>` EXCEPT the breadcrumb `<nav>` and the `<h1>`/intro `<p>` (the page `<h1>` is replaced by a `SectionHeader`). Wrap the remaining sections (Quick start, full file, env reference, links) in `<div class="mx-auto max-w-4xl">` and precede them with:
  ```astro
  import SectionHeader from './SectionHeader.astro';
  ...
  <SectionHeader title="Docker Compose example" subtitle="One command to self-host LibreDB Studio — pulls the published ghcr.io image, with every environment variable." />
  ```
- Keep the `.copy-btn` client `<script>` and the `<style>` block (`.compose-code :global(pre) {…}`) VERBATIM at the end of the component.
- Result: the component renders identically to the old page's content area, minus the page chrome (Layout/Header/Footer/breadcrumb/H1), which the shell + SectionHeader now provide.

- [ ] **Step 2: Build verify**

Run: `bunx astro build` → PASS (component unused yet, just compiles). Confirm via grep: `grep -c "Code code={composeYaml}" src/components/sections/DockerComposeSection.astro` → 1; `grep -c "copy-btn" src/components/sections/DockerComposeSection.astro` → present.

- [ ] **Step 3: Commit**

```bash
git add src/components/sections/DockerComposeSection.astro
git commit -m "feat: DockerComposeSection single-source content (lifted from the page)"
```

---

### Task 3: Dynamic `[section].astro` route + delete old pages

**Files:**
- Create: `src/pages/[section].astro`
- Delete: `src/pages/deploy.astro`, `src/pages/docker-compose-example.astro`

**Interfaces:**
- Consumes: `sections`/`sectionById` (Task 1), `sectionSeo` (Task 1), all section components, `StudioShell`, `SectionShell`.
- Produces: static pages at every non-home slug.

- [ ] **Step 1: Create the dynamic route**

```astro
---
// src/pages/[section].astro
import Layout from '../layouts/Layout.astro';
import StudioShell from '../components/studio/StudioShell.astro';
import SectionShell from '../components/studio/SectionShell.astro';
import { sections, sectionById } from '../data/sections';
import { sectionSeo } from '../data/section-seo';

import FeaturesSection from '../components/sections/FeaturesSection.astro';
import DatabasesSection from '../components/sections/DatabasesSection.astro';
import CompareSection from '../components/sections/CompareSection.astro';
import TechStackSection from '../components/sections/TechStackSection.astro';
import GetStartedSection from '../components/sections/GetStartedSection.astro';
import FaqSection from '../components/sections/FaqSection.astro';
import DeploySection from '../components/sections/DeploySection.astro';
import DockerComposeSection from '../components/sections/DockerComposeSection.astro';

export function getStaticPaths() {
  return sections
    .filter((s) => s.id !== 'home')
    .map((s) => ({ params: { section: s.slug }, props: { id: s.id } }));
}

const COMPONENTS: Record<string, any> = {
  features: FeaturesSection,
  databases: DatabasesSection,
  compare: CompareSection,
  tech_stack: TechStackSection,
  get_started: GetStartedSection,
  faq: FaqSection,
  deploy: DeploySection,
  docker_compose: DockerComposeSection,
};

const { id } = Astro.props as { id: string };
const meta = sectionById[id];
const Body = COMPONENTS[id];
const jsonLd = sectionSeo[id] ?? [];
---
<Layout title={meta.pageTitle} description={meta.pageDescription}>
  {jsonLd.map((schema) => (
    <script slot="head" is:inline type="application/ld+json" set:html={JSON.stringify(schema)} />
  ))}
  <StudioShell active={id} standalone>
    <SectionShell section={meta} active><Body /></SectionShell>
  </StudioShell>
</Layout>
```

- [ ] **Step 2: Delete the old standalone pages**

```bash
git rm src/pages/deploy.astro src/pages/docker-compose-example.astro
```
(They are replaced by the dynamic route, which generates `/deploy` and `/docker-compose-example` from their slugs — avoids a duplicate-route build error.)

- [ ] **Step 3: Build verify (all section pages generated)**

Run: `bunx astro build`
Expected: PASS. Confirm all section pages emit:
```bash
for p in features databases compare tech-stack get-started faq deploy docker-compose-example; do test -f "dist/$p/index.html" && echo "ok $p" || echo "MISSING $p"; done
```
Expected: all `ok`. Confirm `/docker-compose-example` still carries its JSON-LD: `grep -o 'application/ld+json' dist/docker-compose-example/index.html | wc -l` → 5 (3 global + HowTo + SourceCode); `/deploy` → 4.

- [ ] **Step 4: Commit**

```bash
git add src/pages/[section].astro
git commit -m "feat: dynamic [section] route generates every section page; drop deploy.astro & docker-compose-example.astro"
```

---

### Task 4: `index.astro` = home-only single section

**Files:**
- Modify: `src/pages/index.astro`

**Interfaces:**
- Consumes: `StudioShell`, `SectionShell`, `HomeSection`, `sectionById`.

- [ ] **Step 1: Rewrite index.astro to render only the home section**

Replace the entire body of `src/pages/index.astro`:
```astro
---
import Layout from '../layouts/Layout.astro';
import StudioShell from '../components/studio/StudioShell.astro';
import SectionShell from '../components/studio/SectionShell.astro';
import HomeSection from '../components/sections/HomeSection.astro';
import { sectionById } from '../data/sections';
const home = sectionById['home'];
---
<Layout title={home.pageTitle} description={home.pageDescription}>
  <StudioShell active="home" standalone>
    <SectionShell section={home} active><HomeSection /></SectionShell>
  </StudioShell>
</Layout>
```
(`/` now renders only home/hero inside the shell — the other 7 SectionShells are gone; they live at their own URLs.)

- [ ] **Step 2: Build + browser verify**

Run: `bunx astro build` → PASS.
In dev, `/` shows the shell with home active and ONLY the home section in the pane (no features/compare/etc. stacked). Explorer still lists all 9 tables. Confirm:
```js
document.querySelectorAll('[data-section]').length  // 1 (only home)
document.querySelector('.studio-section')?.id        // "home"
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/index.astro
git commit -m "feat: / renders home-only in the studio shell"
```

---

### Task 5: Explorer + MobileTopBar real-URL links

**Files:**
- Modify: `src/components/studio/Explorer.astro`
- Modify: `src/components/studio/MobileTopBar.astro`

**Interfaces:**
- Consumes: `sections` (each has `slug`).
- Produces: Explorer section links are real URLs (`/` or `/{slug}`); `data-section-link={s.id}` retained for studio.ts (search/active).

- [ ] **Step 1: Explorer links → real URLs**

In `src/components/studio/Explorer.astro`, the section row currently builds `href={`${linkBase}#${s.id}`}`. Replace the link href with a slug-based real URL and drop the `linkBase`/`standalone` hash logic:
```astro
              href={s.slug === '' ? '/' : `/${s.slug}`}
```
Remove the now-unused `standalone`/`linkBase` const lines from the frontmatter (the `standalone` prop may remain accepted but is no longer used for href; if present, leave the prop declaration but delete the `linkBase` derivation and hash usage). Keep `data-section-link={s.id}` and the active-highlight markup.

- [ ] **Step 2: MobileTopBar — no hash forwarding needed**

In `src/components/studio/MobileTopBar.astro`, the drawer `<Explorer>` call no longer needs `standalone` for links (Explorer now always uses real URLs). Leave `active={active}` and `idPrefix="drawer"`; the `standalone` prop pass-through can stay or be removed (no effect on links now).

- [ ] **Step 3: Build + browser verify**

Run: `bunx astro build` → PASS.
In dev on `/`, Explorer links are real URLs:
```js
document.querySelector('[data-section-link="compare"]').getAttribute('href')  // "/compare"
document.querySelector('[data-section-link="home"]').getAttribute('href')     // "/"
document.querySelector('[data-section-link="docker_compose"]').getAttribute('href')  // "/docker-compose-example"
```
Clicking `compare` navigates to `/compare` (full nav for now; View Transitions added in Task 7).

- [ ] **Step 4: Commit**

```bash
git add src/components/studio/Explorer.astro src/components/studio/MobileTopBar.astro
git commit -m "feat: Explorer navigates by real section URLs"
```

---

### Task 6: `studio.ts` — drop swap engine, URL nav, page-load lifecycle

**Files:**
- Modify: `src/scripts/studio.ts`
- Modify: `src/styles/global.css`

**Interfaces:**
- Consumes: `sections` (slug↔id), DOM with one section per page.
- Produces: interaction layer that works per page and across View-Transition navigations.

- [ ] **Step 1: Remove the swap/hash engine and switch to URL navigation**

Edit `src/scripts/studio.ts`:
- DELETE `setActive`'s section-toggling responsibility, the `hashchange`/`popstate` listeners, the `onLinkClick` swap path, and `currentHash`-based activation. Section links are now plain `<a href="/slug">`; do not intercept them (no `data-section-link` click handler that preventDefaults).
- Build a slug↔id map from `sections`: `const slugToId = Object.fromEntries(sections.map(s => [s.slug, s.id]));`
- Add `currentId()`: derive the active id from the URL path:
  ```ts
  function currentId(): string {
    const seg = location.pathname.replace(/^\/+|\/+$/g, '').split('/')[0] ?? '';
    return slugToId[seg] ?? 'home';
  }
  ```
- Add `syncActive()`: highlight the active Explorer row + update the StatusBar from `currentId()`:
  ```ts
  function syncActive() {
    const id = currentId();
    const meta = sectionById[id] ?? sectionById['home'];
    document.querySelectorAll<HTMLElement>('[data-section-link]').forEach((a) => {
      const on = a.dataset.sectionLink === id;
      a.closest<HTMLElement>('.exp-row')?.classList.toggle('active', on);
      a.setAttribute('aria-current', on ? 'true' : 'false');
    });
    const t = document.querySelector('[data-statusbar-table]');
    const r = document.querySelector('[data-statusbar-rows]');
    if (t) t.textContent = meta.table;
    if (r) r.textContent = String(meta.rows);
  }
  ```
- Palette "Jump to {section}" and Explorer search Enter now NAVIGATE by URL. Replace the palette jump run body and the search-Enter handler to use:
  ```ts
  const href = (slug: string) => (slug === '' ? '/' : `/${slug}`);
  // palette jump: run: () => { location.href = href(s.slug); }
  // search Enter: location.href = href(firstMatch.slug);  // firstMatch from the [data-explorer-item] dataset/section
  ```
  (For search, map the first visible `[data-explorer-item]` id → its section slug via `sectionById[id].slug`.)
- `copyLink()` now copies the section's real URL: `const url = location.origin + href(sectionById[currentId()].slug);`
- `runQuery()`/`exportSection()`/`toggleExplain()` use `currentId()` instead of `currentHash()`.

- [ ] **Step 2: Lifecycle — wire once + per-navigation**

Restructure init so document/window listeners attach ONCE and per-page sync runs on every navigation:
```ts
let wiredOnce = false;
function wireOnce() {
  if (wiredOnce) return;
  wiredOnce = true;
  studio?.classList.add('js');
  // single delegated [data-action] click handler (palette/run/copy-link/export/explain/notice)
  document.addEventListener('click', onActionClick);
  // ⌘K + palette keyboard
  window.addEventListener('keydown', onKeydown);
  // drawer + palette close + explorer search + column toggles are on persisted chrome — bind here
  bindChrome();
}
function onPage() {
  syncActive();
}
function start() { wireOnce(); onPage(); }
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
else start();
document.addEventListener('astro:page-load', () => { wireOnce(); onPage(); });
```
(Factor the existing delegated click handler into `onActionClick`, the keydown into `onKeydown`, and the explorer-search/column-toggle/drawer wiring into `bindChrome()`. Because the chrome is `transition:persist`ed, `bindChrome()` only needs to run once; guard re-binds if needed. `syncActive()` runs on every `astro:page-load`.)

- [ ] **Step 3: global.css — single section always shown**

In `src/styles/global.css`, the swap rule block:
```css
@media (min-width: 1024px) {
  .studio.js { height: 100vh; height: 100dvh; overflow: hidden; }
  .studio.js .studio-pane { min-height: 0; overflow: hidden; }
  .studio.js .studio-section { display: none; height: 100%; min-height: 0; }
  .studio.js .studio-section.is-active { display: flex; flex-direction: column; }
  .studio.js .studio-results { flex: 1 1 auto; min-height: 0; overflow-y: auto; }
}
```
Replace the two `.studio-section` lines so the (single) section is always shown:
```css
  .studio.js .studio-section { display: flex; flex-direction: column; height: 100%; min-height: 0; }
  .studio.js .studio-results { flex: 1 1 auto; min-height: 0; overflow-y: auto; }
```
(Remove the `display:none` + `.is-active` gate — every page has exactly one section.)

- [ ] **Step 4: Build + browser verify**

Run: `bunx astro build` → PASS. `bun test src/` → green.
In dev: `/` shows home; clicking Explorer `compare` navigates to `/compare` (full reload until Task 7), where compare is shown, its Explorer row is active, StatusBar shows `compare`. Palette ⌘K → "Jump to deploy" navigates to `/deploy`. Explorer search "faq" + Enter → `/faq`. Copy on `/compare` copies `…/compare`. No console errors; no leftover hashchange behavior.

- [ ] **Step 5: Commit**

```bash
git add src/scripts/studio.ts src/styles/global.css
git commit -m "feat: studio.ts navigates by URL; drop in-page swap; page-load lifecycle"
```

---

### Task 7: View Transitions (ClientRouter + persist)

**Files:**
- Modify: `src/layouts/Layout.astro`
- Modify: `src/components/studio/StudioShell.astro` (+ persisted chrome components)

**Interfaces:**
- Consumes: `astro:transitions` `ClientRouter`.

- [ ] **Step 1: Add ClientRouter to Layout**

In `src/layouts/Layout.astro` frontmatter add `import { ClientRouter } from 'astro:transitions';`. In `<head>` (near the other head tags, before the `<slot name="head" />`) add:
```astro
    <ClientRouter />
```

- [ ] **Step 2: Persist the chrome**

In `src/components/studio/StudioShell.astro`, add `transition:persist` to the persistent chrome wrappers so they don't re-render/flicker across navigations — and give each a stable `transition:persist` name where it's a distinct element:
- The desktop TopBar wrapper `<div class="hidden lg:block">` → add `transition:persist="topbar"`.
- The Explorer `<aside …>` → add `transition:persist="sidebar"`.
- `<MobileTopBar … />` → wrap or add `transition:persist="mobiletop"`.
- The StatusBar wrapper `<div class="hidden lg:block">` → `transition:persist="statusbar"`.
- `<Console />` → `transition:persist="console"`.
- `<CommandPalette />` → `transition:persist="palette"`.
Leave `<main class="studio-pane">` (the result content) NON-persisted so it transitions.

- [ ] **Step 3: Build + browser verify (the key runtime check)**

Run: `bunx astro build` → PASS.
In dev, navigate Explorer `home → compare → deploy → docker-compose-example`:
- Transitions are smooth/animated (no full white reload); the sidebar/topbar/statusbar do not flicker (persisted); the result pane cross-fades.
- After EACH navigation, interactions still work: ⌘K palette opens, a `[data-notice]` button shows a toast, `RUN` shimmers, Explain toggles, Explorer search filters. (This confirms `wireOnce`/`onPage` lifecycle.)
- Active Explorer row + StatusBar reflect the current page after each nav.
- With OS reduced-motion on, transitions don't animate jarringly.

- [ ] **Step 4: Commit**

```bash
git add src/layouts/Layout.astro src/components/studio/StudioShell.astro
git commit -m "feat: Astro View Transitions with persistent chrome"
```

---

### Task 8: Internal links → real section URLs

**Files:**
- Modify: `src/components/Footer.astro`, `src/components/Header.astro`
- Modify: `src/components/sections/HomeSection.astro`, `src/components/sections/GetStartedSection.astro` (any `/#section` links)

**Interfaces:** none (link hrefs only).

- [ ] **Step 1: Replace hash-section links with real URLs**

Search and update every internal link of the form `/#features`, `/#databases`, `/#tech-stack`, `/#get-started`, `/#deploy`, `/#faq` to the real path (`/features`, `/databases`, `/tech-stack`, `/get-started`, `/deploy`, `/faq`). Run to find them:
```bash
grep -rn 'href="/#' src/components src/pages
```
Update each occurrence in `Footer.astro` (Product section + Docker Compose Example link → `/docker-compose-example`), `Header.astro` (nav links), `HomeSection.astro` (CTAs — note "Deploy in one click" → `/deploy` which may already be `/deploy`), and `GetStartedSection.astro` ("Explore all deploy options" → `/deploy`, "View the full docker-compose.example.yml" → `/docker-compose-example`). Leave external links and `app.libredb.org`/GitHub links unchanged.

- [ ] **Step 2: Build + verify no stale hash-section links remain**

Run: `bunx astro build` → PASS.
Run: `grep -rn 'href="/#' src/components src/pages` → expect NO matches (all converted).

- [ ] **Step 3: Commit**

```bash
git add src/components/Footer.astro src/components/Header.astro src/components/sections/HomeSection.astro src/components/sections/GetStartedSection.astro
git commit -m "feat: internal links point to real section URLs"
```

---

### Task 9: QA pass

**Files:** none (verification + fixes only).

- [ ] **Step 1: Full build + tests**

Run: `bunx astro build` → PASS. Pages built should include `/`, the 8 section pages, `/privacy-policy`, `404` (≈11). `bun test src/` → green.

- [ ] **Step 2: Single-source + route checks**

```bash
grep -rl "Official one-click integrations" src/   # only DeploySection.astro
grep -rl "Environment variable reference" src/    # only DockerComposeSection.astro
test ! -f src/pages/deploy.astro && test ! -f src/pages/docker-compose-example.astro && echo "old pages removed"
grep -rn 'href="/#' src/components src/pages || echo "no stale hash links"
```

- [ ] **Step 3: SEO continuity**

```bash
grep -o 'application/ld+json' dist/deploy/index.html | wc -l                    # 4
grep -o 'application/ld+json' dist/docker-compose-example/index.html | wc -l    # 5
grep -o '<title>[^<]*</title>' dist/compare/index.html                          # the compare pageTitle
```
Confirm `dist/sitemap-0.xml` (or sitemap-index) lists the new section URLs.

- [ ] **Step 4: Browser matrix (dev :4321), desktop 1440 + mobile 390**

- Navigate `home → features → compare → deploy → docker-compose-example` via the Explorer: smooth View Transitions, persistent chrome, no flicker.
- After each navigation: ⌘K palette, a redirect toast, RUN shimmer, Copy (copies real URL), Export, Explain, Explorer search all work.
- `/docker-compose-example`: quick-start + copy button work, full yml renders, env tables present; the Explorer shows `docker_compose` highlighted.
- Mobile: drawer opens, links navigate by URL, one section per page.
- Reduced-motion: navigations don't animate harshly; RUN shimmer suppressed.
- Direct loads of `/compare`, `/deploy`, `/docker-compose-example` (no SPA history) render correctly with the right section active.

- [ ] **Step 5: Commit any fixes**

```bash
git add -A
git commit -m "test: QA pass for multi-page studio"
```

---

## Self-Review (completed by plan author)
- **Spec coverage:** routing/slugs + dynamic route (Task 3) ✓; 9th docker_compose table + Explorer presence (Task 1 manifest + Task 5 links + Task 3 route) ✓; DockerComposeSection single source (Task 2) ✓; home-only `/` (Task 4) ✓; real-URL Explorer (Task 5) ✓; studio.ts swap removal + URL nav + page-load lifecycle (Task 6) ✓; View Transitions + persist (Task 7) ✓; per-section SEO + deploy/docker-compose JSON-LD continuity (Task 1 section-seo + Task 3 head-slot) ✓; internal link updates (Task 8) ✓; out-of-scope privacy/404 untouched ✓.
- **Placeholder scan:** none — code/edits are concrete; the DockerComposeSection lift names exact source regions + import-path changes (the source file exists in-repo).
- **Type/name consistency:** `slug`/`pageTitle`/`pageDescription` on `SectionMeta` (Task 1) used by `[section].astro` (Task 3), `index.astro` (Task 4), Explorer (Task 5), studio.ts `slugToId`/`currentId`/`href` (Task 6); `sectionSeo` map (Task 1) consumed in Task 3; `transition:persist` chrome (Task 7) matches StudioShell elements from the deploy-unify branch. Consistent.
