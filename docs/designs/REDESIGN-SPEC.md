# LibreDB Website Redesign — Design & Implementation Spec

> Source of truth: `docs/designs/LibreDBStudio-Desktop.html` and `…-Mobile.html`
> (professional design exports). Rendered references captured in
> `docs/designs/_ref/` — `desktop.css` (full CSS), `desktop.body.html`
> (rendered DOM), `sections-text.json` (all section copy), `shots/*.png`
> (per-section screenshots, desktop + mobile).

## 1. Concept

The entire website is reimagined as an **interactive database IDE** — the
"LibreDB Studio" product shell itself. The site doesn't *describe* the product;
it *is* a live demo of it. Every content section is a **table** in a schema
explorer; selecting it "runs a query" and renders the content as a styled
**result set**.

This makes the marketing site indistinguishable from the product — the strongest
possible proof for a SQL IDE.

## 2. Design tokens (extracted, exact)

```
FONT          JetBrains Mono — everywhere (mono-first). Fallback: ui-monospace, monospace.
CORNERS       Sharp by default (0px). 6px on chips/buttons/cards. No large radii.

— Surfaces —
--bg          #0a0a0c   app base
--panel       #0c0c0f   panels, cards, query editor
--elevated    #16181d   hover / raised rows
--green-tint  #0d1410   success-tinted surface (sparingly)

— Borders —
--border      #1d1d22   default hairline
--border-2    #27272d   stronger divider
--border-3    #3f3f46   zinc-700, emphasis

— Text —
--fg          #e4e4e7   primary (zinc-200)
--fg-bright   #fafafa   headings / white
--muted       #a1a1aa   zinc-400
--muted-2     #71717a   zinc-500 (labels, most common)
--faint       #52525b   zinc-600

— Accent / semantic —
--primary     #2f6feb   blue — buttons, links, active, SQL keywords accent
--green       #4ade80   true / online / strings / success
--red         #f87171   false / destructive / SQL keyword red
--salmon      #f07178   syntax keyword (alt red)
--amber       #fbbf24   partial / MIT / warning / numbers
--purple      #a78bfa   AI features
```

Maps cleanly onto Tailwind's `zinc` scale + `blue/green/red/amber/violet-400`.
These become `@theme` tokens in `src/styles/global.css`.

## 3. Layout architecture

### Desktop (≥ lg)  — viewport-locked IDE, three zones + bars
```
┌─ TOP BAR ───────────────────────────────────────────────────────────┐
│ ◆ LibreDB Studio │ libredb.org PRODUCTION•ONLINE │ GitHub★ Online Monitoring  [Live Demo→] v0.9.29 │
├──────────────┬──────────────────────────────────────────────────────┤
│ SIDEBAR      │ TAB BAR:  README.md  │ {table}.sql ✕   +               │
│ Connections  │ QUERY TOOLBAR: ▾Query Save  [▶RUN]  BEGIN SANDBOX EDIT │
│  libredb.org │ SUB-TOOLBAR:  Format Copy Clear Lines AI  ·  Explain ⌘↵│
│              │ EDITOR:  1 │ SELECT … FROM {table} …;                   │
│ Explorer (8) │ RESULTS TABS: Results Explain History Saved Charts …   │
│  ▾ public    │ RESULT META:  ● N rows │ C columns │ {table}.sql  EXEC  │
│   ▸ home  1  │ ┌─ RESULT CONTENT (the section) ──────────────────────┐│
│   ▸ features │ │  …rendered section…                                  ││
│   … 8 tables │ └─────────────────────────────────────────────────────┘│
│ ●Connected   │                                                        │
├──────────────┴──────────────────────────────────────────────────────┤
│ STATUS BAR: ●Connected PostgreSQL 16.2 │ public │ {table}.sql … Ln1 Col1 UTF-8 SQL ◆ v0.9.29 │
└──────────────────────────────────────────────────────────────────────┘
```
- Selecting an explorer table swaps: active tab name, the `SELECT …` query, the
  result meta (row/col counts, exec time), and the result content.
- Only the active section's content is shown at a time.

### Mobile  — vertical scroll
```
┌ TOP BAR: ☰  ◆ libredb.org ●ONLINE•PostgreSQL  [▶RUN] ┐
│ QUERY CARD:  # {table}.sql  ⚡Explain                  │
│              SELECT … ;                                │
│              ● N rows │ C cols           [Nms]         │
│ … section content (stacked, full width) …             │
└───────────────────────────────────────────────────────┘
☰ opens a left DRAWER = Connections + Explorer tree (jump to section).
```

### Implementation model (Astro)
- **All 8 sections render into the DOM** (one `index.astro`). Good for SEO.
- **Desktop:** show only the active section; explorer click toggles via small
  client script + URL hash (`#features`). Viewport-locked shell, internal scroll
  in result pane.
- **Mobile:** the same sections display **stacked & scrolling**, each preceded by
  its compact query-card header; drawer links jump (anchor) to a section.
- One responsive component set drives both; CSS handles desktop-swap vs
  mobile-stack. Progressive enhancement: with JS off, desktop falls back to
  stacked scroll too (content always present).
- Standalone pages (`/deploy`, `/docker-compose-example`, `/privacy-policy`,
  `/404`) are restyled in the same language; the homepage `deploy` table shows a
  summary + “+15 more →” linking to `/deploy`.

