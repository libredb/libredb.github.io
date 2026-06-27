# Product Positioning & Website IA — Design Spec

**Date:** 2026-06-27
**Branch:** `strategy/product-positioning`
**Status:** Design complete — ready for implementation planning

## Context

LibreDB now ships three products instead of one, and all three are real and reachable:

| Product | Audience | Job-to-be-done | Maturity | License | Where it lives |
|---|---|---|---|---|---|
| **Studio** | DBAs, analysts, backend devs | "Query/manage my databases" | Production | OSS (MIT) | this site (hero) |
| **Database** (engine) | Systems/app developers | "Embed a storage engine in my app" | Pre-alpha (`0.0.x`) | OSS (MIT) | `/database` (this site) + GitHub + npm |
| **Platform** | Enterprise teams | "Managed Studio + governance + audit" | **Live, beta** | Closed-source | `platform.libredb.org` (external) |

The current website is a single-page-app-style "SQL IDE shell": `[section].astro` renders sections (home, features, databases, …) from `sections.ts` inside `StudioShell`, with a left `Explorer` that mimics a `connection → schema → table` tree. Today the entire site is 100% Studio narrative.

**Primary business goal (3–6 mo): Studio adoption + community.** Studio stays the hero; Database is a "follow along / star / contribute" community + credibility channel; Platform is a discoverable open-core background path — not the conversion focus.

**The connective tissue across all three** is the engine manifesto's own line, which maps the family exactly:

> LibreDB **Database** is the plain core of data. LibreDB **Studio** is the understandable face of data. LibreDB **Platform** is the manageable form of data for teams. All three speak the same spine.

### Problems being solved

1. **Namespace collision.** `/databases` currently lists the engines Studio *connects to* (PostgreSQL, MySQL…). With a product literally named "LibreDB database", this URL is a trap. → rename to `/providers`.
2. **No home for the engine.** The new OSS database has no presence on the site.
3. **No portfolio story.** The site reads as a single app, not an open-source data company with a sustainable open-core product line.

## Positioning model: Brand house, single hero, open core

- **LibreDB** = the open-source data company / brand. Mission: open, simple, no-magic data tooling.
- **Studio** = production hero. Drives traffic, adoption, community. Keeps the homepage and primary nav weight.
- **Database** = credibility + community play. Its own proud page (3 tables), explicitly pre-alpha. Job is *engineering-depth signal* and contributor funnel, **not** conversion.
- **Platform** = commercial layer. Kept light/background: an honest open-core family block on-site + an external link. Real selling happens at `platform.libredb.org`.
- **Open-core model** = the trust narrative tying it together. Studio is free & open and self-hostable; Platform is the managed, paid layer that funds the open-source work — the proven pattern of Supabase, Metabase, Superset/Preset, Neon, YugabyteDB. This reassures the community that the OSS is sustainable, not abandonware.

**Guiding principle: visibility ≠ equal prominence.** Maturity badges (stable / pre-alpha / beta-teams) let all three show without the pre-alpha engine or the commercial layer dragging down brand trust or stealing Studio's focus.

## Information architecture

### Explorer tree → three schemas

The portfolio is expressed natively in the IDE metaphor. One connection (`libredb.org`), three schemas:

```
Connections
  ▦ libredb.org
Explorer
  ▾ ▦ studio                      (was "public")
      ▤ home            1
      ▤ features        18         (+1: out-of-the-box sample card)
      ▤ providers        8         (was "databases"; +1: LibreDB native provider entry)
      ▤ compare          5
      ▤ tech_stack       4
      ▤ get_started      3
      ▤ faq              9
      ▤ deploy          39
      ▤ docker_compose  21
  ▾ ▦ database  🧪 pre-alpha
      ▤ manifesto        6         → /database
      ▤ architecture     3         → /database-architecture
      ▤ reliability      4         → /database-reliability
  ▾ ▦ platform  ↗ teams · beta
      ↗ overview        → https://platform.libredb.org   (EXTERNAL)
```

