# Deploy Anywhere — `/deploy` page + homepage section

**Date:** 2026-06-22
**Status:** Approved design, ready for implementation plan
**Repo:** `libredb-website` (Astro 6, Tailwind v4, static output)

## 1. Purpose & audience

LibreDB Studio is now distributed as one-click apps / marketplace listings and as
package-registry artifacts across the modern deploy stack. The website does not
reflect this — `GetStarted.astro` only shows a stale generic "Deploy to Render"
button. This work replaces that with a strategic **"Deploy Anywhere"** story.

The narrative spine: **one open-source OCI image → therefore it runs on every layer
of the deploy stack.** That single technical fact is what lets LibreDB be everywhere,
so the page leads with it, then fans out: **big picture → why → classification →
detail → depth.**

Three audiences served by one page:

- **Users** — "how do I run this on my platform?" → find their platform fast, get a
  deploy button or docs link.
- **Open-source world** — "LibreDB adds value to ecosystems you already use" → we meet
  teams where they deploy.
- **Customers / investors** — reach and momentum at a glance: number of platforms,
  categories, install methods, and the combined GitHub-star weight of the open-source
  ecosystems LibreDB is embedded in.

## 2. Success criteria

- A visitor can locate their platform and reach a deploy action (button or docs) in
  one scan.
- Official integrations (Railway, CapRover) are visually distinct and offer real
  one-click deploy actions.
- Open-source PaaS cards show **live GitHub star counts** (build-time baked + client
  refresh), and the page surfaces an **aggregate star figure** as an investor signal.
- Status (`Official` / `Available` / `Planned`) is accurate and trivially updatable
  (one-line data edit per platform).
- Page matches existing site conventions: dark slate theme, `gradient-text`/`glow`
  utilities, `primary`/`accent` tokens, breadcrumb + JSON-LD pattern, copy-button
  script reuse.
- No broken images, no layout shift from star loading, no horizontal page scroll.

## 3. Architecture & files

### New files

| File | Role |
|---|---|
| `src/data/deploy-targets.ts` | **Single source of truth** — every platform/registry as a typed entry. Bumping `planned → available → official` is a one-line edit. |
| `src/data/deploy-categories.ts` | Category metadata (id, title, icon, one-line description, display order). |
| `src/lib/github-stars.ts` | Build-time fetch helper: given the list of `github` repos, returns `Record<repo, number>`. Includes a hardcoded **fallback map** so a failed/rate-limited/offline build still renders numbers. |
| `src/components/DeployAnywhere.astro` | **Homepage section** — condensed: stat band + category overview + the two official spotlights + "See all N platforms →" linking to `/deploy`. |
| `src/components/deploy/PlatformCard.astro` | Reusable card: logo, name, status badge, optional star count, action button (Deploy / Docs / View). |
| `src/components/deploy/StatusBadge.astro` | Pill for `official` / `available` / `planned`. |
| `src/pages/deploy.astro` | **Full page**: hero/stat band → primitives strip → official spotlight → classification grids → investor depth band → CTA. SEO + JSON-LD. |
| `public/logos/deploy/*.svg` | Vendored brand SVGs (local = reliable, no external image dependency). Lettermark fallback tile where no brand SVG exists. |

### Edited files

| File | Change |
|---|---|
| `src/components/Header.astro` | Add a **Deploy** link to desktop nav (`/deploy`). |
| `src/components/Footer.astro` | Add a **Deploy** link under the Product (or Resources) column. |
| `src/components/GetStarted.astro` | Replace the stale "One-Click Deploy" block (generic Render button + GitHub) with a concise pointer to `/deploy` ("Deploy on Railway, CapRover, Kubernetes, and more →"). Keep the Docker quick-start and clone steps as-is. |
| `src/pages/index.astro` | Insert `<DeployAnywhere />` into the homepage flow, directly before `<GetStarted />` (so the "where it runs" story leads into the "how to install" steps). |

