# Deploy Anywhere Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a `/deploy` page plus a condensed homepage section that present LibreDB Studio's "one open-source image → every layer of the deploy stack" distribution story, with live GitHub star counts on open-source platform cards.

**Architecture:** A typed data layer (`src/data/`) is the single source of truth for every platform/registry. A build-time helper (`src/lib/github-stars.ts`) fetches star counts (with a baked fallback) and a client script refreshes them live. Astro components (`PlatformCard`, `StatusBadge`) render the data on a full `/deploy` page and a condensed homepage `DeployAnywhere` section.

**Tech Stack:** Astro 6 (static output), Tailwind CSS v4 (theme tokens in `src/styles/global.css`), TypeScript (strict), `bun` for scripts/tests.

## Global Constraints

- Static site — no SSR adapter. Build-time `fetch` runs in Node during `astro build`; the page must render even when offline (fallback stars).
- Match existing visual conventions: dark slate theme, `gradient-text`/`glow`/`glow-sm` utilities, `primary-*` / `accent-*` Tailwind tokens, `font-sans` body.
- No external image hosts — all logos vendored under `public/logos/deploy/`. Missing logo → lettermark fallback, never a broken `<img>`.
- Status taxonomy is exactly: `official` | `available` | `planned`.
- GitHub star counts shown ONLY on category `oss-paas` cards.
- All registries (GHCR image, Docker Hub, Helm/OCI, ArtifactHub, npm) are `available`.
- Official integrations: Railway (`managed-paas`), CapRover (`oss-paas`). Koyeb is `available`. Everything else `planned`.
- Reuse the existing copy-button `<script>` pattern verbatim where copy buttons are needed (none required here, but do not reinvent it).
- Astro `<script>` blocks are Vite-bundled, so they MAY `import` from `src/lib`.
- Commit after every task. Branch is `feat/deploy-anywhere` (already created).

---

### Task 1: Deploy data layer (categories, targets, types)

**Files:**
- Create: `src/data/deploy-categories.ts`
- Create: `src/data/deploy-targets.ts`
- Test: `src/data/deploy-targets.test.ts`

**Interfaces:**
- Produces: `type DeployStatus = 'official' | 'available' | 'planned'`; `type CategoryId = 'registry' | 'oss-paas' | 'managed-paas' | 'cloud'`; `interface DeployTarget`; `interface DeployCategory`; `const deployCategories: DeployCategory[]`; `const deployTargets: DeployTarget[]`.
- `DeployTarget` shape: `{ name: string; slug: string; category: CategoryId; status: DeployStatus; url: string; logo?: string; deployUrl?: string; docsUrl?: string; github?: string; blurb?: string }`.

- [ ] **Step 1: Create the category metadata file**

Create `src/data/deploy-categories.ts`:

```ts
export type CategoryId = 'registry' | 'oss-paas' | 'managed-paas' | 'cloud';

export interface DeployCategory {
  id: CategoryId;
  title: string;
  tagline: string;
  order: number;
}

export const deployCategories: DeployCategory[] = [
  {
    id: 'registry',
    title: 'Install primitives & registries',
    tagline: 'The published artifacts every deploy builds on — pull, helm install, or npx.',
    order: 1,
  },
  {
    id: 'oss-paas',
    title: 'Open-source & self-hosted PaaS',
    tagline: 'Run LibreDB Studio inside the open-source platforms you already self-host.',
    order: 2,
  },
  {
    id: 'managed-paas',
    title: 'Managed & commercial PaaS',
    tagline: 'One-click deploys on hosted platforms — no servers to manage.',
    order: 3,
  },
  {
    id: 'cloud',
    title: 'Cloud hyperscalers',
    tagline: 'Runs as a container on any "run a container" service (ECS/Fargate, Cloud Run, ACI, App Platform).',
    order: 4,
  },
];
```

- [ ] **Step 2: Create the deploy targets file**

Create `src/data/deploy-targets.ts`:

