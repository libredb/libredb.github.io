# Unify Deploy (B2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Author the rich deploy content ONCE (`DeploySection.astro`) and render it in the SAME IDE shell both on the homepage `#deploy` section and at `/deploy`, keeping `/deploy` a real indexed page.

**Architecture:** Extract the IDE chrome into a shared `StudioShell.astro` (props `active`, `standalone`). `index.astro` uses it with all 8 sections (home active). `deploy.astro` becomes a thin page: Layout (deploy SEO + ItemList JSON-LD via a new Layout `head` slot) → `StudioShell standalone active="deploy"` → one `SectionShell` with `DeploySection`. `studio.ts` gains standalone awareness so a focused single-section page activates correctly and its Explorer/palette navigation points back to `/#section`.

**Tech Stack:** Astro 6, Tailwind v4, TypeScript. Build check: `bunx astro build` (NOT `bun run build` — it mutates tracked compose files). Dev: `bun run dev` → :4321. No unit tests for these (Astro components + DOM wiring) — verify with build + browser.

## Global Constraints
- **Single source of deploy content**: the visible deploy content lives in exactly ONE file (`DeploySection.astro`). `index.astro` and `deploy.astro` must both render `<DeploySection/>` with NO copied markup. (Deploy-specific ItemList JSON-LD is metadata, authored once in `deploy.astro` — not visible content.)
- Design tokens only (no raw hex): `bg-canvas/panel/raised`, `border-edge/edge-strong/line`, `text-fg/bright/muted/dim/faint`, accents `primary/ok/bad/warn/ai`. Mono everywhere. Sharp corners (≤6px on chips/buttons).
- `/deploy` stays a real 200 page with its own `<title>`, meta description, self-canonical, and ItemList JSON-LD — NO redirect (it is Google-indexed).
- Internal links to deploy stay `/deploy` (Hero, get_started, Header, Footer) — unchanged.
- Other sub-pages (`/docker-compose-example`, `/privacy-policy`, `/404`) keep Header/Footer — out of scope.
- Progressive enhancement preserved: content present without JS; `/deploy` shows its single section server-rendered active.
- Verify each task with `bunx astro build` (must pass, 5 pages) + the stated browser check.

## File Structure
```
src/layouts/Layout.astro                    MOD  add named `head` slot (Task 1)
src/components/studio/StudioShell.astro      NEW  extracted shell; props active, standalone (Task 2)
src/components/studio/StatusBar.astro        MOD  accept `active` prop (Task 2)
src/components/studio/Explorer.astro         MOD  `standalone` prop → /#id links (Task 2)
src/components/studio/MobileTopBar.astro     MOD  `standalone` prop, forward to drawer Explorer (Task 2)
src/pages/index.astro                        MOD  use StudioShell active=home + 8 sections (Task 2)
src/scripts/studio.ts                        MOD  standalone awareness (Task 3)
src/components/sections/DeploySection.astro  MOD  rich SINGLE-SOURCE content + getStars + star-refresh script (Task 4)
src/pages/deploy.astro                       MOD  thin: Layout(SEO+ItemList head slot) + StudioShell standalone + DeploySection (Task 5)
```
Unchanged: `deploy-targets.ts`, `deploy-categories.ts`, `sections.ts`, `PlatformCard.astro`, `StatusBadge.astro`.

---

### Task 1: Add a `head` slot to Layout

**Files:**
- Modify: `src/layouts/Layout.astro`