This communicates maturity visually: `studio` is full (9 tables, production), `database` is a proud-but-thin credibility trio (3 tables, honestly pre-alpha), `platform` is external (commercial, beta, lives elsewhere).

### URL changes

| Now | After | Mechanism |
|---|---|---|
| `/databases` | `/providers` | rename section + **301 redirect** in Astro config |
| — | `/database` | new engine **manifesto** page (canonical engine page; gets JSON-LD) |
| — | `/database-architecture` | new engine **architecture** page |
| — | `/database-reliability` | new engine **reliability** page |
| `/` and all studio slugs | unchanged | — |

Slugs are flat (matching the existing flat-slug architecture); the `database-` prefix groups them clearly for SEO/sharing while the Explorer expresses the schema grouping visually. The `platform` overview is an **external** link (not a generated route). No internal `/platform` route.

## Data model changes

Introduce schema grouping while keeping the flat `sections` array (so `getStaticPaths`, `sectionById`, mobile cards keep working):

1. **New `src/data/schemas.ts`:**
   ```ts
   export interface SchemaMeta {
     id: 'studio' | 'database' | 'platform';
     label: string;          // tree heading
     badge?: string;         // e.g. "pre-alpha", "beta · teams"
     badgeClass?: string;    // styling hook
     external?: { label: string; href: string; }; // for platform: link rows, no internal section
   }
   export const schemas: SchemaMeta[] = [ /* studio, database, platform in order */ ];
   ```
2. **`SectionMeta` gains `schema: 'studio' | 'database'`** (platform has no internal sections). Every existing section → `schema: 'studio'`. Three new `database` sections → `schema: 'database'`.
3. **`Explorer.astro`** iterates `schemas`, and for each internal schema renders its sections (`sections.filter(s => s.schema === schema.id)`); for `platform` renders its `external` link rows with a `↗` glyph and `target="_blank" rel="noopener noreferrer"`. The count badge becomes total internal sections per schema.

## `/database` engine pages — three "tables" (credibility trio)

All three render inside `StudioShell` (brand consistency) with rich `SectionShell` bodies. Tone: proud, technical, honest, an invitation to read/learn/contribute. CTAs are **community** (star, follow, read the source) — **never** a production "Get Started" promise. Full API docs stay in the engine repo (`docs/guides/`); the site links out rather than duplicating.

### `manifesto` (`/database`) — *the why* · canonical engine page
- **Hero:** "LibreDB — the embedded, multimodal database you can read in one sitting." + prominent **pre-alpha 🧪** badge. Tagline: *"Multi-model without the magic. One core, three lenses, every line tested."*
- **Against complexity:** "Born against the unnecessary complexity of the database world… we are not at war with ORMs — we are against the database experience that *forces* you into one."
- **The wedge (featured callout):** *"Competes with the textbook and the `Map` hack — not with Postgres."* Read, learn, hack, embed.
- **Nothing is hidden:** query · schema · errors · plans all visible.
- **One core, three faces:** Database · Studio · Platform speak the same spine → **bridge to Studio** (see Bridges, below).
- **Embed snippet (Usage A):** `bun add @libredb/libredb` + the one-file three-lens example (kv + doc + table). Link to engine repo guides for depth.
- **Shared footer block** (all three pages): honest status box ("Pre-alpha — not production ready. Star it, follow along, help shape it.") + community CTAs (GitHub star · npm `@libredb/libredb` · docs).

### `architecture` (`/database-architecture`) — *the how*
- **One core, three lenses:** an ordered byte key-value kernel + thin kv/document/relational lenses (FoundationDB pattern). Re-draw the "one core, three lenses" diagram in the site's brutalist/SQL aesthetic (do **not** import the repo PNGs).
- **The trust boundary = the file boundary:** "below the line guarded, above the line open" — the contribution-model story (contributor funnel).
- **The WAL *is* the database:** the memorable single-file insight ("Redis AOF" lineage).