```ts
import type { CategoryId } from './deploy-categories';

export type DeployStatus = 'official' | 'available' | 'planned';

export interface DeployTarget {
  name: string;
  slug: string;
  category: CategoryId;
  status: DeployStatus;
  url: string;
  logo?: string;       // '/logos/deploy/<slug>.svg' — omit for lettermark fallback
  deployUrl?: string;  // one-click deploy link
  docsUrl?: string;    // our deploy docs / repo instructions
  github?: string;     // 'owner/repo' — live star count (oss-paas only)
  blurb?: string;      // one short line
}

const RAILWAY_DEPLOY_URL =
  'https://railway.com/deploy/libredb-studio?referralCode=bGijnc&utm_medium=integration&utm_source=template&utm_campaign=generic';

export const deployTargets: DeployTarget[] = [
  // ① Install primitives / registries — all available
  { name: 'GitHub Container Registry', slug: 'ghcr', category: 'registry', status: 'available',
    url: 'https://github.com/libredb/libredb-studio/pkgs/container/libredb-studio',
    logo: '/logos/deploy/ghcr.svg', blurb: 'ghcr.io/libredb/libredb-studio:latest' },
  { name: 'Docker Hub', slug: 'docker', category: 'registry', status: 'available',
    url: 'https://hub.docker.com/r/libredb/libredb-studio',
    logo: '/logos/deploy/docker.svg', blurb: 'docker pull libredb/libredb-studio' },
  { name: 'Helm chart', slug: 'helm', category: 'registry', status: 'available',
    url: 'https://github.com/libredb/libredb-studio/pkgs/container/charts%2Flibredb-studio',
    logo: '/logos/deploy/helm.svg', blurb: 'ghcr.io/libredb/charts/libredb-studio (OCI)' },
  { name: 'Artifact Hub', slug: 'artifacthub', category: 'registry', status: 'available',
    url: 'https://artifacthub.io/packages/helm/libredb-studio/libredb-studio',
    logo: '/logos/deploy/artifacthub.svg', blurb: 'Helm chart, discoverable & versioned' },
  { name: 'npm', slug: 'npm', category: 'registry', status: 'available',
    url: 'https://www.npmjs.com/package/@libredb/studio',
    logo: '/logos/deploy/npm.svg', blurb: 'npx @libredb/studio' },

  // ② Open-source / self-hosted PaaS — stars shown
  { name: 'CapRover', slug: 'caprover', category: 'oss-paas', status: 'official',
    url: 'https://caprover.com', github: 'caprover/caprover',
    docsUrl: 'https://github.com/libredb/libredb-studio/tree/main/deploy/caprover',
    logo: '/logos/deploy/caprover.svg', blurb: 'Official one-click app' },
  { name: 'Coolify', slug: 'coolify', category: 'oss-paas', status: 'planned',
    url: 'https://coolify.io', github: 'coollabsio/coolify',
    logo: '/logos/deploy/coolify.svg', blurb: 'Self-hostable Heroku/Netlify alternative' },
  { name: 'Dokploy', slug: 'dokploy', category: 'oss-paas', status: 'planned',
    url: 'https://dokploy.com', github: 'Dokploy/dokploy',
    logo: '/logos/deploy/dokploy.svg', blurb: 'Open-source deployment platform' },
  { name: 'Portainer', slug: 'portainer', category: 'oss-paas', status: 'planned',
    url: 'https://www.portainer.io', github: 'portainer/portainer',
    logo: '/logos/deploy/portainer.svg', blurb: 'Container management UI' },
  { name: 'Dokku', slug: 'dokku', category: 'oss-paas', status: 'planned',
    url: 'https://dokku.com', github: 'dokku/dokku',
    logo: '/logos/deploy/dokku.svg', blurb: 'Docker-powered mini-Heroku' },
  { name: 'Easypanel', slug: 'easypanel', category: 'oss-paas', status: 'planned',
    url: 'https://easypanel.io', blurb: 'Modern server control panel' },
  { name: 'Kubero', slug: 'kubero', category: 'oss-paas', status: 'planned',
    url: 'https://www.kubero.dev', github: 'kubero-dev/kubero',
    logo: '/logos/deploy/kubero.svg', blurb: 'Heroku-like PaaS on Kubernetes' },
  { name: 'Kamal', slug: 'kamal', category: 'oss-paas', status: 'planned',
    url: 'https://kamal-deploy.org', github: 'basecamp/kamal',
    logo: '/logos/deploy/kamal.svg', blurb: 'Deploy containers to any host' },
  { name: 'Rancher', slug: 'rancher', category: 'oss-paas', status: 'planned',
    url: 'https://www.rancher.com', github: 'rancher/rancher',
    logo: '/logos/deploy/rancher.svg', blurb: 'Enterprise Kubernetes management' },
  { name: 'OpenShift / OKD', slug: 'openshift', category: 'oss-paas', status: 'planned',
    url: 'https://www.openshift.com', github: 'okd-project/okd',
    logo: '/logos/deploy/openshift.svg', blurb: 'Red Hat Kubernetes platform' },
  { name: 'Appwrite', slug: 'appwrite', category: 'oss-paas', status: 'planned',
    url: 'https://appwrite.io', github: 'appwrite/appwrite',
    logo: '/logos/deploy/appwrite.svg', blurb: 'Open-source backend platform' },
  { name: 'Nhost', slug: 'nhost', category: 'oss-paas', status: 'planned',
    url: 'https://nhost.io', github: 'nhost/nhost',
    logo: '/logos/deploy/nhost.svg', blurb: 'Open-source Firebase alternative' },
  { name: 'Cloudron', slug: 'cloudron', category: 'oss-paas', status: 'planned',
    url: 'https://www.cloudron.io', blurb: 'Self-hosted app platform' },
  { name: 'Cosmos', slug: 'cosmos', category: 'oss-paas', status: 'planned',
    url: 'https://cosmos-cloud.io', github: 'azukaar/Cosmos-Server',
    logo: '/logos/deploy/cosmos.svg', blurb: 'Self-hosted server with reverse proxy' },

  // ③ Managed / commercial PaaS — no stars
  { name: 'Railway', slug: 'railway', category: 'managed-paas', status: 'official',
    url: 'https://railway.com', deployUrl: RAILWAY_DEPLOY_URL,
    docsUrl: 'https://github.com/libredb/libredb-studio/tree/main/deploy/railway',
    logo: '/logos/deploy/railway.svg', blurb: 'Official template — one-click deploy' },
  { name: 'Koyeb', slug: 'koyeb', category: 'managed-paas', status: 'available',
    url: 'https://www.koyeb.com',
    docsUrl: 'https://github.com/libredb/libredb-studio/tree/main/deploy/koyeb',
    logo: '/logos/deploy/koyeb.svg', blurb: 'Deploy button — serverless, scale-to-zero' },
  { name: 'Render', slug: 'render', category: 'managed-paas', status: 'planned',
    url: 'https://render.com', logo: '/logos/deploy/render.svg', blurb: 'Unified cloud for apps' },
  { name: 'Fly.io', slug: 'fly', category: 'managed-paas', status: 'planned',
    url: 'https://fly.io', logo: '/logos/deploy/fly.svg', blurb: 'Run containers near users' },
  { name: 'Netlify', slug: 'netlify', category: 'managed-paas', status: 'planned',
    url: 'https://www.netlify.com', logo: '/logos/deploy/netlify.svg', blurb: 'Web platform' },
  { name: 'Heroku', slug: 'heroku', category: 'managed-paas', status: 'planned',
    url: 'https://www.heroku.com', logo: '/logos/deploy/heroku.svg', blurb: 'The original PaaS' },
  { name: 'Northflank', slug: 'northflank', category: 'managed-paas', status: 'planned',
    url: 'https://northflank.com', blurb: 'Full-stack deployment platform' },
  { name: 'Qovery', slug: 'qovery', category: 'managed-paas', status: 'planned',
    url: 'https://www.qovery.com', blurb: 'Deploy on your own cloud' },
  { name: 'Platform.sh', slug: 'platformsh', category: 'managed-paas', status: 'planned',
    url: 'https://platform.sh', blurb: 'End-to-end PaaS' },

  // ④ Cloud hyperscalers — no stars
  { name: 'AWS', slug: 'aws', category: 'cloud', status: 'planned',
    url: 'https://aws.amazon.com', logo: '/logos/deploy/aws.svg', blurb: 'ECS / Fargate / App Runner' },
  { name: 'Google Cloud', slug: 'gcp', category: 'cloud', status: 'planned',
    url: 'https://cloud.google.com', logo: '/logos/deploy/gcp.svg', blurb: 'Cloud Run / GKE' },
  { name: 'Microsoft Azure', slug: 'azure', category: 'cloud', status: 'planned',
    url: 'https://azure.microsoft.com', logo: '/logos/deploy/azure.svg', blurb: 'Container Apps / ACI / AKS' },
  { name: 'DigitalOcean', slug: 'digitalocean', category: 'cloud', status: 'planned',
    url: 'https://www.digitalocean.com', logo: '/logos/deploy/digitalocean.svg', blurb: 'App Platform / Droplets' },
  { name: 'Alibaba Cloud', slug: 'alibaba', category: 'cloud', status: 'planned',
    url: 'https://www.alibabacloud.com', blurb: 'ECS / Container Service' },
];

/** Repos whose live star counts we display (oss-paas with a public repo). */
export const starRepos: string[] = deployTargets
  .filter((t) => t.category === 'oss-paas' && t.github)
  .map((t) => t.github as string);
```

