# Interactive Controls — "Zero Dead Clicks" Design

> Follow-up to the IDE redesign (`REDESIGN-SPEC.md`). The site is styled as the
> LibreDB Studio IDE, so it exposes many product affordances (RUN, Save, Explain,
> result tabs, README.md, search…) that are currently decorative and do nothing
> when clicked. On a developer-tool site, visitors *will* click them — silent
> dead clicks erode trust. This spec makes every control either **real** or
> **respond in character**, and turns the constraint into a conversion funnel.

## Guiding principle
**Zero dead clicks.** Every interactive-looking control does one of three things:
1. **Real** — performs a genuine, useful action.
2. **Playful redirect** — prints an in-character console message (bold SQL-error
   humor) that explains the real feature and links to the live app/docs.
3. **Honestly inert** — pure status/ambient text; no pointer, not button-like.

Decisions locked with the user (2026-06-23): direction = **tiered hybrid**;
tone = **bold & playful**; scope = **Rich** (core + command palette + export +
explain). Max-tier items are explicitly out of scope (see §7).

## 1. Control disposition matrix

### 🟢 Real
| Control | Action |
|---|---|
| Explorer search input | Live-filter the explorer tree by table name (fuzzy/substring); `Enter` jumps to the first match (sets hash → triggers existing routing). |
| `⌘K` / `Ctrl+K` (global) | Open the **command palette**. |
| `✦ AI` (sub-toolbar), `✦ NL2SQL` (result tab) | Open the command palette (framed as the "ask anything" entry point). |
| `▶ RUN`, `⌘+Enter` | "Re-run" the current query: ~500ms shimmer over the result content, then a console line `✓ {rows} rows ({execMs}ms)`. No data changes. |
| `⧉ Copy` | Copy a deep link to the current section (`https://libredb.org/#{id}`) to clipboard; console line `✓ copied link to #{id}`. |
| `↑ Export` | Download the current section's dataset as a file (`features.json`, `deploy.csv`, …); console line `✓ exported {filename} ({n} rows)`. |
| `✦ Explain` (sub-toolbar) & `⚡ Explain` (result tab) | Toggle an inline AI-styled explanation panel for the current section. |
| `▤ Docs` (result tab) | Open the GitHub docs in a new tab. |
| `README.md` tab | Open the GitHub README in a new tab. |

### 🟡 Playful redirect (console toast + CTA)
`◷ Monitoring`, `▾ Query`, `▤ Save`, `BEGIN`, `⬡ SANDBOX`, `✎ EDIT`, `↑ IMPORT`,
`≡ Format`, `✕ Clear`, `# Lines`, and result tabs `↺ History`, `⭐ Saved`,
`◔ Charts`, `✈ Autopilot`, `▥ Pivot`, `⇄ Diff`, `▦ Dashboard`, plus the tab-bar
`+` (new tab) and `✕` (close tab). Each prints a tailored message (see §4) and
most carry an `→ Open demo` / `→ View docs` CTA.

### ⚪ Honestly inert (no pointer, status only)
TopBar `PRODUCTION • ONLINE`, `● Online`, version label, the
`▤ ＋` brand-adjacent glyphs; the result-meta strip (`● N rows | C columns |
EXEC TIME`); the entire StatusBar; traffic-light dots in tab bar & mobile query
card. Apply `cursor: default`, no hover affordance, `aria-hidden="true"` where
purely decorative. (`★ GitHub` and `Live Demo →` stay real links.)

## 2. Mechanisms

### 2.1 Console toast — `src/components/studio/Console.astro`
- A fixed container: bottom-right of the result pane on desktop, bottom-center on
  mobile. Holds a small stack (max ~3) of terminal-style message lines.
- Line anatomy: monospace; a colored prefix token — `NOTICE` (primary/blue),
  `ERROR` (bad/red), `HINT` (faint), or a `--` comment (faint) / `✓` (ok/green);
  message text (`text-fg`); optional CTA `<a>` button (bordered, `text-primary`).
- Auto-dismiss after ~6s (pause on hover); manual `✕` to dismiss. New messages
  push older ones up; identical repeats refresh the timer instead of stacking.
- Container is an `aria-live="polite"` region. CTAs are real links
  (`target="_blank"` for external).
- JS API (in `studio.ts`): `studioConsole.push({ kind, text, hint?, cta? })`
  where `kind ∈ {notice, error, ok, comment}`. Helpers: `.notice()`, `.error()`,
  `.ok()`.

### 2.2 Command palette — `src/components/studio/CommandPalette.astro`
- Hidden modal overlay (centered card ~max-w-lg, dim backdrop). Opened by `⌘K` /
  `Ctrl+K`, by the `✦ AI` / `NL2SQL` controls, and optionally by clicking the
  Explorer search affordance.
- A text input (placeholder `Type a command or search sections…`) + a filtered
  list. Items:
  - **Jump to section** — one per section from `sections` manifest (icon + table
    name + row count). Executing sets `location.hash = #{id}`.
  - **Actions** — `Copy link to current section`, `Export current section`,
    `Open live demo`, `Open GitHub`, `Open docs`, `View README`.
