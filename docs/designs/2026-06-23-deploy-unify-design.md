# Unify Deploy — single-source content, consistent IDE shell (B2)

> Problem: `/deploy` (a Google-indexed URL) renders as a classic centered
> Header/Footer page, while the homepage Explorer→deploy shows a sparse IDE
> result-set teaser. Two different approaches AND two different content depths.
> Goal: one rich deploy content authored ONCE, shown in the SAME IDE shell both
> on the homepage `#deploy` section and at `/deploy` — without losing `/deploy`'s
> SEO and without duplicating content or the shell.

## Decisions (locked with user, 2026-06-23)
- **B2**: keep `/deploy` as a real, indexed page (do NOT redirect — it's indexed;
  a hash `/#deploy` is not a separate indexable URL, so redirecting would
  consolidate `/deploy` into the homepage and drop the dedicated URL).
- **Single source, hard requirement**: the deploy *content* is authored exactly
  once (in `DeploySection.astro`) and rendered from two places. No second copy.
- **Shared shell**: extract the IDE chrome into `StudioShell.astro` so both pages
  use one shell (no shell duplication either).
- Scope: deploy only. Other sub-pages (`/docker-compose-example`,
  `/privacy-policy`, `/404`) keep Header/Footer for now (separate future pass).

## Architecture

### 1. `StudioShell.astro` (NEW) — the one IDE chrome
Extracts what `index.astro` currently inlines: desktop `TopBar`, `MobileTopBar`,
the workbench (`<aside>` Explorer sidebar + `<main class="studio-pane">` with a
`<slot/>` for sections), desktop `StatusBar`, `Console`, `CommandPalette`, and the
`<script>import '../scripts/studio.ts'</script>`.
- Props:
  - `active: string` — the initially-active section id.
  - `standalone?: boolean` (default `false`) — true for focused sub-pages (`/deploy`)
    that render a single section; flips Explorer/MobileTopBar links to absolute
    `/#{id}` (navigate to the homepage studio) and tells `studio.ts` not to do
    in-page swapping.
- Root element carries flags for the script:
  `<div class="studio" data-studio data-standalone={standalone ? '' : null} data-initial-active={active}>`.

### 2. `index.astro` (MOD)
Replace the inlined shell with `<StudioShell active="home">` wrapping the existing
8 `<SectionShell>`s in the default slot. No behavior change (home active, in-page
swap, palette, etc. all unchanged). The deploy `SectionShell` now contains the rich
`<DeploySection />` (see §4).

### 3. `deploy.astro` (MOD → thin, ~25 lines)
```
<Layout title={deployTitle} description={deployDescription}>
  <Fragment slot="head"><script type="application/ld+json" set:html={ItemList JSON-LD} /></Fragment>
  <StudioShell active="deploy" standalone>
    <SectionShell section={sectionById['deploy']}><DeploySection /></SectionShell>
  </StudioShell>
</Layout>
```
- Keeps its own `<title>`, meta description, automatic canonical (`/deploy`), and
  the deploy **ItemList JSON-LD** (deploy-specific structured data — authored once
  here; it is metadata, not the visible content, so this is not content duplication).
- Drops `<Header/>`, `<Footer/>`, the centered `<main>` layout, the breadcrumb, and
  ALL the inline visible deploy markup (that markup moves into `DeploySection`).
- The build-time `getStars` call and the client star-refresh `<script>` move into
  `DeploySection` (single source), so `deploy.astro` does not re-author them.

