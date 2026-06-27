# Product Positioning & Website IA — Design Spec

**Date:** 2026-06-27
**Branch:** `strategy/product-positioning`
**Status:** Approved direction, pending spec review

## Context

LibreDB now ships three products instead of one:

| Product | Audience | Job-to-be-done | Maturity | License |
|---|---|---|---|---|
| **Studio** | DBAs, analysts, backend devs | "Query/manage my databases" | Production | OSS (MIT) |
| **Database** (engine) | Systems/app developers | "Embed a storage engine in my app" | Pre-alpha | OSS |
| **Platform** | Enterprise teams | "Managed Studio + SSO + governance" | Commercial | Closed-source |

The current website is a single-page-app-style "SQL IDE shell": `[section].astro` renders sections (home, features, databases, …) from `sections.ts` inside `StudioShell`, with a left `Explorer` that mimics a `connection → schema → table` tree. Today the entire site is 100% Studio narrative.

**Primary business goal (3–6 mo): Studio adoption + community.** Studio stays the hero; Database is a "follow along / star / contribute" community channel; Platform is a discoverable background path — not the conversion focus.

### Problems being solved

1. **Namespace collision.** `/databases` currently lists the engines Studio *connects to* (PostgreSQL, MySQL…). With a product literally named "LibreDB database", this URL is a trap. → rename to `/providers`.
2. **No home for the engine.** The new OSS database has no presence on the site.
3. **No portfolio story.** The site reads as a single app, not an open-source data company with a product line.

## Positioning model: Brand house, single hero

- **LibreDB** = the open-source data company / brand. Mission: open, simple, no-magic data tooling.
- **Studio** = production hero. Drives traffic, adoption, community. Keeps the homepage and primary nav weight.
- **Database** = credibility + community play. Its own proud page, explicitly pre-alpha. Job is *engineering-depth signal* and contributor funnel, **not** conversion.
- **Platform** = commercial layer, kept light/background (external link).

**Guiding principle: visibility ≠ equal prominence.** Maturity badges (stable / pre-alpha / teams) let all three show without the pre-alpha engine dragging down brand trust.

## Information architecture

### Explorer tree → three schemas

The portfolio is expressed natively in the IDE metaphor. One connection (`libredb.org`), three schemas:

```
Connections
  ▦ libredb.org
Explorer
  ▾ ▦ studio                      (was "public")
      ▤ home            1
      ▤ features        17
      ▤ providers        7         (was "databases")
      ▤ compare          5
      ▤ tech_stack       4
      ▤ get_started      3
      ▤ faq              9
      ▤ deploy          39
      ▤ docker_compose  21
  ▾ ▦ database  🧪 pre-alpha
      ▤ manifesto       → /database
  ▾ ▦ platform  ↗ teams
      ↗ overview        → https://platform.libredb.org   (EXTERNAL, see Open Questions)
```

This communicates maturity visually: `studio` is full (9 tables, production), `database` is intentionally thin (1 table, honestly early), `platform` is external (commercial, lives elsewhere).

### URL changes

| Now | After | Mechanism |
|---|---|---|
| `/databases` | `/providers` | rename section + **301 redirect** in Astro config |
| — | `/database` | new engine manifesto page |
| `/` and all studio slugs | unchanged | — |

The `platform` overview is an **external** link (not a generated route).

## Data model changes

Introduce schema grouping while keeping the flat `sections` array (so `getStaticPaths`, `sectionById`, mobile cards keep working):

1. **New `src/data/schemas.ts`:**
   ```ts
   export interface SchemaMeta {
     id: 'studio' | 'database' | 'platform';
     label: string;          // tree heading
     badge?: string;         // e.g. "pre-alpha", "teams"
     badgeClass?: string;    // styling hook
     external?: { label: string; href: string; }; // for platform: link rows, no internal section
   }
   export const schemas: SchemaMeta[] = [ /* studio, database, platform in order */ ];
   ```
2. **`SectionMeta` gains `schema: 'studio' | 'database'`** (platform has no internal sections). Every existing section → `schema: 'studio'`. New `database` manifesto section → `schema: 'database'`.
3. **`Explorer.astro`** iterates `schemas`, and for each internal schema renders its sections (`sections.filter(s => s.schema === schema.id)`); for `platform` renders its `external` link rows with a `↗` glyph and `target="_blank" rel="noopener noreferrer"`. The count badge becomes total internal sections.

