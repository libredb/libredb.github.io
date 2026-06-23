# Multi-Page Studio — every section is its own indexable URL

> Builds on the deploy-unify work (PR #5): `StudioShell.astro` + standalone mode
> already exist and `/deploy` already renders a single section in the shell.
> This generalizes that pattern to the WHOLE site: each Explorer "table" becomes
> its own real, indexable page; the Explorer left-menu navigates by URL; the
> homepage `#hash` in-page swap is removed. Smooth client-side transitions via
> Astro View Transitions.

## Decisions (locked with user, 2026-06-23)
- **Homepage model A**: `/` = home/hero only. Every other section is its own page.
  No single-scroll landing.
- Explorer left-menu links are **real URLs** (`/features`, `/`, `/deploy`), not
  `/#id`. Clicking navigates (with View Transitions for SPA-like smoothness).
- **In-page hash swap is removed entirely** (simpler `studio.ts`).
- **`/docker-compose-example` joins the studio** as the 9th Explorer table and a
  real studio page (user: "this is important — it must be in the left menu too").
- **View Transitions** (`astro:transitions` `<ClientRouter/>`) added for smooth
  navigation; chrome persists, the result pane animates.
- Out of scope (stay standalone, NOT Explorer tables): `/privacy-policy`, `404`.
  They keep Header/Footer for now.

## 1. Routing & slugs
| URL | Page source | Active section |
|---|---|---|
| `/` | `index.astro` | home (hero) |
| `/features` | `[section].astro` | features |
| `/databases` | `[section].astro` | databases |
| `/compare` | `[section].astro` | compare |
| `/tech-stack` | `[section].astro` | tech_stack |
| `/get-started` | `[section].astro` | get_started |
| `/faq` | `[section].astro` | faq |
| `/deploy` | `[section].astro` | deploy |
| `/docker-compose-example` | `[section].astro` | docker_compose |

- **One dynamic route** `src/pages/[section].astro` with `getStaticPaths()`
  emitting the 8 non-home slugs; it maps slug→Section component and renders
  `<StudioShell standalone active={id}>` + `<SectionShell section><Comp/></SectionShell>`.
- `index.astro` keeps `/` (home). `deploy.astro` and `docker-compose-example.astro`
  are **deleted** (replaced by the dynamic route + section components).
- **Slug field** added to `SectionMeta`: `slug` (home→`''`→`/`; underscores→hyphens;
  docker_compose→`docker-compose-example` to preserve the indexed URL).
- `getStaticPaths` returns `sections.filter(s => s.id !== 'home').map(s => ({ params: { section: s.slug }, props: { id: s.id } }))`.

## 2. The 9-table Explorer manifest (`src/data/sections.ts`)
Existing 8 entries gain `slug`, `pageTitle`, `pageDescription`. A 9th entry is added:
```
docker_compose:
  table: 'docker_compose'   slug: 'docker-compose-example'
  query: 'SELECT variable, default, description FROM env_vars;'
  columns: [variable VARCHAR, default VARCHAR, description TEXT]   rows: 21  cols: 3  execMs: 6
  explain: 'A copy-paste docker-compose.yml: pulls the published image, with every
            env var (auth, OIDC SSO, storage, AI/LLM, seed) — self-host in one command.'
  pageTitle: 'LibreDB Studio Docker Compose Example — Self-Host in Minutes'
  pageDescription: (existing description, verbatim)
```
(Per-section `pageTitle`/`pageDescription` drive each page's `<title>`/meta. Home's
page title stays the current homepage title.)

Optional per-section structured data: a small map (in the manifest or a sibling
`section-seo.ts`) of `id → JSON-LD object[]`:
- `deploy` → the ItemList schema (moved out of the deleted deploy.astro).
- `docker_compose` → the HowTo + SourceCode schemas (moved out of the deleted page).
The dynamic route injects these into `<head>` via the Layout `head` slot.

## 3. Shell, Explorer, and the removal of in-page swap
- **Explorer/MobileTopBar**: section links become real URLs `href={s.slug === '' ? '/' : '/' + s.slug}`. The `standalone` prop is replaced by this URL model (every studio page links by URL now). `active` (server-rendered per page) sets the highlight.
- **Every studio page renders ONE section**, server-marked active and always shown.
  The `.studio.js .studio-section { display:none unless .is-active }` swap rule is
  removed; a single section simply fills the pane (`flex-col h-full`, results scroll).
- **`StudioShell`**: keeps `active`; `standalone` becomes the default/only mode
  (single-section). It renders the chrome + one section slot. `data-initial-active`
  retained for `studio.ts`.

## 4. `studio.ts` simplification
Remove: `setActive` section-swap toggling, hash routing (`hashchange`/`popstate`),
`onLinkClick` swap, the `is-active` juggling. Section links are plain `<a href>`
navigations. Keep + adapt for View Transitions (`astro:page-load`):
- Command palette (open/close/keyboard) — "Jump to {section}" → `location.href = '/'+slug` (with `''`→`/`).
- Explorer search filter + Enter → `location.href = '/'+firstMatch.slug`.
- Console toasts; RUN shimmer + toast; Copy deep link (now copies `origin + '/' + slug`); Export; Explain toggle; column expand; mobile drawer.
- Active-row highlight: set on `astro:page-load` from `location.pathname` (since chrome persists across transitions).
Net: the file shrinks substantially (no swap/hash engine).

## 5. View Transitions
- Add `<ClientRouter />` (`astro:transitions`) in `Layout.astro` `<head>`.
- Mark persistent chrome with `transition:persist`: TopBar, the Explorer sidebar,
  StatusBar, Console, CommandPalette (so they don't flicker; the result pane
  cross-fades). The `<main class="studio-pane">` content transitions.
- Re-run interaction wiring on `astro:page-load` (studio.ts subscribes to it instead
  of only `DOMContentLoaded`). Respect `prefers-reduced-motion` (Astro VT already does;
  keep our shimmer guard).

## 6. Content extraction (single source; mostly already components)
- home/features/databases/compare/tech_stack/get_started/faq → already section
  components; reused by the dynamic route. No content rewrite.
- deploy → `DeploySection.astro` already the single rich source (PR #5). Reused.
- **`DockerComposeSection.astro` (NEW)** — single source of the docker-compose
  content lifted from the deleted page: quick-start block + copy button, the full
  `docker-compose.example.yml` via `<Code lang="yaml">`, the 5 env-var reference
  tables, the links row, and the `.copy-btn` client `<script>` + the `.compose-code`
  scoped style. Imports `composeYaml` from `../../data/docker-compose.example.yml?raw`.

## 7. Internal links updated to real URLs
- Footer "Product" (`/#features` → `/features`, etc.; Docker Compose link →
  `/docker-compose-example`), HomeSection CTAs, get_started pointer (`/#…` → `/…`),
  Header nav (used by the remaining standalone pages) → `/features` etc.
- Hash anchors were never separately indexed, so no redirects needed. (Optional:
  none required.)

## 8. Files
```
src/data/sections.ts                         MOD  + slug/pageTitle/pageDescription on 8; + docker_compose (9th)
src/data/section-seo.ts                      NEW  id → JSON-LD[] (deploy ItemList; docker_compose HowTo+SourceCode)
src/pages/index.astro                        MOD  StudioShell active=home + HomeSection (home page) + home SEO
src/pages/[section].astro                    NEW  dynamic route: getStaticPaths over non-home slugs; slug→component; per-section SEO + head-slot JSON-LD
src/pages/deploy.astro                       DEL  (replaced by [section].astro)
src/pages/docker-compose-example.astro       DEL  (replaced by [section].astro + DockerComposeSection)
src/components/sections/DockerComposeSection.astro  NEW  single-source compose content (+ copy script + style)
src/components/studio/StudioShell.astro      MOD  single-section mode; real-URL link model
src/components/studio/Explorer.astro         MOD  links = real URLs by slug; active highlight
src/components/studio/MobileTopBar.astro     MOD  same link model
src/scripts/studio.ts                        MOD  remove swap/hash engine; palette/search navigate by URL; astro:page-load lifecycle; active-row sync
src/styles/global.css                        MOD  remove swap display rule; single-section always-shown
src/layouts/Layout.astro                     MOD  add <ClientRouter/>; keep head slot
src/components/Footer.astro / Header.astro   MOD  internal links → real section URLs
```

## 9. SEO
- 9 indexable URLs, each with its own `<title>`/description/self-canonical → far
  better coverage than today's `/` + `/deploy`. Astro sitemap auto-includes all routes.
- `/deploy` ItemList and `/docker-compose-example` HowTo+SourceCode JSON-LD preserved
  via the per-section SEO map + head slot. Existing global JSON-LD stays on every page.
- `/deploy` and `/docker-compose-example` keep their exact current URLs → indexing continuity.

## 10. Out of scope
`/privacy-policy`, `404` remain standalone Header/Footer pages (not Explorer tables).
A later pass could fold them into the shell, but they are not "tables".

## 11. Success criteria
- 9 real pages build; Explorer shows 9 tables; clicking any navigates by URL.
- `/`, `/deploy`, `/docker-compose-example` keep their URLs + structured data.
- No in-page hash swap remains; `studio.ts` has no setActive/hashchange engine.
- View Transitions: navigating between sections animates; chrome doesn't flicker;
  reduced-motion respected. Studio interactions (palette/search/run/copy/export/
  explain/toasts/drawer) work after every navigation.
- `bunx astro build` passes; `bun test` green; deploy/docker-compose content each
  authored in exactly one source file.
```