- Keyboard: `⌘K`/`Ctrl+K` toggle, type to fuzzy-filter, `↑`/`↓` move highlight,
  `Enter` execute, `Esc` close. Mouse hover highlights; click executes.
- a11y: `role="dialog"` `aria-modal="true"`, focus moves to input on open, focus
  trap within the card, focus returns to the previously focused element on close.
- The TopBar gains a subtle `⌘K` hint chip (real button that opens the palette).

### 2.3 Explain panel
- An inline, collapsible panel rendered per section (below the editor, above the
  result content on desktop; inline on mobile). Hidden by default; toggled by the
  Explain controls. Styled as AI output: a sparkle/`✦` glyph in `text-ai`, a
  short heading like `AI · Query explanation`, and the body copy.
- Copy source: a new `explain: string` field on `SectionMeta` in
  `src/data/sections.ts` (one plain-language paragraph per section describing what
  the "query" returns — reinforces the AI-IDE story).
- Implemented inside `SectionShell.astro` (so each section has its own panel,
  consistent with the per-section chrome model). Toggle via `data-action="explain"`
  scoped to the section; `aria-expanded` + `aria-controls` on the buttons.

### 2.4 Export
- Each content section component emits its dataset as embedded JSON:
  `<script type="application/json" data-export={id} data-export-filename="…" data-export-format="json|csv">…</script>` rendered from the same array the
  component already maps over (no central data refactor; low coupling).
- `studio.ts` reads the active section's payload, builds a `Blob`, and triggers a
  download (`features.json`, `databases.json`, `compare.csv`, `tech_stack.json`,
  `get_started.json`, `faq.json`, `deploy.csv`). CSV for naturally tabular sets
  (compare, deploy), JSON otherwise. `home` exports its stats as `home.json`.
- Then `studioConsole.ok('exported {filename} ({n} rows)')`.

## 3. Wiring scheme (`studio.ts`)
Generic, attribute-driven so markup stays declarative and DRY:
- `data-action="palette|copy-link|export|run|explain|docs|readme|notice"` on the
  control element.
- For redirects: `data-action="notice"` + `data-notice="{key}"` referencing a copy
  map (§4). `studio.ts` delegates a single click listener on the studio root,
  reads `data-action`/`data-notice`, and dispatches.
- All redirect/real controls become real `<button type="button">` (or `<a>` for
  external) with `aria-label`s; inert elements lose pointer affordances.

## 4. Console copy map (bold & playful) — initial draft
```
monitoring -- nothing's on fire here. live monitoring runs in the app → Open demo
save       ERROR 42501: permission denied — must be superuser
           HINT: superusers hang out in the live demo            → Open demo
query      NOTICE: visual query builder lives in the app          → Open demo
begin      NOTICE: BEGIN…COMMIT runs real transactions in the app → Open demo
sandbox    NOTICE: SANDBOX = throwaway scratch queries, in the app→ Open demo
edit       -- read-only out here; full edit mode is in the app    → Open demo
import     NOTICE: import .sql / .csv dumps in the live app       → Open demo
format     NOTICE: one-key SQL formatting ships in the app        → Open demo
clear      -- nothing to clear on a landing page ;)
lines      # line numbers are always on around here
history    ↺ query history is per-workspace — open the app        → Open demo
saved      ⭐ saved queries live in your workspace                 → Open demo
charts     NOTICE: turn any result into a chart — in the app      → Open demo
autopilot  NOTICE: Autopilot auto-tunes slow queries for you      → Open demo
pivot      -- this trick only works in production                 → Open demo
diff       ⇄ schema & data diff is a live-app feature             → Open demo
dashboard  ▦ build live dashboards from your queries — in the app → Open demo
newtab     NOTICE: more tabs unlock in the app                    → Open demo
closetab   -- you can't close the one thing selling you on us ;)
```
(Copy is final-draft; polish allowed during implementation. `Open demo` →
`https://app.libredb.org`; docs CTA → GitHub docs URL.)

## 5. Accessibility & progressive enhancement
- Palette: focus trap, `Esc`, focus restore, `aria-modal`. Toasts: `aria-live`.
- Real controls are buttons/links with `aria-label`s; honest-inert elements get
  `cursor: default`, no hover, `aria-hidden` when decorative, no `tabindex`.
- Respect `prefers-reduced-motion` for the RUN shimmer and palette transitions.
- No-JS: all section content remains present and navigable (unchanged). Palette,
  toasts, export, run-animation, explain-toggle simply don't activate; external
  links (Docs, README, Live Demo, GitHub) still work. Nothing breaks.