- [ ] **Step 3: Write the data-integrity test**

Create `src/data/deploy-targets.test.ts`:

```ts
import { test, expect } from 'bun:test';
import { deployTargets, starRepos, type DeployStatus } from './deploy-targets';
import { deployCategories } from './deploy-categories';

const VALID_STATUS: DeployStatus[] = ['official', 'available', 'planned'];
const VALID_CATEGORIES = deployCategories.map((c) => c.id);

test('every target has a valid status and category', () => {
  for (const t of deployTargets) {
    expect(VALID_STATUS).toContain(t.status);
    expect(VALID_CATEGORIES).toContain(t.category);
  }
});

test('slugs are unique', () => {
  const slugs = deployTargets.map((t) => t.slug);
  expect(new Set(slugs).size).toBe(slugs.length);
});

test('all registries are available', () => {
  const registries = deployTargets.filter((t) => t.category === 'registry');
  expect(registries.length).toBe(5);
  expect(registries.every((t) => t.status === 'available')).toBe(true);
});

test('only oss-paas targets declare a github repo (stars constraint)', () => {
  const withGithub = deployTargets.filter((t) => t.github);
  expect(withGithub.every((t) => t.category === 'oss-paas')).toBe(true);
  expect(starRepos.length).toBeGreaterThan(0);
});

test('official integrations are present', () => {
  const official = deployTargets.filter((t) => t.status === 'official').map((t) => t.slug);
  expect(official).toContain('railway');
  expect(official).toContain('caprover');
});
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun test src/data/deploy-targets.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/data/deploy-categories.ts src/data/deploy-targets.ts src/data/deploy-targets.test.ts
git commit -m "feat: add deploy targets + categories data layer"
```

---

### Task 2: GitHub stars helper (build-time fetch + fallback + formatting)

**Files:**
- Create: `src/lib/github-stars.ts`
- Test: `src/lib/github-stars.test.ts`

**Interfaces:**
- Consumes: nothing (standalone).
- Produces: `function formatStars(n: number): string`; `async function getStars(repos: string[]): Promise<Record<string, number>>`; `const FALLBACK_STARS: Record<string, number>`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/github-stars.test.ts`:

```ts
import { test, expect, mock, afterEach } from 'bun:test';
import { formatStars, getStars, FALLBACK_STARS } from './github-stars';

afterEach(() => {
  mock.restore();
});

test('formatStars renders compact counts', () => {
  expect(formatStars(0)).toBe('0');
  expect(formatStars(980)).toBe('980');
  expect(formatStars(1000)).toBe('1k');
  expect(formatStars(1500)).toBe('1.5k');
  expect(formatStars(41200)).toBe('41.2k');
  expect(formatStars(132000)).toBe('132k');
});

test('getStars uses the live count on success', async () => {
  globalThis.fetch = mock(async () =>
    new Response(JSON.stringify({ stargazers_count: 12345 }), { status: 200 }),
  ) as unknown as typeof fetch;

  const result = await getStars(['caprover/caprover']);
  expect(result['caprover/caprover']).toBe(12345);
});

test('getStars falls back when the request fails', async () => {
  globalThis.fetch = mock(async () => new Response('nope', { status: 403 })) as unknown as typeof fetch;

  const result = await getStars(['caprover/caprover']);
  expect(result['caprover/caprover']).toBe(FALLBACK_STARS['caprover/caprover']);
});