### 4. `DeploySection.astro` (MOD) — the SINGLE source of deploy content
Becomes the rich content (lifted verbatim from old `deploy.astro`'s body), replacing
the current sparse teaser (5 count-cards + chips + "+N more"):
- Header: `SectionHeader` "Deploy anywhere" + subtitle with `{platformCount}+
  platforms and {installMethodCount} install methods`.
- A compact **summary strip** (keep the existing 5 category count-cards as an
  at-a-glance band — nice in the IDE result view).
- **Official one-click integrations**: cards for `status === 'official'`
  (Railway, CapRover) — logo, blurb, Deploy-now/Install-guide + Docs buttons.
- **Category-grouped platform list**: for each `deployCategory` (ordered) → group
  title + tagline + responsive grid of `<PlatformCard target stars=…>`; targets
  sorted official→available→planned.
- **Investor band**: "{totalStars}+ GitHub stars" + planned-names line.
- Build-time stars: `const stars = await getStars(starRepos)` in frontmatter,
  passed to each `PlatformCard`.
- Client **star-refresh `<script>`** (the `[data-stars-repo]` live-update + total)
  lives here too — so it runs wherever `DeploySection` is rendered.
- Rendered by BOTH `index.astro` (homepage `#deploy` pane, scrolls) and
  `deploy.astro`. Authored once.
- Internal CTA links (Docker Compose example, GitHub, live demo) kept.

### 5. `Explorer.astro` + `MobileTopBar.astro` (MOD)
Add a `standalone?: boolean` prop. Section links become
`${standalone ? '/' : ''}#${id}` → `#features` on the homepage (in-page swap),
`/#features` on `/deploy` (navigate home). `MobileTopBar` forwards `standalone` to
its drawer `Explorer`.

### 6. `studio.ts` (MOD) — standalone awareness
- Read flags from `[data-studio]`: `standalone = dataset.standalone !== undefined`;
  `initialActive = dataset.initialActive || 'home'`.
- Initial active on load: `location.hash ? currentHash() : initialActive` (so
  `/deploy` with no hash activates `deploy`).
- `setActive(id)`: **no-op if `[data-section="${id}"]` is absent** from the DOM
  (protects focused pages from blanking on an unknown hash).
- `onLinkClick`: when `standalone`, do NOT `preventDefault` — let the `/#{id}`
  anchor navigate to the homepage (no in-page swap on focused pages).
- Command palette "Jump to {section}": when `standalone`, navigate via
  `location.href = '/#'+id` instead of setting `location.hash`.
- All other behaviors (toasts, run, copy, export, explain, search) unchanged and
  work on `/deploy` (deploy section present).

### 7. `Layout.astro` (MOD)
Add a named `head` slot (`<slot name="head" />` inside `<head>`) so a page can inject
page-specific `<head>` content (deploy's ItemList JSON-LD). Existing global JSON-LD
unchanged. Homepage adds nothing to this slot (no duplicate ItemList across URLs).

## SEO
- `/deploy` keeps its URL, `<title>`, description, self-canonical, and ItemList
  JSON-LD → stays indexed; a same-URL design change does not deindex it.
- Homepage JSON-LD unchanged. Deploy content appearing on both `/` (one section
  among many) and `/deploy` (focused) is the standard section + dedicated-page
  pattern; each self-canonicalises.
- Internal links to `/deploy` (Hero "Deploy in one click", get_started pointer,
  Header/Footer "Deploy") stay as `/deploy` (it's a real page).

## Files
```
src/components/studio/StudioShell.astro     NEW  extracted shell (active, standalone)
src/pages/index.astro                       MOD  use StudioShell active=home + 8 sections
src/pages/deploy.astro                      MOD  thin: Layout(SEO+ItemList) + StudioShell standalone + DeploySection; drop Header/Footer/centered layout & inline deploy markup
src/components/sections/DeploySection.astro MOD  rich SINGLE-SOURCE content (summary + official + grouped PlatformCards + investor band) + getStars + star-refresh script
src/components/studio/Explorer.astro        MOD  standalone -> /#id links
src/components/studio/MobileTopBar.astro    MOD  forward standalone to drawer Explorer
src/scripts/studio.ts                       MOD  standalone awareness (data flags, setActive bail, link navigate, palette jump)
src/layouts/Layout.astro                    MOD  add named `head` slot
```
Unchanged data: `deploy-targets.ts`, `deploy-categories.ts`, `sections.ts`.
`PlatformCard.astro` / `StatusBadge.astro` now consumed by `DeploySection` (were by `deploy.astro`).

## Success criteria
- The deploy content exists in exactly ONE source file (`DeploySection.astro`);
  `index.astro` and `deploy.astro` both render `<DeploySection/>` with no copied markup.
- Homepage `#deploy` and `/deploy` show the same rich content in the same IDE shell.
- `/deploy` still returns 200 at its own URL with its `<title>` + ItemList JSON-LD
  (indexing preserved); no redirect.
- On `/deploy`, Explorer/palette navigation to other tables goes to `/#section`;
  deploy stays active on load.
- `bunx astro build` passes; homepage and `/deploy` both render; existing homepage
  interactions (swap/palette/toasts/etc.) unaffected.
```