**Interfaces:**
- Produces: a named slot `head` rendered inside `<head>`, so pages can inject page-specific head markup (deploy's ItemList JSON-LD in Task 5).

- [ ] **Step 1: Add the slot**

In `src/layouts/Layout.astro`, inside `<head>`, immediately BEFORE the closing `</head>` (after the existing `<title>{title}</title>` line), add:
```astro
    <slot name="head" />
```

- [ ] **Step 2: Build verify**

Run: `bunx astro build`
Expected: PASS (5 pages). No visual/markup change to existing pages (the slot is empty everywhere today).

- [ ] **Step 3: Commit**

```bash
git add src/layouts/Layout.astro
git commit -m "feat: add named head slot to Layout for page-specific <head> markup"
```

---

### Task 2: Extract `StudioShell` + adopt it in `index.astro`

**Files:**
- Create: `src/components/studio/StudioShell.astro`
- Modify: `src/components/studio/StatusBar.astro`
- Modify: `src/components/studio/Explorer.astro`
- Modify: `src/components/studio/MobileTopBar.astro`
- Modify: `src/pages/index.astro`

**Interfaces:**
- Produces: `StudioShell` (props `active?: string = 'home'`, `standalone?: boolean = false`); renders the shell with `<slot/>` for the main pane sections, and the root `<div class="studio" data-studio data-initial-active={active} data-standalone={standalone?'':undefined}>`. Explorer/MobileTopBar gain `standalone?: boolean`; StatusBar gains `active?: string`.
- Consumes: existing `TopBar`, `MobileTopBar`, `Explorer`, `StatusBar`, `Console`, `CommandPalette`, `studio.ts`.

- [ ] **Step 1: StatusBar accepts an `active` prop**

Replace the frontmatter of `src/components/studio/StatusBar.astro`:
```astro
---
import { sectionById } from '../../data/sections';
interface Props { active?: string; }
const { active = 'home' } = Astro.props;
const meta = sectionById[active] ?? sectionById['home'];
---
```
Then in the markup replace the two `home.` references so it renders the active section:
- `<span data-statusbar-table>{home.table}</span>` → `<span data-statusbar-table>{meta.table}</span>`
- `<span data-statusbar-rows>{home.rows}</span>` → `<span data-statusbar-rows>{meta.rows}</span>`
(Leave the `cursor-default select-none` and all other classes intact.)

- [ ] **Step 2: Explorer accepts `standalone` → absolute links**

In `src/components/studio/Explorer.astro`, add `standalone` to Props:
```astro
const { active = 'home', idPrefix = 'exp', showConnectionsLabel = true, standalone = false } = Astro.props;
const linkBase = standalone ? '/' : '';
```
(Add `standalone?: boolean;` to the `interface Props`.) Then change the section link href:
```astro
              href={`${linkBase}#${s.id}`}
```
(It currently reads `href={`#${s.id}`}`. Everything else — `data-section-link={s.id}`, classes — stays.)

- [ ] **Step 3: MobileTopBar forwards `standalone`**

In `src/components/studio/MobileTopBar.astro`, add `standalone` to Props and forward it to the drawer Explorer:
```astro
interface Props { active?: string; standalone?: boolean; }
const { active = 'home', standalone = false } = Astro.props;
```
And the drawer Explorer call:
```astro
      <Explorer active={active} idPrefix="drawer" showConnectionsLabel={false} standalone={standalone} />
```

- [ ] **Step 4: Create `StudioShell.astro`**

```astro
---
// src/components/studio/StudioShell.astro
// The shared IDE chrome. index.astro and deploy.astro both render through this.
import TopBar from './TopBar.astro';
import MobileTopBar from './MobileTopBar.astro';
import Explorer from './Explorer.astro';
import StatusBar from './StatusBar.astro';
import Console from './Console.astro';
import CommandPalette from './CommandPalette.astro';

interface Props {
  active?: string;
  standalone?: boolean;
}
const { active = 'home', standalone = false } = Astro.props;
---
<div
  class="studio flex min-h-screen flex-col"
  data-studio
  data-initial-active={active}
  data-standalone={standalone ? '' : undefined}
>
  <div class="hidden lg:block"><TopBar /></div>
  <MobileTopBar active={active} standalone={standalone} />

  <div class="studio-workbench flex min-h-0 flex-1">
    <aside class="hidden w-64 shrink-0 overflow-y-auto border-r border-edge lg:block">
      <Explorer active={active} idPrefix="side" standalone={standalone} />
    </aside>

    <main class="studio-pane min-w-0 flex-1 lg:flex lg:flex-col">
      <slot />
    </main>
  </div>

  <div class="hidden lg:block"><StatusBar active={active} /></div>
  <Console />
</div>

<CommandPalette />

<script>
  import '../../scripts/studio.ts';
</script>
```

- [ ] **Step 5: Rewrite `index.astro` to use `StudioShell`**

Replace the entire body of `src/pages/index.astro` with:
```astro
---
import Layout from '../layouts/Layout.astro';
import StudioShell from '../components/studio/StudioShell.astro';
import SectionShell from '../components/studio/SectionShell.astro';
import { sectionById } from '../data/sections';

import HomeSection from '../components/sections/HomeSection.astro';
import FeaturesSection from '../components/sections/FeaturesSection.astro';
import DatabasesSection from '../components/sections/DatabasesSection.astro';
import CompareSection from '../components/sections/CompareSection.astro';
import TechStackSection from '../components/sections/TechStackSection.astro';
import GetStartedSection from '../components/sections/GetStartedSection.astro';
import FaqSection from '../components/sections/FaqSection.astro';
import DeploySection from '../components/sections/DeploySection.astro';

const s = sectionById;
---
<Layout title="LibreDB Studio - AI-Powered Open-Source SQL IDE">
  <StudioShell active="home">
    <SectionShell section={s.home} active><HomeSection /></SectionShell>
    <SectionShell section={s.features}><FeaturesSection /></SectionShell>
    <SectionShell section={s.databases}><DatabasesSection /></SectionShell>
    <SectionShell section={s.compare}><CompareSection /></SectionShell>
    <SectionShell section={s.tech_stack}><TechStackSection /></SectionShell>
    <SectionShell section={s.get_started}><GetStartedSection /></SectionShell>
    <SectionShell section={s.faq}><FaqSection /></SectionShell>
    <SectionShell section={s.deploy}><DeploySection /></SectionShell>
  </StudioShell>
</Layout>
```
(Note: the `<script>import '../scripts/studio.ts'</script>` now lives in StudioShell, so it is removed from index.astro. The script path in StudioShell is `'../../scripts/studio.ts'` because StudioShell is one directory deeper.)

- [ ] **Step 6: Build + browser verify (homepage unchanged)**

Run: `bunx astro build` → PASS (5 pages).
In dev (`bun run dev`, :4321), load `/`: the homepage is visually unchanged. Verify the studio still works:
```js
// in the browser console
document.querySelector('[data-studio]').classList.contains('js')  // true (script ran)
document.querySelector('[data-section-link="compare"]').getAttribute('href')  // "#compare" (NOT /#compare — homepage is not standalone)
```
Click an Explorer item → section swaps; press ⌘/Ctrl+K → palette opens. (No regression from the extraction.)

- [ ] **Step 7: Commit**

```bash
git add src/components/studio/StudioShell.astro src/components/studio/StatusBar.astro src/components/studio/Explorer.astro src/components/studio/MobileTopBar.astro src/pages/index.astro
git commit -m "refactor: extract StudioShell; index.astro renders through it"
```

---

### Task 3: `studio.ts` standalone awareness

**Files:**
- Modify: `src/scripts/studio.ts`

**Interfaces:**
- Consumes: `[data-studio]` dataset flags `data-initial-active`, `data-standalone` (from StudioShell, Task 2).
- Behavior: on a standalone page (single section), the section activates on load even with no hash; `setActive` no-ops if the target section is absent; Explorer link clicks navigate (no in-page swap); palette "Jump" navigates to `/#id`.

- [ ] **Step 1: Read the flags**

Near the top of `src/scripts/studio.ts`, just after `const studio = document.querySelector<HTMLElement>('[data-studio]');`, add:
```ts
const standalone = !!studio && studio.hasAttribute('data-standalone');
const initialActive = studio?.dataset.initialActive || 'home';
```

- [ ] **Step 2: `setActive` falls back to the page's initial active and bails if the section is absent**

In `setActive`, replace the opening lines. Current:
```ts
function setActive(id: string, opts: { scroll?: boolean } = {}) {
  if (!ids.has(id)) id = 'home';
  const meta = sectionById[id];
```
Replace with:
```ts
function setActive(id: string, opts: { scroll?: boolean } = {}) {
  if (!ids.has(id)) id = initialActive;
  // Focused/standalone pages render a single section; if the requested one
  // isn't in the DOM, keep the current view instead of blanking it.
  if (!document.querySelector(`[data-section="${id}"]`)) return;
  const meta = sectionById[id];
```

- [ ] **Step 3: `currentHash` defaults to the page's initial active**

Replace:
```ts
function currentHash(): string {
  return (location.hash || '#home').slice(1);
}
```
with:
```ts
function currentHash(): string {
  return (location.hash || `#${initialActive}`).slice(1);
}
```

- [ ] **Step 4: On standalone, let Explorer links navigate (no in-page swap)**

In `onLinkClick`, add a standalone short-circuit at the top. Current:
```ts
function onLinkClick(e: Event, id: string) {
  if (isDesktop()) {
```
Replace with:
```ts
function onLinkClick(e: Event, id: string) {
  if (standalone) { closeDrawer(); return; } // links are /#id → let the browser navigate home
  if (isDesktop()) {
```

- [ ] **Step 5: Palette "Jump to section" navigates cross-page when standalone**

In the palette `paletteItems()` jump mapping, the jump currently does `location.hash = \`#${s.id}\``. Replace that run body:
```ts
    run: () => { location.hash = `#${s.id}`; },
```
with:
```ts
    run: () => {
      if (standalone) location.href = `/#${s.id}`;
      else location.hash = `#${s.id}`;
    },
```

- [ ] **Step 6: Build + browser verify (homepage still fine)**

Run: `bunx astro build` → PASS.
In dev load `/` (NOT standalone): everything works as before — section swap, palette jump (sets `#section`, stays on page), search. The standalone branches don't fire on the homepage (no `data-standalone`). Confirm:
```js
document.querySelector('[data-studio]').hasAttribute('data-standalone')  // false on homepage
```

- [ ] **Step 7: Commit**

```bash
git add src/scripts/studio.ts
git commit -m "feat: studio.ts standalone awareness (initial-active, setActive bail, cross-page nav)"
```

---

### Task 4: `DeploySection.astro` becomes the single-source rich content

**Files:**
- Modify: `src/components/sections/DeploySection.astro`

**Interfaces:**
- Consumes: `deployTargets`, `starRepos` (`../../data/deploy-targets`), `deployCategories` (`../../data/deploy-categories`), `getStars`/`formatStars` (`../../lib/github-stars`), `PlatformCard` (`../deploy/PlatformCard.astro`), `SectionHeader` (`./SectionHeader.astro`).
- Produces: the full deploy result content, rendered identically wherever `<DeploySection/>` appears. Includes the build-time `getStars` call and the client `[data-stars-repo]` refresh `<script>`.

- [ ] **Step 1: Replace DeploySection with the rich, single-source version**

Replace the ENTIRE contents of `src/components/sections/DeploySection.astro` with:
```astro
---
import SectionHeader from './SectionHeader.astro';
import PlatformCard from '../deploy/PlatformCard.astro';
import { deployTargets, starRepos } from '../../data/deploy-targets';
import { deployCategories } from '../../data/deploy-categories';
import { getStars, formatStars } from '../../lib/github-stars';

const stars = await getStars(starRepos);

const STATUS_ORDER = { official: 0, available: 1, planned: 2 } as const;
const sortedCategories = [...deployCategories].sort((a, b) => a.order - b.order);
const targetsByCategory = (id: string) =>
  deployTargets
    .filter((t) => t.category === id)
    .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);

const official = deployTargets.filter((t) => t.status === 'official');
const totalStars = Object.values(stars).reduce((sum, n) => sum + n, 0);

const platformCount = deployTargets.length;
const installMethodCount = deployTargets.filter((t) => t.category === 'registry').length;
const plannedNames = deployTargets.filter((t) => t.status === 'planned').map((t) => t.name);

const catColors = ['text-primary', 'text-ok', 'text-ai', 'text-warn', 'text-bad'];
const summary = sortedCategories.map((c, i) => ({
  title: c.title,
  count: deployTargets.filter((t) => t.category === c.id).length,
  color: catColors[i % catColors.length],
}));
---
<div class="mx-auto max-w-6xl">
  <SectionHeader
    title="Deploy anywhere"
    subtitle={`One open-source image, every layer of the deploy stack — ${platformCount}+ platforms and ${installMethodCount} install methods.`}
  />

  <!-- Category summary strip -->
  <div class="grid grid-cols-2 gap-px overflow-hidden border border-edge bg-edge md:grid-cols-3 lg:grid-cols-5">
    {summary.map((c) => (
      <div class="bg-panel p-5">
        <div class={`text-3xl font-bold ${c.color}`}>{c.count}</div>
        <div class="mt-2 text-[12.5px] leading-snug text-dim">{c.title}</div>
      </div>
    ))}
  </div>

  <!-- Official one-click integrations -->
  <section class="mt-10">
    <h3 class="text-[15px] font-semibold text-bright">Official one-click integrations</h3>
    <p class="mt-1 text-[13px] text-dim">Listed in their marketplaces — deploy in a click, today.</p>
    <div class="mt-4 grid gap-4 md:grid-cols-2">
      {official.map((t) => (
        <div class="flex flex-col border border-edge-strong bg-panel p-6">
          <div class="mb-3 flex items-center gap-3">
            {t.logo
              ? <img src={t.logo} alt={`${t.name} logo`} width="40" height="40" class="h-10 w-10 object-contain" />
              : <span class="grid h-10 w-10 place-items-center rounded-md bg-primary/20 text-lg font-bold text-primary">{t.name.charAt(0)}</span>}
            <h4 class="text-lg font-semibold text-bright">{t.name}</h4>
          </div>
          <p class="mb-5 text-sm text-muted">{t.blurb}</p>
          <div class="mt-auto flex flex-wrap gap-3">
            <a href={t.deployUrl ?? t.docsUrl ?? t.url} target="_blank" rel="noopener noreferrer"
               class="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-bright">
              {t.deployUrl ? 'Deploy now' : 'View install guide'} <span aria-hidden="true">→</span>
            </a>
            {t.docsUrl && (
              <a href={t.docsUrl} target="_blank" rel="noopener noreferrer"
                 class="inline-flex items-center gap-2 rounded-md border border-edge-strong px-4 py-2 text-sm font-medium text-fg transition-colors hover:bg-raised">
                Docs
              </a>
            )}
          </div>
        </div>
      ))}
    </div>
  </section>

  <!-- Category grids -->
  {sortedCategories.map((cat) => (
    <section class="mt-10">
      <h3 class="text-[15px] font-semibold text-bright">{cat.title}</h3>
      <p class="mt-1 max-w-2xl text-[13px] text-dim">{cat.tagline}</p>
      <div class="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {targetsByCategory(cat.id).map((t) => (
          <PlatformCard target={t} stars={t.github ? stars[t.github] : undefined} />
        ))}
      </div>
    </section>
  ))}

  <!-- Investor depth band -->
  <section class="mt-10 border border-edge-strong bg-panel p-6 text-center md:p-8">
    <p class="mb-2 text-sm text-muted">Embedded across open-source ecosystems totaling</p>
    <div class="mb-3 text-3xl font-bold text-primary md:text-4xl">
      <span data-stars-total>{formatStars(totalStars)}</span>+ GitHub stars
    </div>
    <p class="mx-auto max-w-2xl text-sm text-muted">
      LibreDB Studio doesn’t just support these platforms — it ships inside communities that
      millions of developers already trust. More on the roadmap: {plannedNames.slice(0, 8).join(', ')}, and more.
    </p>
  </section>

  <!-- CTA -->
  <section class="mt-8 flex flex-wrap gap-3">
    <a href="/docker-compose-example" class="inline-flex items-center gap-2 rounded-md border border-edge-strong px-5 py-2.5 text-sm font-medium text-fg transition-colors hover:bg-raised">Docker Compose example</a>
    <a href="https://github.com/libredb/libredb-studio" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-2 rounded-md border border-edge-strong px-5 py-2.5 text-sm font-medium text-fg transition-colors hover:bg-raised">View on GitHub</a>
    <a href="https://app.libredb.org" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-bright">Try the live demo</a>
  </section>
</div>

<script>
  import { formatStars } from '../../lib/github-stars';

  async function refreshStars() {
    const spans = Array.from(document.querySelectorAll<HTMLElement>('[data-stars-repo]'));
    await Promise.all(
      spans.map(async (span) => {
        const repo = span.getAttribute('data-stars-repo');
        if (!repo) return;
        try {
          const res = await fetch(`https://api.github.com/repos/${repo}`, {
            headers: { Accept: 'application/vnd.github+json' },
          });
          if (!res.ok) return;
          const data = await res.json();
          if (typeof data.stargazers_count !== 'number') return;
          span.setAttribute('data-stars-count', String(data.stargazers_count));
          span.textContent = formatStars(data.stargazers_count);
        } catch {
          /* keep the baked-in number */
        }
      }),
    );
    const total = Array.from(document.querySelectorAll<HTMLElement>('[data-stars-count]'))
      .reduce((sum, el) => sum + (Number(el.getAttribute('data-stars-count')) || 0), 0);
    const totalEl = document.querySelector<HTMLElement>('[data-stars-total]');
    if (totalEl && total > 0) totalEl.textContent = formatStars(total);
  }
  refreshStars();