test('getStars falls back when fetch throws', async () => {
  globalThis.fetch = mock(async () => {
    throw new Error('offline');
  }) as unknown as typeof fetch;

  const result = await getStars(['coollabsio/coolify']);
  expect(result['coollabsio/coolify']).toBe(FALLBACK_STARS['coollabsio/coolify']);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun test src/lib/github-stars.test.ts`
Expected: FAIL — `Cannot find module './github-stars'`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/github-stars.ts`:

```ts
/**
 * Approximate star counts baked in as a fallback so a build that is offline or
 * rate-limited still renders a number (and the client refresh can update it).
 * Snapshot these from the live repos when editing the data file.
 */
export const FALLBACK_STARS: Record<string, number> = {
  'caprover/caprover': 13700,
  'coollabsio/coolify': 42000,
  'Dokploy/dokploy': 19000,
  'portainer/portainer': 32000,
  'dokku/dokku': 30000,
  'kubero-dev/kubero': 1700,
  'basecamp/kamal': 13000,
  'rancher/rancher': 24000,
  'okd-project/okd': 1700,
  'appwrite/appwrite': 51000,
  'nhost/nhost': 8000,
  'azukaar/Cosmos-Server': 4000,
};

/** 41200 -> "41.2k", 132000 -> "132k", 980 -> "980". */
export function formatStars(n: number): string {
  if (n < 1000) return String(n);
  const k = n / 1000;
  const rounded = k >= 100 ? Math.round(k) : Math.round(k * 10) / 10;
  return `${rounded}k`;
}

/**
 * Fetch star counts for each repo. Runs at build time (Node) and is safe to
 * call from a browser too. Any failure falls back to FALLBACK_STARS (or 0).
 */
export async function getStars(repos: string[]): Promise<Record<string, number>> {
  const entries = await Promise.all(
    repos.map(async (repo): Promise<[string, number]> => {
      try {
        const res = await fetch(`https://api.github.com/repos/${repo}`, {
          headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'libredb-website' },
        });
        if (!res.ok) throw new Error(`status ${res.status}`);
        const data = (await res.json()) as { stargazers_count?: number };
        const stars = data?.stargazers_count;
        return [repo, typeof stars === 'number' ? stars : FALLBACK_STARS[repo] ?? 0];
      } catch {
        return [repo, FALLBACK_STARS[repo] ?? 0];
      }
    }),
  );
  return Object.fromEntries(entries);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun test src/lib/github-stars.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/github-stars.ts src/lib/github-stars.test.ts
git commit -m "feat: add github-stars build-time helper with fallback"
```

---

### Task 3: StatusBadge and PlatformCard components

**Files:**
- Create: `src/components/deploy/StatusBadge.astro`
- Create: `src/components/deploy/PlatformCard.astro`

**Interfaces:**
- Consumes: `DeployTarget`, `DeployStatus` from `src/data/deploy-targets`; `formatStars` from `src/lib/github-stars`.
- `StatusBadge` props: `{ status: DeployStatus }`.
- `PlatformCard` props: `{ target: DeployTarget; stars?: number }`. When `stars` is provided AND `target.github` is set, the card renders a `<span data-stars-repo={target.github} data-stars-count={stars}>` element (the hook the client refresh script updates).

- [ ] **Step 1: Create StatusBadge**

Create `src/components/deploy/StatusBadge.astro`:

```astro
---
import type { DeployStatus } from '../../data/deploy-targets';

interface Props {
  status: DeployStatus;
}

const { status } = Astro.props;