## 4. Data model

```ts
// src/data/deploy-targets.ts
export type DeployStatus = 'official' | 'available' | 'planned';
export type CategoryId = 'registry' | 'oss-paas' | 'managed-paas' | 'cloud';

export interface DeployTarget {
  name: string;
  category: CategoryId;
  status: DeployStatus;
  logo: string;            // '/logos/deploy/coolify.svg'
  url: string;             // platform marketing site
  deployUrl?: string;      // one-click deploy link (Railway template, Koyeb button…)
  docsUrl?: string;        // our deploy docs / repo instructions
  github?: string;         // 'coollabsio/coolify' → live star count (OSS PaaS only)
  blurb?: string;          // one line, e.g. "Self-hosted Heroku alternative"
}
```

```ts
// src/data/deploy-categories.ts
export interface DeployCategory {
  id: CategoryId;
  title: string;           // "Open-source / self-hosted PaaS"
  tagline: string;         // one-line description
  order: number;           // display order on the page
}
```

Cards within a category sort `official → available → planned` so ready options lead.

## 5. Platform inventory (authoritative content)

Status legend: 🟢 `official` (listed in their marketplace) · 🟡 `available`
(works today via button/manual/registry) · 🔵 `planned` (roadmap).

### ① Install primitives / registries — all Available

| Platform | Status | URL |
|---|---|---|
| GHCR image | 🟡 available | `ghcr.io/libredb/libredb-studio:latest` |
| Docker Hub | 🟡 available | hub.docker.com/r/libredb/libredb-studio |
| Helm chart (GHCR OCI) | 🟡 available | `ghcr.io/libredb/charts/libredb-studio` |
| ArtifactHub (Helm) | 🟡 available | artifacthub.io/packages/helm/libredb-studio/libredb-studio |
| npm `@libredb/studio` | 🟡 available | npmjs.com/package/@libredb/studio |

### ② Open-source / self-hosted PaaS — stars shown here

| Platform | Status | Stars repo |
|---|---|---|
| **CapRover** | 🟢 official | caprover/caprover |
| Dokploy | 🔵 planned | Dokploy/dokploy |
| Coolify | 🔵 planned | coollabsio/coolify |
| Dokku | 🔵 planned | dokku/dokku |
| Easypanel | 🔵 planned | — (closed core; lettermark, no star) |
| Kubero | 🔵 planned | kubero-dev/kubero |
| Kamal | 🔵 planned | basecamp/kamal |
| Portainer | 🔵 planned | portainer/portainer |
| Rancher | 🔵 planned | rancher/rancher |
| OpenShift / OKD | 🔵 planned | okd-project/okd |
| Cloudron | 🔵 planned | — (closed core; lettermark, no star) |
| Cosmos | 🔵 planned | azukaar/Cosmos-Server |
| Appwrite | 🔵 planned | appwrite/appwrite |
| Nhost | 🔵 planned | nhost/nhost |

### ③ Managed / commercial PaaS — no stars (closed platforms)

| Platform | Status |
|---|---|
| **Railway** | 🟢 official (template marketplace; real one-click deploy URL) |
| **Koyeb** | 🟡 available (deploy button live; catalog submission pending) |
| Render | 🔵 planned |
| Fly.io | 🔵 planned |
| Netlify | 🔵 planned |
| Heroku | 🔵 planned |
| Northflank | 🔵 planned |
| Qovery | 🔵 planned |
| Platform.sh | 🔵 planned |

### ④ Cloud hyperscalers — no stars

AWS, GCP, Azure, DigitalOcean, Alibaba Cloud — all 🔵 planned. Framed as "runs as a
container on any 'run a container' service (ECS/Fargate, Cloud Run, ACI, App Platform)."

### Known deploy links (from `libredb-studio/deploy/`)

- Railway template:
  `https://railway.com/deploy/libredb-studio?referralCode=bGijnc&utm_medium=integration&utm_source=template&utm_campaign=generic`