</script>
```

- [ ] **Step 2: Build + browser verify (homepage deploy is now rich)**

Run: `bunx astro build` → PASS (5 pages). (GitHub API 403s during build are expected and fall back to baked-in star counts — not a failure.)
In dev, open `/#deploy`: the deploy result pane now shows the summary strip, "Official one-click integrations" (Railway/CapRover), the category grids of `PlatformCard`s with star counts, the investor band, and the CTA — the same content `/deploy` used to have. Confirm:
```js
document.querySelectorAll('[data-section="deploy"] [data-stars-repo]').length > 0  // PlatformCards rendered
```

- [ ] **Step 3: Commit**

```bash
git add src/components/sections/DeploySection.astro
git commit -m "feat: DeploySection is the single rich source for deploy content"
```

---

### Task 5: Rewrite `deploy.astro` thin (shell-wrapped, single section, SEO preserved)

**Files:**
- Modify: `src/pages/deploy.astro`

**Interfaces:**
- Consumes: `StudioShell` (Task 2), `SectionShell`, `DeploySection` (Task 4), `sectionById`, Layout `head` slot (Task 1), `deployTargets` (for ItemList JSON-LD).

- [ ] **Step 1: Replace `deploy.astro` entirely**

Replace the ENTIRE contents of `src/pages/deploy.astro` with:
```astro
---
import Layout from '../layouts/Layout.astro';
import StudioShell from '../components/studio/StudioShell.astro';
import SectionShell from '../components/studio/SectionShell.astro';
import DeploySection from '../components/sections/DeploySection.astro';
import { sectionById } from '../data/sections';
import { deployTargets } from '../data/deploy-targets';

const title = 'Deploy LibreDB Studio Anywhere — One-Click Apps, Helm, Docker & Cloud';
const description =
  'Run the open-source LibreDB Studio SQL IDE anywhere: official Railway and CapRover one-click apps, Docker Hub & GHCR images, a Helm chart on Artifact Hub, npm, and every major open-source PaaS, managed PaaS, and cloud.';

const itemListSchema = {
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
};
---
<Layout title={title} description={description}>
  <script slot="head" is:inline type="application/ld+json" set:html={JSON.stringify(itemListSchema)} />
  <StudioShell active="deploy" standalone>
    <SectionShell section={sectionById['deploy']} active><DeploySection /></SectionShell>
  </StudioShell>
</Layout>
```