const styles: Record<DeployStatus, { label: string; cls: string }> = {
  official: { label: 'Official', cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
  available: { label: 'Available', cls: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
  planned: { label: 'Planned', cls: 'bg-slate-500/15 text-slate-400 border-slate-500/30' },
};

const { label, cls } = styles[status];
---

<span class={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide border ${cls}`}>
  {status === 'official' && (
    <svg class="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.7 5.3a1 1 0 010 1.4l-7.5 7.5a1 1 0 01-1.4 0L3.3 9.7a1 1 0 011.4-1.4l3.1 3.1 6.8-6.8a1 1 0 011.1 0z" clip-rule="evenodd"></path></svg>
  )}
  {label}
</span>
```

- [ ] **Step 2: Create PlatformCard**

Create `src/components/deploy/PlatformCard.astro`:

```astro
---
import type { DeployTarget } from '../../data/deploy-targets';
import { formatStars } from '../../lib/github-stars';
import StatusBadge from './StatusBadge.astro';

interface Props {
  target: DeployTarget;
  stars?: number;
}

const { target, stars } = Astro.props;

const action =
  target.deployUrl
    ? { href: target.deployUrl, label: 'Deploy' }
    : target.status === 'planned'
      ? null
      : target.docsUrl
        ? { href: target.docsUrl, label: 'Docs' }
        : { href: target.url, label: 'Learn more' };

const initial = target.name.charAt(0).toUpperCase();
const showStars = typeof stars === 'number' && Boolean(target.github);
---

<div class="group flex flex-col h-full p-4 rounded-xl bg-slate-900/60 border border-slate-700/80 hover:border-primary-500/50 transition-colors shadow-lg shadow-black/10">
  <div class="flex items-start justify-between gap-2 mb-3">
    <div class="flex items-center gap-2.5 min-w-0">
      {target.logo ? (
        <img src={target.logo} alt={`${target.name} logo`} width="28" height="28" class="w-7 h-7 object-contain shrink-0" loading="lazy" />
      ) : (
        <span class="w-7 h-7 shrink-0 rounded-md bg-primary-600/20 text-primary-300 text-sm font-bold grid place-items-center">{initial}</span>
      )}
      <h4 class="text-sm font-semibold text-white truncate">{target.name}</h4>
    </div>
    <StatusBadge status={target.status} />
  </div>

  {target.blurb && <p class="text-xs text-slate-400 mb-3 line-clamp-2">{target.blurb}</p>}

  <div class="mt-auto flex items-center justify-between gap-2 pt-1">
    {showStars ? (
      <a href={`https://github.com/${target.github}`} target="_blank" rel="noopener noreferrer"
         class="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-amber-300 transition-colors">
        <svg class="w-3.5 h-3.5 text-amber-400" fill="currentColor" viewBox="0 0 20 20"><path d="M10 1.5l2.6 5.3 5.9.9-4.2 4.1 1 5.8L10 15l-5.3 2.7 1-5.8L1.5 7.7l5.9-.9L10 1.5z"></path></svg>
        <span data-stars-repo={target.github} data-stars-count={stars}>{formatStars(stars as number)}</span>
      </a>
    ) : <span></span>}

    {action ? (
      <a href={action.href} target="_blank" rel="noopener noreferrer"
         class="inline-flex items-center gap-1 text-xs font-medium text-primary-300 hover:text-primary-200 transition-colors">
        {action.label}
        <span aria-hidden="true">&rarr;</span>
      </a>
    ) : (
      <a href={target.url} target="_blank" rel="noopener noreferrer"
         class="text-xs text-slate-500 hover:text-slate-300 transition-colors">Learn more</a>
    )}
  </div>
</div>
```

- [ ] **Step 3: Verify the components compile (build skips network sync)**

Run: `bunx astro build`
Expected: build completes with no error referencing `StatusBadge.astro` or `PlatformCard.astro`. (The components are not yet imported by a page, so this only confirms they parse.)

- [ ] **Step 4: Commit**

```bash
git add src/components/deploy/StatusBadge.astro src/components/deploy/PlatformCard.astro
git commit -m "feat: add StatusBadge and PlatformCard deploy components"
```

---

### Task 4: The `/deploy` page

**Files:**
- Create: `src/pages/deploy.astro`

**Interfaces:**
- Consumes: `deployTargets`, `deployCategories`, `starRepos` from data; `getStars`, `formatStars` from `src/lib/github-stars`; `PlatformCard`, `StatusBadge`, `Layout`, `Header`, `Footer`.
- Produces: route `/deploy`. Emits `data-stars-repo`/`data-stars-count` spans (from `PlatformCard`) and a `data-stars-total` element the client script updates.

- [ ] **Step 1: Create the page with build-time star fetch, sections, and SEO**

Create `src/pages/deploy.astro`:

```astro
---
import Layout from '../layouts/Layout.astro';
import Header from '../components/Header.astro';
import Footer from '../components/Footer.astro';
import PlatformCard from '../components/deploy/PlatformCard.astro';
import { deployTargets } from '../data/deploy-targets';
import { deployCategories } from '../data/deploy-categories';
import { starRepos } from '../data/deploy-targets';
import { getStars, formatStars } from '../lib/github-stars';

const stars = await getStars(starRepos);

const STATUS_ORDER = { official: 0, available: 1, planned: 2 };
const sortedCategories = [...deployCategories].sort((a, b) => a.order - b.order);
const targetsByCategory = (id: string) =>
  deployTargets
    .filter((t) => t.category === id)
    .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);

const official = deployTargets.filter((t) => t.status === 'official');
const totalStars = Object.values(stars).reduce((sum, n) => sum + n, 0);

const platformCount = deployTargets.length;
const categoryCount = deployCategories.length;
const installMethodCount = deployTargets.filter((t) => t.category === 'registry').length;
const plannedNames = deployTargets
  .filter((t) => t.status === 'planned')
  .map((t) => t.name);

const stats = [
  { value: String(categoryCount), label: 'Deploy categories' },
  { value: `${platformCount}+`, label: 'Platforms & registries' },
  { value: String(installMethodCount), label: 'Install methods' },
  { value: 'MIT', label: 'Open-source license' },
];

const siteURL = 'https://libredb.org';
const title = 'Deploy LibreDB Studio Anywhere — One-Click Apps, Helm, Docker & Cloud';
const description =
  'Run the open-source LibreDB Studio SQL IDE anywhere: official Railway and CapRover one-click apps, Docker Hub & GHCR images, a Helm chart on Artifact Hub, npm, and every major open-source PaaS, managed PaaS, and cloud.';

const itemListSchema = {
  '@context': 'https://schema.org',
  '@type': 'ItemList',
  name: 'LibreDB Studio deployment targets',
  itemListElement: deployTargets.map((t, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    name: t.name,
    url: t.deployUrl ?? t.docsUrl ?? t.url,
  })),
};
---

