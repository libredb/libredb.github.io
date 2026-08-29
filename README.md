# Handoff: LibreDB Studio — Marketing Website (Astro + Outstatic)

## Overview

Homepage design for **LibreDB Studio**, an open-source (MIT) browser-based database IDE that deploys next to the database ("the tool goes to the data"). The target implementation is a **static Astro site** with **Outstatic** as the Git-backed CMS for blog content.

## About the Design Files

Files under `design/` are **design references created in HTML** — a working prototype showing intended look and behavior, not production code to copy verbatim. The task is to **recreate this design in an Astro codebase** using Astro components, scoped styles and islands where interactivity is needed. `design/Home.dc.html` opens directly in a browser (keep the sibling `support.js`, `ds/`, `assets/`, `uploads/` folders next to it).

## Fidelity

**High-fidelity.** Colors, typography, spacing, copy and interactions are final. Recreate pixel-perfectly. All visual values resolve to CSS custom properties defined in `design-system/tokens/*.css` — use those stylesheets as-is (global import), do not re-derive values.

## Design system (binding)

`design-system/` is the full LibreDB Web Design System:

- `styles.css` — single entry point, `@import`s all tokens. Import globally in Astro (`src/styles/`).
- `tokens/` — colors, theme (light/dark via `[data-theme]`), typography, spacing, shape, elevation, motion, layout, base resets.
- `assets/` — brand SVG lockups (`lb-icon.svg`, `lb-logo-h-dark/light/white.svg`, etc.).
- `components/` — reference React implementations (`.jsx` + `.d.ts` + `.prompt.md` spec per component). Port to `.astro` components (or keep as React islands only where stateful).
- Rules that must survive the port: hairline 1px borders, no decorative shadows at rest, max two background tones per page, both 135° gradients (`--gradient-brand`, `--gradient-data`) only on approved surfaces, sentence case, no emoji, Turkish number/date conventions in TR copy.

**Fonts:** the homepage design overrides the DS default (Geist) with **Plus Jakarta Sans** (body/UI/headings; weights 400–800) and **JetBrains Mono** (all mono: eyebrows, commands, chips, terminal; 400–700), loaded from Google Fonts. Keep this override: set `--font-body/--font-ui/--font-heading/--font-mono` after importing the DS.

## Screens / Sections (design/Home.dc.html, top → bottom)

1. **Header** — sticky, 72px, hairline border on scroll; logo, anchor nav, GitHub + "Teklif al" style CTA.
2. **Hero** (`#top`) — centered, Antigravity-style entrance: badge pill → H1 (word-by-word `lbWord` animation: fade + translateY(20px) + blur(8px)→0, 60–70ms stagger; second line uses `--gradient-brand` background-clip text) → subcopy → buttons ("Open the live demo" primary, GitHub secondary) → docker one-liner copy box (JetBrains Mono, copy-to-clipboard button with "copied" state). Background: `assets/hero-bg-f.jpg` aurora image + two darkening overlay gradients (radial center + linear bottom fade to `#0b0d18`); content contrast must be preserved. Below: uploaded product demo (`uploads/libredb-studio-demo.html`) inside a browser-chrome frame (traffic dots + "studio.internal" address bar) with a 1px gradient border wrapper — in Astro embed as lazy iframe or rebuild as component.
3. **Why it exists** (`#why`) — two-column: prose left; right an **interactive diagram** cycling 4 access scenarios (expose port ✕ / SSH tunnel ✕ / desktop client ✕ / Studio in-network ✓) every 2.6s, clickable rows pin for 9s; animated dashed connection line changes color (error→success tokens), Studio container fades in on step 4. Lower band: "The tool goes to the data" + second interactive diagram with a Data→tool / Tool→data segmented toggle (auto-flips 3.6s), direction-reversing dashed line, four spec chips lighting up.
4. **How it deploys** (`#deploy` area) — 4-step scroll narrative + deploy tabs (Docker / Compose / Helm / Binary) with mono code blocks and copy buttons.
5. **Databases** (`#databases`) — hexagon grid of 16 engine logos (devicon/simpleicons CDN), click → detail panel with honest capability lines; gradient 2px top rule (`--gradient-data`).
6. **Product demo** (`#product`) — 5 tabs (Product tour, Mobile, SQL editor, ER diagram, Health) with live Netlify iframes where available, animated mock fallbacks.
7. **Features** (`#features`) — 6 cards, each with Lucide-style 1.5px-stroke inline SVG icon in a 40px `--surface-brand` tile + mono index number.
8. **Open source** (`#open-source`) — capability table + gradient stat band (100% coverage, 27 channels, MIT).
9. **CTA** — `--gradient-brand` panel with `assets/hero-bg-a.png` texture overlay (opacity .2, luminosity blend), white logo, headline with `--gradient-data` clipped phrase, buttons.
10. **Footer** — dark, hairline-separated columns.

Ambient section washes: very-low-opacity radial gradients (indigo/emerald/blue, rgba ≤ .12) on `#why`, `#databases`, `#product`, `#open-source`, `#deploy` — decorative only, `aria-hidden`, `pointer-events:none`.

Headline gradient phrases (background-clip text) per section are deliberate and final — see markup.

## Interactions & Behavior

- All timings/easings from `tokens/motion.css` (`--duration-*`, `--ease-out`); hover = one movement only; `prefers-reduced-motion` collapses to opacity.
- Keyframes used: `lbWord` (hero entrance), `lbDashX`/`lbDashXR` (dashed line flow), `lbPulse` (live dot), `lbFlow` (SVG dash), `lbUp` (scroll reveal). Scroll reveals: IntersectionObserver, 20px up + fade, 60ms stagger.
- Copy buttons: clipboard write + 2s "copied" feedback.
- Theme: DS supports light/dark (`data-theme`); homepage is dark-first.

## State (Astro islands)

Interactive pieces that need a framework island (or small vanilla script): why-diagram cycler (interval + pin timeout), flow toggle, deploy tabs, demo tabs, engines grid selection, copy buttons, scroll reveal observer. Everything else is static HTML/CSS.

## Blog (to build, no design yet)

Blog index + post detail follow the DS "Blog / content" rules: 16px/1.75 body at 680px measure, mono metadata, sticky ToC on articles. Content comes from **Outstatic** (`/outstatic` route, content in `outstatic/content/` as Markdown in the repo). Use Astro content-layer or direct file reads of Outstatic's markdown at build time.

## Assets

- `design/assets/hero-bg-f.jpg` — hero aurora background (AI-generated, licensed for use).
- `design/assets/hero-bg-a.png` — CTA texture.
- `design/ds/assets/` + `design-system/assets/` — brand SVGs.
- Engine logos loaded from `cdn.jsdelivr.net/gh/devicons/...` and `cdn.simpleicons.org` — self-host for production.
- `design/uploads/libredb-studio-demo.html` — self-contained product demo page (embed as iframe).
- Live embeds referenced: `app.libredb.org` demo instances (Netlify).

## Files

- `design/Home.dc.html` — the full homepage prototype (template markup + logic class at the bottom of the file).
- `design/ds/styles.css` — flattened token sheet the prototype links.
- `design-system/` — canonical tokens, component specs, brand assets.
- `CLAUDE_PROMPT.md` — starter prompt for the Claude coding agent.