- [ ] **Step 2: Build + browser verify (/deploy in the shell, SEO intact)**

Run: `bunx astro build` → PASS (5 pages, including `/deploy/index.html`).
Verify the built page keeps its SEO and renders in the shell:
```bash
grep -c 'application/ld+json' dist/deploy/index.html   # >= 4 (3 global + 1 ItemList)
grep -o '<title>[^<]*</title>' dist/deploy/index.html   # the deploy title
grep -c 'data-studio' dist/deploy/index.html            # 1 (shell present)
```
In dev, open `/deploy`: it renders inside the IDE shell with deploy active (deploy.sql chrome, Explorer with deploy highlighted), showing the same rich `DeploySection`. Confirm standalone nav:
```js
document.querySelector('[data-studio]').hasAttribute('data-standalone')          // true
document.querySelector('[data-section-link="features"]').getAttribute('href')    // "/#features"
document.querySelector('.studio-section.is-active')?.id                          // "deploy"
```
Clicking Explorer "features" navigates to `/#features` (homepage, features active). No `<Header>`/`<Footer>` on `/deploy`.

- [ ] **Step 3: Commit**

```bash
git add src/pages/deploy.astro
git commit -m "feat: /deploy renders in the IDE shell via DeploySection (single source), SEO preserved"
```