## Component / file changes

| File | Change |
|---|---|
| `src/data/sections.ts` | rename `databases`→`providers` (id, table, slug, query, copy, SEO); add `database` (manifesto) section with `schema`; add `schema: 'studio'` to all existing |
| `src/data/schemas.ts` | **new** — schema metadata + platform external link |
| `src/components/studio/Explorer.astro` | group by schema; render `studio` heading (was `public`); render platform external rows |
| `src/components/sections/DatabasesSection.astro` | rename → `ProvidersSection.astro`; copy reframed as "supported engines/providers" (content otherwise unchanged) |
| `src/components/sections/DatabaseSection.astro` | **new** — engine manifesto (see below) |
| `src/pages/[section].astro` | update `COMPONENTS` map (`providers`, `database`) |
| `src/components/Header.astro` | `Databases`→`Providers`; add light `Database 🧪` + `Platform ↗` links (visually secondary) |
| `src/components/Footer.astro` | add "Open Source" group: Studio · Database (pre-alpha) · Platform |
| `src/data/section-seo.ts` | add `database` JSON-LD (`SoftwareApplication`/`SoftwareSourceCode`, repo + MIT) |
| `astro.config.*` | add `redirects: { '/databases': '/providers' }` (301) |
| `src/data/sections.test.ts` | update slug/id assertions; add coverage for schema field + providers/database |

## `/database` page content (manifesto-driven)

Renders inside `StudioShell` (brand consistency) with a rich `SectionShell` body:

- **Hero:** "LibreDB — the embedded, multimodal database you can read in one sitting." + prominent **pre-alpha** badge.
- **Manifesto** (3–4 points): simple · no-magic · embeddable · FoundationDB-style architecture.
- **Embed snippet:** `bun add @libredb/libredb` + a minimal usage example.
- **Honest status box:** "Pre-alpha — not production ready. Early; star it, follow along, help shape it."
- **CTAs (community framing):** GitHub (star) · npm (`@libredb/libredb`) · docs. **No production "Get Started" promise** — deliberate expectation management to protect trust and avoid premature bug reports.
- Links: GitHub `https://github.com/libredb/libredb-database`, npm `https://www.npmjs.com/package/@libredb/libredb`.

## Studio side (preserved + minor touch)

- `/providers` keeps today's "One tool, all your databases" engine list; only the title/SEO shift to "supported engines/providers" language.
- Optional single-line database teaser on the home result-set (kept minimal so the Studio narrative stays clean). **Default: include one subtle line.**

## SEO

- 301 `/databases → /providers` (existing page is indexed; preserve link equity).
- New `/database`: title/description + `SoftwareApplication`/`SoftwareSourceCode` JSON-LD (codeRepository = libredb-database, license MIT).
- Sitemap regenerates automatically via `@astrojs/sitemap`.

## Out of scope (YAGNI)

- Platform pricing page and any platform marketing beyond the external link.
- Brand logo/lockup change ("LibreDB Studio" → "LibreDB" + product). Future consideration.
- Studio ↔ engine integration narrative ("Studio can connect to LibreDB").
- Database documentation content (lives in the engine repo for now).

## Open questions (to confirm during review)

1. **Platform URL** — spec assumes `https://platform.libredb.org`. Confirm the real target (or a temporary landing) before wiring the external node.
2. **Engine slug** — `/database` (singular) chosen. `/engine` was offered as a lower-collision alternative; staying with `/database` unless reconsidered.
3. **Home teaser line** — include the one-line database teaser on home (default yes) or keep home purely Studio?

## Success criteria

- `/databases` 301s to `/providers`; no broken internal links.
- Explorer shows three schemas with correct grouping, badges, and the platform external link opening in a new tab.
- `/database` page renders the manifesto with pre-alpha framing and community CTAs.
- All existing tests pass; `sections.test.ts` updated for the new slugs/schema.
- Studio remains the dominant narrative (homepage hero unchanged, primary nav weight intact).
