# Declutter the studio shell — design

**Date:** 2026-07-15 · **Branch:** `design/declutter-shell`

## Problem

The IDE-shell concept is loved, but the page is overloaded. Measured on the
desktop homepage (multi-agent audit, 6 dimensions + adversarial critique):

- ~70 interactive chrome elements render before any marketing content
  (~66 tab stops before the first CTA for keyboard users).
- 19 buttons are `data-action="notice"` no-ops occupying tab order.
- The same datum repeats: row count ×3, exec time ×2, `home.sql` ×3,
  Connected/Online ×4, version ×3 (`v0.9.29` twice + a conflicting `v1.2.5`),
  GitHub reachable from 4 chrome slots, open-source/MIT stated 4×.
- 5–6 accent hues compete in one viewport (rainbow DB names, 4-color stats,
  multi-color badges); no single accent moment.
- QueryChrome stacks 5 horizontal strips above the H1 (~y=395px).

## Principles

1. **One strip, one job.** No datum appears twice in the shell.
2. **Semantic color budget.** Blue = interactive/CTA (filled blue on exactly
   two elements: Live Demo + RUN). Green = connection state, one animated
   pulse total (StatusBar). Amber = warning/early-beta only. Purple = AI only.
   Red = errors only. Everything else zinc.
3. **Progressive disclosure, not deletion.** The console-notice gags are demo
   funnels — they survive one click deeper (Query menu, `⋯` overflow, ⌘K
   palette) or become non-focusable spans. The IDE fiction stays.
4. **Chrome type scale:** 11 / 12 / 13 / 15 px only (no half-pixel steps).
5. Mono stays everywhere (spec: mono-first). Body copy gets reading
   ergonomics (measure/leading), not a sans face.

## Changes

### TopBar (12 items → 5)
Cut: `▤ ＋` dead glyphs, the whole `libredb.org` connection chip (owner:
"zaten bu sitedeyim" — the visitor is already here), `PRODUCTION • ONLINE`,
separate Online pill, Monitoring button, `v0.9.29`. Monitoring gag re-homed
as a ⌘K palette entry. Keep: brand, ★ GitHub, Playground, ⌘K, Live Demo
(filled). Mobile top bar mirrors this: brand instead of URL, no ONLINE line.

### QueryChrome (5 strips → 3 bands, 29 interactive → 7 visible)
Owner-directed final form (tightened beyond the audit consensus):
- Tab bar: `{table}.sql` + ✕ (kept gag), `＋` demoted to span. README.md tab
  removed — GitHub lives in TopBar + StatusBar.
- Both toolbars deleted. **RUN** moved into the editor gutter, in front of
  the SQL statement (DataGrip-style); ⌘+Enter chip dropped (shortcut still
  wired, surfaced via `title`). Query/Save/Copy/BEGIN/SANDBOX/EDIT/IMPORT/
  Format/Clear/Lines/AI removed from chrome (Copy/Export/AI stay reachable
  via ⌘K palette).
- Results row: Results, ✦ Explain (single trigger), and a `⋯` overflow with
  History/Saved/Charts/NL2SQL/Autopilot/Pivot/Diff/Dashboard (notices
  intact). Docs tab and the `{rows} · {cols} · {ms}` + Export meta removed —
  RUN's console toast still reports rows/ms in-fiction.
- Result-meta strip deleted — it was 100 % duplicate data.
- Net: keyboard path to the hero CTA is 28 tab stops (was ~66).

### StatusBar (15 items → 11)
Keep: Connected (the one animated pulse), the real links (promoted to
`text-muted`), one faint identity cluster `Ln 1, Col 1 · UTF-8 · SQL · ◆ v0.9.29`.
Cut: `LibreDB:latest`, `public`, `{table}.sql`, `{rows} rows`, duplicate brand.
Added later at owner request: X, YouTube, Instagram and Reddit (r/libredb)
links — the status bar is the site's only footer, the conventional home for
socials, and all four channels are actively maintained.