---

### Task 6: QA pass

**Files:** none (verification + fixes only).

- [ ] **Step 1: Full build + sitemap**

Run: `bunx astro build`
Expected: PASS, 5 pages (`/`, `/deploy`, `/docker-compose-example`, `/privacy-policy`, `404`). Confirm `/deploy` still emitted (not dropped).
Run: `bun test src/` → still 21/21 pass (no test files changed; sanity that nothing broke imports).

- [ ] **Step 2: Single-source check**

Run: `grep -rl "Official one-click integrations" src/` 
Expected: ONLY `src/components/sections/DeploySection.astro` (the phrase exists in exactly one source file — proves no content duplication).

- [ ] **Step 3: Browser matrix (dev :4321), desktop 1440 + mobile 390**

- `/#deploy` (homepage): rich deploy content in the result pane; other sections still swap; ⌘K palette works; explorer links are `#section` (in-page).
- `/deploy`: same rich content in the shell, deploy active on load; explorer links are `/#section`; clicking one navigates to the homepage; no Header/Footer.
- Mobile `/deploy`: stacked, deploy query-card + content; hamburger drawer explorer links are `/#section`.
- Stars: PlatformCards show counts; investor band shows total.
- StatusBar on `/deploy` shows `deploy` / its row count (not `home`).