<Layout title={title} description={description}>
  <Header />
  <main class="pt-24 pb-16">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <!-- Breadcrumb -->
      <nav class="text-xs text-slate-500 mb-4" aria-label="Breadcrumb">
        <a href="/" class="hover:text-slate-300 transition-colors">Home</a>
        <span class="mx-1.5">/</span>
        <span class="text-slate-400">Deploy</span>
      </nav>

      <!-- Hero -->
      <section class="text-center max-w-3xl mx-auto mb-12">
        <h1 class="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-4">
          Deploy LibreDB Studio <span class="gradient-text">anywhere</span>
        </h1>
        <p class="text-base md:text-lg text-slate-300 leading-relaxed">
          One open-source container image — so LibreDB Studio runs on every layer of the
          modern deploy stack. Pick a one-click app, a package registry, your self-hosted
          PaaS, or your cloud. We meet your team where it already deploys.
        </p>
      </section>

      <!-- Stat band -->
      <section class="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-16">
        {stats.map((s) => (
          <div class="text-center p-4 rounded-xl bg-slate-900/60 border border-slate-700/80">
            <div class="text-2xl md:text-3xl font-bold gradient-text">{s.value}</div>
            <div class="text-xs md:text-sm text-slate-400 mt-1">{s.label}</div>
          </div>
        ))}
      </section>

      <!-- Official spotlight -->
      <section class="mb-16">
        <h2 class="text-xl md:text-2xl font-bold text-white mb-1">Official one-click integrations</h2>
        <p class="text-sm text-slate-400 mb-6">Listed in their marketplaces — deploy in a click, today.</p>
        <div class="grid md:grid-cols-2 gap-4">
          {official.map((t) => (
            <div class="flex flex-col p-6 rounded-2xl bg-slate-900/60 border border-primary-500/30 glow-sm">
              <div class="flex items-center gap-3 mb-3">
                {t.logo
                  ? <img src={t.logo} alt={`${t.name} logo`} width="40" height="40" class="w-10 h-10 object-contain" />
                  : <span class="w-10 h-10 rounded-lg bg-primary-600/20 text-primary-300 text-lg font-bold grid place-items-center">{t.name.charAt(0)}</span>}
                <h3 class="text-lg font-semibold text-white">{t.name}</h3>
              </div>
              <p class="text-sm text-slate-400 mb-5">{t.blurb}</p>
              <div class="mt-auto flex flex-wrap gap-3">
                <a href={t.deployUrl ?? t.docsUrl ?? t.url} target="_blank" rel="noopener noreferrer"
                   class="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-500 text-white text-sm font-medium rounded-lg transition-colors">
                  {t.deployUrl ? 'Deploy now' : 'View install guide'}
                  <span aria-hidden="true">&rarr;</span>
                </a>
                {t.docsUrl && (
                  <a href={t.docsUrl} target="_blank" rel="noopener noreferrer"
                     class="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium rounded-lg border border-slate-700 transition-colors">
                    Docs
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <!-- Classification grids -->
      {sortedCategories.map((cat) => (
        <section class="mb-14">
          <h2 class="text-xl md:text-2xl font-bold text-white mb-1">{cat.title}</h2>
          <p class="text-sm text-slate-400 mb-6 max-w-2xl">{cat.tagline}</p>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4">
            {targetsByCategory(cat.id).map((t) => (
              <PlatformCard target={t} stars={t.github ? stars[t.github] : undefined} />
            ))}
          </div>
        </section>
      ))}

      <!-- Investor depth band -->
      <section class="mt-4 p-6 md:p-8 rounded-2xl bg-gradient-to-br from-primary-900/30 to-slate-900/60 border border-primary-500/20 text-center">
        <p class="text-sm text-slate-400 mb-2">Embedded across open-source ecosystems totaling</p>
        <div class="text-3xl md:text-4xl font-bold gradient-text mb-3">
          <span data-stars-total>{formatStars(totalStars)}</span>+ GitHub stars
        </div>
        <p class="text-sm text-slate-400 max-w-2xl mx-auto">
          LibreDB Studio doesn't just support these platforms — it ships inside communities
          that millions of developers already trust. More on the roadmap:
          {' '}{plannedNames.slice(0, 8).join(', ')}, and more.
        </p>
      </section>

      <!-- CTA -->
      <section class="mt-12 flex flex-wrap justify-center gap-3">
        <a href="/docker-compose-example" class="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium rounded-lg border border-slate-700 transition-colors">Docker Compose example</a>
        <a href="https://github.com/libredb/libredb-studio" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium rounded-lg border border-slate-700 transition-colors">View on GitHub</a>
        <a href="https://app.libredb.org" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-600 hover:bg-primary-500 text-white text-sm font-medium rounded-lg transition-colors">Try the live demo</a>
      </section>
    </div>
  </main>
  <Footer />

  <script is:inline type="application/ld+json" set:html={JSON.stringify(itemListSchema)} />
</Layout>

<script>
  import { formatStars } from '../lib/github-stars';

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

Structure check: the file ends with exactly one `</Layout>` (right after the inline JSON-LD `<script is:inline ...>`), then the module `<script>…</script>` block sits OUTSIDE the Layout at the very end of the file.

- [ ] **Step 2: Build and verify the route renders**

Run: `bunx astro build`
Expected: build completes; `dist/deploy/index.html` exists.

- [ ] **Step 3: Verify key content rendered into the HTML**

Run:
```bash
grep -c "Deploy LibreDB Studio" dist/deploy/index.html && \
grep -c "data-stars-repo" dist/deploy/index.html && \
grep -c "data-stars-total" dist/deploy/index.html && \
grep -c "Railway" dist/deploy/index.html && \
grep -c "CapRover" dist/deploy/index.html
```
Expected: each count ≥ 1 (the `data-stars-repo` count should equal the number of oss-paas repos, ≥ 9).

- [ ] **Step 4: Commit**

```bash
git add src/pages/deploy.astro
git commit -m "feat: add /deploy page with classification grids and live stars"
```

---

### Task 5: Homepage DeployAnywhere section

**Files:**
- Create: `src/components/DeployAnywhere.astro`
- Modify: `src/pages/index.astro` (add import + place `<DeployAnywhere />` directly before `<GetStarted />`)

**Interfaces:**
- Consumes: `deployTargets`, `deployCategories` from data; `Layout` not needed (it's a section).
- Produces: `<section id="deploy">` on the homepage. No stars here (kept light); links to `/deploy`.

- [ ] **Step 1: Create the homepage section**

Create `src/components/DeployAnywhere.astro`:

```astro
---
import { deployTargets } from '../data/deploy-targets';
import { deployCategories } from '../data/deploy-categories';

const platformCount = deployTargets.length;
const installMethodCount = deployTargets.filter((t) => t.category === 'registry').length;
const official = deployTargets.filter((t) => t.status === 'official');

const countFor = (id: string) => deployTargets.filter((t) => t.category === id).length;
const categories = [...deployCategories].sort((a, b) => a.order - b.order);
---

<section id="deploy" class="py-16 md:py-24 relative">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="text-center mb-10 md:mb-14 px-2">
      <h2 class="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-3 md:mb-4">
        Deploy <span class="gradient-text">anywhere</span>
      </h2>
      <p class="text-sm md:text-lg text-slate-400 max-w-2xl mx-auto">
        One open-source image, every layer of the deploy stack — {platformCount}+ platforms
        and {installMethodCount} install methods.
      </p>
    </div>

    <!-- Category overview -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-8">
      {categories.map((cat) => (
        <a href="/deploy" class="block p-4 rounded-xl bg-slate-900/60 border border-slate-700/80 hover:border-primary-500/50 transition-colors">
          <div class="text-2xl font-bold gradient-text">{countFor(cat.id)}</div>
          <div class="text-xs md:text-sm font-medium text-white mt-1">{cat.title}</div>
        </a>
      ))}
    </div>

    <!-- Official spotlight + CTA -->
    <div class="p-5 md:p-6 rounded-2xl bg-slate-900/60 border border-slate-700/80 flex flex-col md:flex-row items-center justify-between gap-4">
      <div class="flex items-center gap-3 flex-wrap justify-center md:justify-start">
        <span class="text-sm text-slate-300 font-medium">Official one-click apps:</span>
        {official.map((t) => (
          <a href={t.deployUrl ?? t.docsUrl ?? t.url} target="_blank" rel="noopener noreferrer"
             class="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-sm border border-slate-700 transition-colors">
            {t.logo && <img src={t.logo} alt={`${t.name} logo`} width="20" height="20" class="w-5 h-5 object-contain" />}
            {t.name}
          </a>
        ))}
      </div>
      <a href="/deploy" class="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-600 hover:bg-primary-500 text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap">
        See all {platformCount}+ platforms
        <span aria-hidden="true">&rarr;</span>
      </a>
    </div>
  </div>
</section>
```

- [ ] **Step 2: Wire it into the homepage**

Modify `src/pages/index.astro`. Add the import after the `GetStarted` import (line 11):

```astro
import GetStarted from '../components/GetStarted.astro';
import DeployAnywhere from '../components/DeployAnywhere.astro';
```

And place the component directly before `<GetStarted />` in the `<main>`:

```astro
    <FAQ />
    <DeployAnywhere />
    <GetStarted />
```

- [ ] **Step 3: Build and verify**

Run: `bunx astro build`
Expected: build completes.

Run: `grep -c 'id="deploy"' dist/index.html && grep -c "See all" dist/index.html`
Expected: each ≥ 1.

- [ ] **Step 4: Commit**

```bash
git add src/components/DeployAnywhere.astro src/pages/index.astro
git commit -m "feat: add Deploy Anywhere homepage section"
```

---

### Task 6: Wire navigation (Header, Footer) and refresh GetStarted

**Files:**
- Modify: `src/components/Header.astro` (add Deploy nav link)
- Modify: `src/components/Footer.astro` (add Deploy link to Product section)
- Modify: `src/components/GetStarted.astro:122-149` (replace stale Deploy Buttons block)

**Interfaces:**
- Consumes: the `/deploy` route from Task 4. No new exports.

- [ ] **Step 1: Add the Header nav link**

In `src/components/Header.astro`, in the desktop nav block, add a Deploy link after the Get Started link:

```astro
        <a href="/#get-started" class="text-slate-400 hover:text-white transition-colors text-sm font-medium">Get Started</a>
        <a href="/deploy" class="text-slate-400 hover:text-white transition-colors text-sm font-medium">Deploy</a>
```

- [ ] **Step 2: Add the Footer link**

In `src/components/Footer.astro`, add an entry to the `product` section's `links` array (after "Tech Stack"):

```astro
      { label: "Tech Stack", href: "#tech-stack" },
      { label: "Deploy", href: "/deploy" },
      { label: "Live Demo", href: "https://app.libredb.org", external: true },
```

- [ ] **Step 3: Replace the stale "Deploy Buttons" block in GetStarted**

In `src/components/GetStarted.astro`, replace the entire `<!-- Deploy Buttons -->` block (the `div` spanning lines 122-149, containing the "Deploy to Render" and "View on GitHub" buttons) with:

```astro
    <!-- Deploy Anywhere pointer -->
    <div class="mt-8 md:mt-12 text-center">
      <h3 class="text-base md:text-xl font-semibold text-white mb-2">Prefer a one-click deploy?</h3>
      <p class="text-sm text-slate-400 max-w-xl mx-auto mb-5">
        LibreDB Studio is an official Railway template and CapRover one-click app — and runs
        on Docker, Helm, npm, and every major PaaS and cloud.
      </p>
      <a href="/deploy" class="inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary-600 hover:bg-primary-500 text-white text-sm font-medium rounded-lg transition-colors">
        Explore all deploy options
        <span aria-hidden="true">&rarr;</span>
      </a>
    </div>
```

- [ ] **Step 4: Build and verify all links resolve**

Run: `bunx astro build`
Expected: build completes.

Run:
```bash
grep -c 'href="/deploy"' dist/index.html
```
Expected: ≥ 3 (Header link + Footer link + GetStarted pointer + DeployAnywhere CTAs).

- [ ] **Step 5: Commit**

```bash
git add src/components/Header.astro src/components/Footer.astro src/components/GetStarted.astro
git commit -m "feat: link /deploy from header, footer, and Get Started"
```

---

### Task 7: Vendor platform logos

**Files:**
- Create: `public/logos/deploy/*.svg` (one per `logo:` path declared in `deploy-targets.ts`)

**Interfaces:**
- Consumes: the `logo` paths referenced in Task 1's data. Targets without a vendored SVG (Easypanel, Cloudron, Northflank, Qovery, Platform.sh, Alibaba) intentionally have NO `logo` field and render the lettermark fallback — do not add files for them.

The full list of required SVG files (filename = `<slug>.svg`):
`ghcr, docker, helm, artifacthub, npm, caprover, coolify, dokploy, portainer, dokku, kubero, kamal, rancher, openshift, appwrite, nhost, cosmos, railway, koyeb, render, fly, netlify, heroku, aws, gcp, azure, digitalocean`.

- [ ] **Step 1: Create the logos directory**

Run: `mkdir -p public/logos/deploy`

- [ ] **Step 2: Add brand SVGs**

For each slug above, place a brand SVG at `public/logos/deploy/<slug>.svg`. Source from the project's brand kits or Simple Icons (https://simpleicons.org, CC0) where a brand mark exists. Each file is a standalone `<svg>` (no external refs). Optimize/minify is optional. If a brand SVG genuinely cannot be sourced for one slug, remove that target's `logo:` field in `src/data/deploy-targets.ts` so it falls back to the lettermark (do NOT leave a path pointing at a missing file).

Example minimal monochrome SVG shape (Docker), to confirm the rendering path works — replace with the real brand mark:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#2496ED" role="img" aria-label="Docker">
  <path d="M13.98 11.08h2.12c.1 0 .19-.08.19-.19V9c0-.1-.08-.18-.19-.18h-2.12a.18.18 0 0 0-.18.18v1.89c0 .1.08.19.18.19m-2.95-5.43h2.12c.1 0 .18-.08.18-.19V3.57a.18.18 0 0 0-.18-.18h-2.12a.18.18 0 0 0-.18.18v1.89c0 .1.08.18.18.18Z"/>
</svg>
```

- [ ] **Step 3: Build and verify no broken logo paths**

Run: `bunx astro build`

Then verify every referenced logo file exists:
```bash
node -e "import('./src/data/deploy-targets.ts').then(m=>{const fs=require('fs');const missing=m.deployTargets.filter(t=>t.logo&&!fs.existsSync('public'+t.logo)).map(t=>t.logo);console.log(missing.length?('MISSING: '+missing.join(', ')):'all logos present');})"
```
Expected: `all logos present`. (If `node` cannot import the `.ts` directly, run the same with `bun -e` instead.)

- [ ] **Step 4: Commit**

```bash
git add public/logos/deploy
git commit -m "feat: vendor platform logos for /deploy"
```

---

### Task 8: Full build + final verification

**Files:** none (verification only).

- [ ] **Step 1: Run the complete production build (includes the docker-compose sync step)**

Run: `bun run build`
Expected: build completes with no errors; `dist/deploy/index.html` and updated `dist/index.html` present.

- [ ] **Step 2: Run all unit tests**

Run: `bun test`
Expected: all tests from Tasks 1–2 pass.

- [ ] **Step 3: Manual smoke test (optional but recommended)**

Run: `bunx astro dev` and open `http://localhost:4321/deploy`. Confirm: hero, stat band, official spotlight (Railway + CapRover), four category grids, star counts visible on oss-paas cards, investor band shows an aggregate, no broken images, no horizontal scroll on mobile widths.

- [ ] **Step 4: Final commit if anything was adjusted**

```bash
git add -A
git commit -m "chore: final verification for deploy-anywhere" || echo "nothing to commit"
```

---

## Self-Review

**Spec coverage:**
- Purpose / 3 audiences → Task 4 hero + investor band, Task 5 homepage. ✓
- Files (data, lib, components, page, edits, logos) → Tasks 1–7 map 1:1 to spec §3. ✓
- Data model → Task 1 (added `slug` for logo filenames; `logo` made optional for lettermark — noted). ✓
- Platform inventory incl. statuses, official Railway/CapRover, Koyeb available, all registries available → Task 1 data + test assertions. ✓
- Page sections (hero, primitives/stat band, official spotlight, classification grids, investor band, CTA) → Task 4. (Note: the "primitives strip" from spec §6.2 is represented by the `registry` category grid + stat band rather than a separate strip — a deliberate consolidation to avoid duplicating the same 5 registries twice on one page.) ✓
- Stars build-time + client refresh + fallback, oss-paas only, aggregate → Task 2 + Task 4 script. ✓
- Logos vendored + lettermark fallback → Task 3 (fallback) + Task 7 (assets). ✓
- SEO/JSON-LD ItemList + sitemap → Task 4 (ItemList; sitemap is automatic via `@astrojs/sitemap`). ✓
- Nav/footer/GetStarted wiring → Task 6. ✓

**Placeholder scan:** No "TBD/TODO/handle appropriately". The one example SVG in Task 7 is explicitly labeled a placeholder to replace with the real brand mark, with a defined fallback path — acceptable as it's an asset-sourcing chore, not code logic. ✓

**Type consistency:** `DeployTarget`/`DeployStatus`/`CategoryId` defined in Task 1 are imported with identical names in Tasks 3, 4, 5. `formatStars`/`getStars`/`FALLBACK_STARS`/`starRepos` names consistent across Tasks 2, 4. `data-stars-repo` / `data-stars-count` / `data-stars-total` attribute names consistent between PlatformCard (Task 3), deploy.astro markup and its client script (Task 4). ✓