### Explorer
Connection box, CONNECTIONS label, the "▤ Explorer · 14" header row and the
search placeholder all removed (owner: the visitor is already on
libredb.org; the tree speaks for itself — sidebar is now search + tree). Schema badges quieted to lowercase `text-dim`, no border/accent.
Row counts stay (core "table = page" loop) but carets dim at rest and
brighten on hover/active. Rows default `text-muted`, active bright
(Railway dim pattern). Column `◆` icons → `text-dim`. Sidebar footer
deleted (duplicate Connected + conflicting `v1.2.5`).
Toggles: `tabindex="-1"`, ≥24 px hit area (36 px in drawer).

### HomeSection
One-fact-one-owner rule (owner-directed final form): badge owns the
license/open-source claim, H1 owns AI + "SQL IDE", the subtitle owns the
engine list + SSO, the CTAs own demo/deploy. Everything that restated one
of those went:
- **Stats grid deleted** — all four tiles (1-click deploy, MIT, AI, SSO)
  duplicated facts already visible in the same viewport.
- Subtitle rewritten: "One editor for 'PostgreSQL' … 'Redis' — in your
  browser, with SSO built in." The 7 DB names render as **quoted green SQL
  string literals** — one hue, in-fiction, replacing the 5-hue rainbow.
- Badge pill kept (the single open-source/MIT signal), dot static.
- Tip comments and the open-core footnote deleted entirely — the explorer
  rows read as navigation on their own, and the family cards' status labels
  already tell the open-core story (the sustainability pitch belongs on
  /platform or the FAQ); family heading → "one core, three products";
  studio card no longer a self-link (div, keeps ring + "you are here");
  sponsor line dropped (StatusBar link covers it).
- Export payload now ships the engine list instead of the deleted stats.
- **Promo video** (owner request): the 60s YouTube promo sits under the
  CTAs as a click-to-load facade — self-hosted poster + play button, zero
  third-party bytes/cookies at rest; on play, studio.ts swaps in a
  `youtube-nocookie.com` iframe with autoplay. Keeps the page light and
  consent-clean while giving the hero its "real product in motion" proof.

### Accessibility bundle
Skip-to-content link (in-character), `aria-label="Explorer"` on asides,
global `:focus-visible` ring in primary, mobile drawer ✕ and Explain ≥40 px
hit areas, mobile CTA relabeled `▶ Live Demo` (was a dishonest `RUN`),
toast NOTICES lose leading glyphs (SR noise) and pause on keyboard focus,
~15 fake buttons demoted to spans (delegated handler works on any Element).

### Deploy page
Synced with `distribution/channels.yaml` in the studio repo (the channel
inventory): Homebrew, Snap Store and GitHub Releases (tarballs + .deb/.rpm)
were live channels missing from the site — now first-class registry cards.
Every "planned" target (26 of the original 39) is **deleted from the data**
(owner call: the site lists only what ships today; roadmap lives in
channels.yaml). The all-planned "Cloud hyperscalers" category is replaced
by one positive comment line — "any Docker host works today" — which says
more than five aspirational cards did. Summary strip and the investor
star-total band are deleted (counts duplicated the sections below; summing
third-party platforms' stars overstated traction). Also fixed a real bug:
the star-refresh script used `import` inside a `data-astro-rerun` inline
script, which throws at runtime — live star counts had silently never
refreshed; the helper is now mirrored inline.

### Section-page color discipline (cheap, systemic)
Features kickers: 7-color map → `text-dim` (AI keeps `text-ai`; SECURITY no
longer error-red). TechStack layer headers + Reliability stat numbers →
`text-bright`. Providers keeps its syntax-mimicry colors, but Redis moves off
the `text-bad` error token.

## Out of scope (follow-ups)
- Docker-compose page: `<details>` per env-var group; nest under deploy in tree.
- Deploy page: generate `deploy-targets.ts` from `distribution/channels.yaml`
  (single source of truth, kills drift).
- Hero "one live moment" (query types itself once, VT-safe).
- Trust row under stats (GitHub stars / quote as SQL comment).
- Tokenized type scale in `@theme` + CI guard against new `text-[..px]` in chrome.