### `reliability` (`/database-reliability`) — *why you can trust it*
- **Crash recovery you can trust:** length-framed + CRC-32 checksummed WAL, fsync-before-commit, torn-tail truncation.
- **Deterministic simulation testing:** seeded `SimFS`, crash/recovery torture, the invariant (recovered state is always a valid committed prefix).
- **The numbers (credibility badges):** ~712 LOC shipped · 0 runtime deps · 2.83 kB bundled (min+brotli, 4 kB CI budget) · 100% core line coverage · `core.ts` under 600 lines. (All sourced from the engine's README + CODE-METRICS; keep figures honest and roughly stated.)
- **Honest limits ("when NOT to use"):** O(n) scans / no secondary indexes, single-process, RAM-bounded working set, log-grows-until-compaction, pre-alpha. Framed as deliberate v1 scope, not hidden gaps.

## The three Studio↔engine bridges (lightly in scope)

The previously out-of-scope "Studio ↔ engine integration narrative" is now real (Studio 0.9.32 ships the engine embedded), so it enters scope **lightly** — placed in three spots, all of which keep Studio the hero and feed Database as a supporting channel.

1. **Studio → engine (discovery):**
   - **`features` card:** *"Opens ready-to-use — zero setup. No empty screen on first launch. Studio ships with a live `Sample (LibreDB)` connection powered by our open-source embedded engine — explore relational, document, and key-value side by side, no server required. Editable, deletable, off by one env flag."*
   - **`home` family block (resolves old open Q#3):** a secondary "THE LIBREDB FAMILY — one spine, three faces" block lower on home (Studio hero stays dominant) that lists the three products and the open-core line, and carries the live-sample teaser. See Platform, below — this is the same block.
2. **Engine → Studio (reverse bridge, kept to one line):** on `/database` manifesto, under "one core, three faces": *"Want to see it live? LibreDB Studio opens with a ready-to-use LibreDB sample — all three lenses, zero setup."* → link to Studio / get_started. No provider mechanics here.
3. **`/providers` → LibreDB as a native provider (Usage B):** add LibreDB to the supported-engines list as *our own, first-class, embedded* provider:
   > **LibreDB** · *embedded · our own engine* — Open a `.libredb` file directly in Studio, no server required. Browse all three lenses (relational · document · key-value) and query with a small `get / put / prefix / range` command grammar (not SQL). Ships as a ready-to-use sample on first launch. → `/database`

   (Provider internals — Strategy Pattern, `BaseDatabaseProvider`, env vars — stay in the Studio repo; only the user-facing nuggets surface here.)

## Platform — light open-core presence

Chosen weight: **light open-core family block + external link** (not minimal, not a full internal page). Real marketing/pricing stays at the live beta `platform.libredb.org`.

- **Home family block** (shared with bridge #1 above): a compact, honest block framing all three products and the open-core model.
  ```
  THE LIBREDB FAMILY — one spine, three faces
    ▦ database   the plain core         OSS · pre-alpha
    ▦ studio     the readable face      OSS · stable      ← hero
    ▦ platform   managed for teams      beta ↗
  "Open core: Studio is free & open; Platform funds the open-source work."
  ```
  Platform row links to `platform.libredb.org` (new tab). Studio row is visually weighted as the hero. Database row links to `/database`.
- **Platform value (one honest line, for those who need it):** *"Database Access Governance for teams — stop distributing connection strings. Centralized, authorized, audited access. (Beta.)"* Capabilities (RBAC, audit, multi-tenant, managed Studio) are named only briefly; depth lives on the platform site.
- **Explorer:** `platform` schema = a single external `↗ overview` row → `platform.libredb.org`, badge `beta · teams`.
- **Footer:** a "Products" group — Studio · Database (pre-alpha) · Platform (beta ↗) — with honest labels.
- **No internal `/platform` route, no pricing page on this site.**

## Component / file changes

| File | Change |
|---|---|
| `src/data/sections.ts` | rename `databases`→`providers` (id, table, slug, query, copy, SEO); add LibreDB-native-provider entry to providers copy; add three `database` sections (`database`/`database-architecture`/`database-reliability`) with `schema: 'database'`; add `features` sample card; add `schema: 'studio'` to all existing |
| `src/data/schemas.ts` | **new** — schema metadata (studio/database/platform) + platform external link |
| `src/components/studio/Explorer.astro` | group by schema; render `studio` heading (was `public`); render `database` trio with pre-alpha badge; render platform external row |
| `src/components/sections/DatabasesSection.astro` | rename → `ProvidersSection.astro`; copy reframed as "supported engines/providers"; add LibreDB native-provider entry |
| `src/components/sections/DatabaseSection.astro` | **new** — manifesto page (engine canonical) |
| `src/components/sections/DatabaseArchitectureSection.astro` | **new** — architecture page |
| `src/components/sections/DatabaseReliabilitySection.astro` | **new** — reliability page |
| `src/components/sections/HomeSection.astro` (or home component) | add the "LibreDB family / open-core" block + live-sample teaser |
| `src/pages/[section].astro` | update `COMPONENTS` map (`providers`, `database`, `database-architecture`, `database-reliability`) |
| `src/components/Header.astro` | `Databases`→`Providers`; add light `Database 🧪` link; add `Platform ↗` (visually secondary) |
| `src/components/Footer.astro` | add "Products" group: Studio · Database (pre-alpha) · Platform (beta ↗) |
| `src/data/section-seo.ts` | add `database` JSON-LD (`SoftwareApplication`/`SoftwareSourceCode`, repo + MIT) on the manifesto page; light SEO for the two secondary engine pages |
| `astro.config.*` | add `redirects: { '/databases': '/providers' }` (301) |
| `src/data/sections.test.ts` | update slug/id assertions; add coverage for `schema` field + providers/database trio |

## SEO

- 301 `/databases → /providers` (existing page is indexed; preserve link equity).
- `/database` (manifesto): full title/description + `SoftwareApplication`/`SoftwareSourceCode` JSON-LD (codeRepository = libredb-database, license MIT). The two secondary engine pages get standard title/description.
- Sitemap regenerates automatically via `@astrojs/sitemap`.

## Out of scope (YAGNI)

- Platform pricing page or full platform marketing on this site (lives at `platform.libredb.org`).
- A dedicated internal `/platform` route.
- Brand logo/lockup change ("LibreDB Studio" → "LibreDB" + product). Future consideration.
- Heavy Studio↔engine integration narrative beyond the three light bridges above.
- Engine API/guide documentation content (lives in the engine repo; the site links out).
- A `faq` entry for the embedded sample (deferred — not now).

## Resolved decisions (were open questions)

1. **Platform URL** — confirmed `https://platform.libredb.org`, live in **beta**. External node wired to it.
2. **Engine slug** — `/database` (singular) is the canonical manifesto page; secondary engine pages use the `database-` prefix.
3. **Home teaser** — **yes**, folded into the "LibreDB family / open-core" block (a real Studio first-run benefit, not abstract cross-promotion).
4. **Database tree depth** — **3 tables** (manifesto + architecture + reliability): proud but clearly thinner than Studio's 9.
5. **Platform weight** — **light**: open-core family block + external link; no internal page, no pricing.

## Success criteria

- `/databases` 301s to `/providers`; no broken internal links.
- Explorer shows three schemas with correct grouping, badges (pre-alpha, beta · teams), and the platform external link opening in a new tab.
- `/database`, `/database-architecture`, `/database-reliability` render the credibility trio with pre-alpha framing and community CTAs (no production "Get Started").
- The three Studio↔engine bridges are present: `features` sample card, home family block + reverse link, `/providers` LibreDB native entry.
- The home "LibreDB family / open-core" block frames all three products with Studio visually the hero.
- All existing tests pass; `sections.test.ts` updated for the new slugs/schema.
- Studio remains the dominant narrative (homepage hero unchanged, primary nav weight intact).