## 4. Section render patterns (the 8 tables)

| table | query (shown in editor) | schema (columns) | render |
|---|---|---|---|
| **home** | `SELECT * FROM libredb_studio;` | headline, tagline, stats(JSONB) | Hero: badge, big 2-tone H1, subtitle w/ colored DB names, 2 CTAs, 4-stat grid |
| **features** | `SELECT name, category, summary FROM features ORDER BY category` | name, category(ENUM), summary | Card grid; each card = category tag + title + summary |
| **databases** | `SELECT name, type, driver FROM databases` | name, type, driver | List/grid: engine name + `type · driver` |
| **compare** | `SELECT * FROM tools ORDER BY freedom DESC;` | tool, scores(BOOL[]), price | Result TABLE: cols TOOL/ZERO_INSTALL/MOBILE/AI_NATIVE/SSO_OIDC/FREE/PRICE; true=green false=red partial=amber; LibreDB row highlighted ★recommended. Mobile → stacked cards w/ chips |
| **tech_stack** | `SELECT layer, tools FROM tech_stack` | layer, tools(TEXT[]) | Grouped by layer (FRONTEND, EDITOR & DATA…) each with tool + role |
| **get_started** | `SELECT step, title, command FROM quickstart ORDER BY step;` | step(INT), title, command | 3 numbered step cards w/ shell command blocks |
| **faq** | `SELECT * FROM faq;` | question, answer | Accordion (first open) |
| **deploy** | `SELECT platform, category FROM deploy_targets ORDER BY category;` | platform, category, method | 5 category count-cards + platform chips + “+15 more →” to /deploy |

Exact copy per section: see `docs/designs/_ref/sections-text.json` and the
content inventory (§6). Counts: features 17 · databases 7 · compare 5×7 ·
tech_stack 4 · get_started 3 · faq 7 · deploy 39 (5 categories).

## 5. Component plan

```
src/styles/global.css            → new @theme tokens (mono, zinc, semantic), base
src/layouts/Layout.astro         → head/SEO/fonts (JetBrains Mono), keep meta
src/components/studio/
  TopBar.astro                   → desktop top bar
  StatusBar.astro                → desktop bottom status bar
  Explorer.astro                 → sidebar schema tree (desktop) + drawer (mobile)
  QueryHeader.astro              → tab + query toolbar + editor + results-tab + meta
                                    (desktop chrome; mobile = compact query card)
  MobileTopBar.astro             → mobile top bar + hamburger
src/components/sections/
  HomeSection.astro    (home)
  FeaturesSection.astro
  DatabasesSection.astro
  CompareSection.astro
  TechStackSection.astro
  GetStartedSection.astro
  FaqSection.astro
  DeploySection.astro
src/scripts/studio.ts            → explorer select / tab swap / hash routing (desktop)
src/pages/index.astro            → compose shell + sections
+ restyle: deploy.astro, docker-compose-example.astro, privacy-policy.astro, 404.astro
```
Data reused as-is: `src/data/deploy-targets.ts`, `deploy-categories.ts`.
Other section data (features, compare, databases, tech_stack, get_started, faq)
extracted from current components into small typed data modules under `src/data/`.

## 6. Content contract
Preserve ALL existing copy. Full verbatim inventory appended by the content-audit
pass (see companion section / agent output). Verify counts & facts against the
live site (libredb.org) and the GitHub repo when in doubt.

### Resolved decisions (2026-06-23)
1. **Testimonials**: DROPPED from homepage (design has no testimonials table).
   Content remains in git history; can return later as a `reviews` table.
2. **Interaction model**: HYBRID (faithful to design) — desktop view-swap with
   URL hash routing (`#features`), mobile stacked scroll, drawer jumps. All
   content always in DOM; JS-off falls back to stacked scroll on desktop too.

### Content notes (from content audit)
- Deploy: data file has **42** platforms / 5 categories (design's "39" was a
  snapshot). Use the live `deploy-targets.ts` count dynamically.
- FAQ: **9** Q&A pairs exist (design showed 7). Keep all 9 (accordion scales).
- All current copy preserved verbatim per the content inventory.

## ✅ Status (2026-06-23) — IMPLEMENTED
All 7 build steps complete & verified. `bunx astro build` passes (5 pages).
Build screenshots in `_ref/build/`. Notable fix: the `base` color token collided
with Tailwind's `text-base` font-size utility (hid text ≥sm) → token renamed to
`canvas`. Orphaned legacy components removed; Header/Footer/CookieConsent and the
4 standalone pages restyled to the IDE language. Dev preview: `bun run dev` → :4321.

## 7. Build order (incremental, verify each)
1. Tokens + Layout head (global.css, Layout.astro, fonts) — no visual regressions baseline.
2. Studio shell: TopBar, StatusBar, Explorer, mobile top bar + drawer (static, home active).
3. HomeSection (hero) — validate look vs `shots/desktop-home.png` + `mobile-home.png`.
4. Sections in order: features → databases → compare → tech_stack → get_started → faq → deploy.
5. studio.ts interaction (explorer select, tab swap, hash, mobile drawer jump).
6. Restyle standalone pages (/deploy, /docker-compose-example, /privacy-policy, /404).
7. Full QA: responsive (sm/md/lg/xl), keyboard a11y, Lighthouse, build, link audit.
```
```