- [ ] **Step 4: Revert any tracked compose mutation (safety)**

Run: `git status --short` — if `src/data/docker-compose.example.yml` or `public/docker-compose.example.yml` show as modified (only happens if `bun run build` was used by mistake), revert them: `git checkout -- '**/docker-compose.example.yml'`. With `bunx astro build` they are untouched.

- [ ] **Step 5: Commit any fixes**

```bash
git add -A
git commit -m "test: QA pass for deploy unification (build, single-source, browser matrix)"
```

---

## Self-Review (completed by plan author)
- **Spec coverage:** Layout head slot (Task 1) ✓; StudioShell + Explorer/MobileTopBar/StatusBar standalone/active props + index adoption (Task 2) ✓; studio.ts standalone awareness — initial-active, setActive bail, link navigate, palette jump (Task 3) ✓; DeploySection single-source rich content + stars + refresh script (Task 4) ✓; thin deploy.astro in shell with SEO + ItemList via head slot (Task 5) ✓; SEO/no-redirect + single-source verification (Tasks 5–6) ✓.
- **Placeholder scan:** none — every code step is complete and verbatim; no TBD/TODO.
- **Type/name consistency:** `StudioShell` props `active`/`standalone`; data attributes `data-initial-active`/`data-standalone` read by `studio.ts` as `initialActive`/`standalone`; `Explorer`/`MobileTopBar` `standalone`; `StatusBar` `active`; `DeploySection` exports nothing new (self-contained). Script path `'../../scripts/studio.ts'` correct from `src/components/studio/`. `linkBase` derives from `standalone`. All consistent across tasks.