## 6. Files
```
src/components/studio/Console.astro          NEW — toast container
src/components/studio/CommandPalette.astro   NEW — ⌘K modal
src/components/studio/SectionShell.astro     + Explain panel per section
src/components/studio/QueryChrome.astro      + data-action attrs on controls; inert markup
src/components/studio/MobileQueryCard.astro  + data-action attrs (Explain)
src/components/studio/TopBar.astro           + ⌘K hint chip; inert status markup
src/components/studio/StatusBar.astro        inert markup (cursor/aria)
src/components/studio/Explorer.astro         search input → real filter hook
src/components/sections/*Section.astro       emit embedded export JSON payload
src/data/sections.ts                         + explain: string per section
src/scripts/studio.ts                         palette / toast / export / run / copy /
                                              explain / search-filter / redirect dispatch
src/pages/index.astro                         mount <Console/> + <CommandPalette/>
```

## 7. Out of scope (Max tier — deferred)
README.md as a real in-page view (we open GitHub instead); Charts rendering real
charts (redirect for now); Saved/History as real bookmark/log (redirect);
`Format` as real pretty-printer (redirect). These can be promoted later.

## 8. Success criteria
- Clicking any chrome control produces a real action or an in-character console
  response — never silence. Verified across desktop + mobile.
- `⌘K`, Explorer search, Copy, Export, RUN animation, Explain all function.
- Keyboard + screen-reader usable (palette, toasts, buttons).
- `bunx astro build` passes; no regressions to the existing routing/swap.

## 9. Complete control coverage (every button has an action)
Grouped by toolbar region. 🟢 real · 🟡 playful redirect (console) · 🔵 active/selected.

**Top bar**
| Button | Type | Action |
|---|---|---|
| Monitoring | 🟡 | `-- nothing's on fire here. live monitoring runs in the app → Open demo` |
| README.md (tab) | 🟢 | Open GitHub README in a new tab |

**Query toolbar — Query · Save · RUN · BEGIN · SANDBOX · EDIT · IMPORT**
| Button | Type | Action |
|---|---|---|
| Query ▾ | 🟡 | `NOTICE: the visual query builder is a live-app superpower → Open demo` |
| Save | 🟡 | `ERROR 42501: permission denied — must be superuser` · `HINT: superusers save queries in the live demo → Become one` |
| RUN (⌘+Enter) | 🟢 | Re-run: ~500ms shimmer over results → `✓ {rows} rows ({execMs}ms)` |
| BEGIN | 🟡 | `NOTICE: BEGIN…COMMIT — real transactions, real database. In the app → Open demo` |
| SANDBOX | 🟡 | `NOTICE: SANDBOX runs scary queries safely. Try it in the app → Open demo` |
| EDIT | 🟡 | `-- this query is read-only out here; full edit mode lives in the app → Open demo` |
| IMPORT | 🟡 | `NOTICE: drop a .sql/.csv and IMPORT it — in the live app → Open demo` |

**Sub-toolbar — Format · Copy · Clear · Lines · AI · Explain**
| Button | Type | Action |
|---|---|---|
| Format | 🟡 | `NOTICE: one-keystroke SQL formatting ships in the app → Open demo` |
| Copy | 🟢 | Copy deep link to current section → `✓ copied link to #{id}` |
| Clear | 🟡 | `-- nothing to clear on a landing page ;)` (no CTA) |
| Lines | 🟡 | `# line numbers are bolted on around here` (no CTA) |
| AI ✦ | 🟢 | Open the command palette (the "ask anything" entry) |
| Explain ✦ | 🟢 | Toggle the AI-styled Explain panel for the section |

**Result tabs — Results · Explain · History · Saved · Charts · NL2SQL · Autopilot · Pivot · Docs · Diff · Dashboard · Export**
| Button | Type | Action |
|---|---|---|
| Results | 🔵 | Active/selected tab — clicking scrolls the result pane to top |
| Explain ⚡ | 🟢 | Toggle the Explain panel (same as sub-toolbar Explain) |
| History | 🟡 | `↺ every query you run is logged per-workspace — in the app → Open demo` |
| Saved | 🟡 | `⭐ star a query to save it — saved queries live in the app → Open demo` |
| Charts | 🟡 | `◔ turn any result set into a chart, one click — in the app → Open demo` |
| NL2SQL | 🟢 | Open the command palette (natural-language entry) |
| Autopilot | 🟡 | `NOTICE: Autopilot hunts slow queries and writes the fix. In the app → Open demo` |
| Pivot | 🟡 | `▥ pivot any result like a spreadsheet — only works in production → Open demo` |
| Docs | 🟢 | Open GitHub docs in a new tab |
| Diff | 🟡 | `⇄ diff two schemas or result sets side-by-side — in the app → Open demo` |
| Dashboard | 🟡 | `▦ pin queries into a live dashboard — build yours in the app → Open demo` |
| Export | 🟢 | Download section dataset (`features.json`, `deploy.csv`…) → `✓ exported {file}` |

Coverage: **0 dead clicks.** 12 real · most-of-the-rest playful redirect · only
ambient status text stays inert (PRODUCTION•ONLINE, ●Online, version, result-meta,
status bar, traffic dots).