- CapRover: install via dashboard search (official, once merged) or 3rd-party repo
  `https://libredb.org/caprover-one-click-apps`. Docs: repo `deploy/caprover`.
- Koyeb: "Deploy to Koyeb" button (URL maintained in studio repo README).

## 6. Page sections (`/deploy`)

1. **Hero / big-picture band** — H1 "Deploy LibreDB Studio anywhere"; subtitle on the
   dual value (open-source for the world + meet teams where they deploy). **Stat strip:**
   `4 categories · N platforms · 5 install methods · MIT licensed`.
2. **"Why it runs everywhere" primitives strip** — tiles for Docker image (GHCR),
   Helm chart, npm, compose — the technical reason it's portable. Each links to the
   relevant artifact / the existing `/docker-compose-example` page.
3. **Spotlight: Official integrations** — Railway + CapRover as large cards with real
   one-click deploy buttons + 2-line steps. Proof it's real today.
4. **Classification grids** — one block per category (①–④), responsive `PlatformCard`
   grid, cards sorted official→available→planned.
5. **Investor depth band** — "Published across ecosystems totaling **NN k+ GitHub
   stars**" (sum of category ② live stars) + compact roadmap line of planned platforms.
6. **CTA footer** — links to `/docker-compose-example`, GitHub repo, live demo
   (`app.libredb.org`).

## 7. GitHub stars mechanism (build-time + client refresh)

- **Build time:** `src/lib/github-stars.ts` `getStars(repos)` runs in `deploy.astro`
  frontmatter (Astro builds static; `fetch` runs in Node at build). One request per
  repo to `https://api.github.com/repos/{repo}` reading `stargazers_count`. Results
  baked into HTML. A hardcoded `FALLBACK_STARS` map (approximate known counts) is used
  for any repo whose fetch fails — the build never produces a blank or throws.
- **Client refresh:** a small inline `<script>` on `/deploy` re-fetches the same repos
  from the GitHub API on load and updates `[data-stars-repo="owner/repo"]` spans. On
  any error (rate limit, offline), it silently leaves the baked number in place.
- **Formatting:** counts render compact — `41200 → "41.2k"`, `980 → "980"`.
- Stars render **only on category ② (OSS PaaS)** cards.
- Aggregate figure in the investor band = sum of the (refreshed-or-baked) category ②
  counts, also recomputed client-side after refresh.

## 8. Logos & assets

Vendored SVGs in `public/logos/deploy/<slug>.svg`, referenced by path (static site,
no CSP constraint, but local files avoid external-host fragility). Where no clean
brand SVG exists (Easypanel, Cloudron, some clouds), `PlatformCard` renders a
**lettermark fallback** — first initial on a branded tile — so there is never a broken
image. Logo acquisition (which SVGs to vendor) is an implementation task.

## 9. SEO / structured data

Mirror `docker-compose-example.astro`: breadcrumb nav, page `<title>` + description,
and JSON-LD — an `ItemList` enumerating deploy targets (name + url) and a reference to
the existing `SoftwareApplication` (`https://libredb.org/#application`). Add `/deploy`
to the sitemap automatically (handled by `@astrojs/sitemap`).

## 10. Out of scope (YAGNI)

- No per-platform sub-pages (one `/deploy` page covers all; deep instructions live in
  the studio repo `deploy/` folders and are linked).
- No CMS / admin UI for the platform list — it is code-edited data.
- No authenticated GitHub API token in the client (unauth is sufficient with the
  baked fallback).
- No live status checks / uptime pings of marketplace listings.

## 11. Open implementation details (decided during build, not blocking)

- Exact homepage insertion point for `<DeployAnywhere />` (default: before
  `GetStarted`).
- Final `FALLBACK_STARS` values (snapshot real counts at build of the data file).
- Which brand SVGs are vendored vs lettermark fallback.
