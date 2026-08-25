import type { CategoryId } from './deploy-categories';

export type DeployStatus = 'official' | 'available' | 'planned';

export interface DeployTarget {
  name: string;
  slug: string;
  category: CategoryId;
  status: DeployStatus;
  url: string;
  logo?: string; // '/logos/deploy/<slug>.svg' — omit for lettermark fallback
  deployUrl?: string; // one-click deploy link
  docsUrl?: string; // our deploy docs / repo instructions
  github?: string; // 'owner/repo' — live star count (open-source platforms: oss-paas + kubernetes)
  blurb?: string; // one short line
}

const RAILWAY_DEPLOY_URL =
  'https://railway.com/deploy/libredb-studio?referralCode=bGijnc&utm_medium=integration&utm_source=template&utm_campaign=generic';

// Koyeb one-click deploy: service definition encoded in the query string
// (Docker image, port 3000, free instance, local storage). Not an official
// Koyeb catalog listing.
//
// SECURITY: deliberately omits ADMIN_PASSWORD, USER_PASSWORD, JWT_SECRET, and
// any LLM key — we must never ship literal default credentials or secrets on a
// public page. Those fields appear blank in the Koyeb deploy form, so the
// deployer is forced to supply their own. A missing JWT_SECRET makes the app
// fail to boot (fail-closed), which is safer than booting with a known weak
// value. The deploy/koyeb docs (linked as docsUrl) explain what to set.
const KOYEB_DEPLOY_URL =
  'https://app.koyeb.com/deploy?name=libredb-studio&type=docker&image=ghcr.io%2Flibredb%2Flibredb-studio%3Alatest&instance_type=free&regions=fra&instances_min=0&autoscaling_sleep_idle_delay=3900&env%5BADMIN_EMAIL%5D=admin%40libredb.org&env%5BUSER_EMAIL%5D=user%40libredb.org&env%5BNEXT_PUBLIC_AUTH_PROVIDER%5D=local&env%5BSTORAGE_PROVIDER%5D=local&ports=3000%3Bhttp%3B%2F&hc_protocol%5B3000%5D=tcp&hc_grace_period%5B3000%5D=5&hc_interval%5B3000%5D=30&hc_restart_limit%5B3000%5D=3&hc_timeout%5B3000%5D=5&hc_path%5B3000%5D=%2F&hc_method%5B3000%5D=get';

// Render one-click deploy via the repo's render.yaml Blueprint. Works today,
// not an official Render catalog listing.
const RENDER_DEPLOY_URL = 'https://render.com/deploy?repo=https://github.com/libredb/libredb-studio';

const RELEASES_URL = 'https://github.com/libredb/libredb-studio/releases/latest';

export const deployTargets: DeployTarget[] = [
  // ① Install primitives / registries — mirrors distribution/channels.yaml in
  // the studio repo (the "visibility matrix"); every live channel gets a card.
  // 'official' is reserved for platforms where a listing of ours makes the
  // install one click in their own UI — catalog-only listings stay 'available'.
  {
    name: 'GitHub Container Registry',
    slug: 'ghcr',
    category: 'registry',
    status: 'available',
    url: 'https://github.com/libredb/libredb-studio/pkgs/container/libredb-studio',
    logo: '/logos/deploy/ghcr.svg',
    blurb: 'ghcr.io/libredb/libredb-studio:latest',
  },
  {
    name: 'Docker Hub',
    slug: 'docker',
    category: 'registry',
    status: 'available',
    url: 'https://hub.docker.com/r/libredb/libredb-studio',
    logo: '/logos/deploy/docker.svg',
    blurb: 'docker pull libredb/libredb-studio',
  },
  {
    name: 'Helm chart',
    slug: 'helm',
    category: 'registry',
    status: 'available',
    url: 'https://github.com/libredb/libredb-studio/pkgs/container/charts%2Flibredb-studio',
    logo: '/logos/deploy/helm.svg',
    blurb: 'ghcr.io/libredb/charts/libredb-studio (OCI)',
  },
  {
    name: 'Artifact Hub',
    slug: 'artifacthub',
    category: 'registry',
    status: 'available',
    url: 'https://artifacthub.io/packages/helm/libredb-studio/libredb-studio',
    logo: '/logos/deploy/artifacthub.svg',
    blurb: 'Helm chart, discoverable & versioned',
  },
  {
    name: 'npm',
    slug: 'npm',
    category: 'registry',
    status: 'available',
    url: 'https://www.npmjs.com/package/@libredb/studio',
    logo: '/logos/deploy/npm.svg',
    blurb: 'npx @libredb/studio',
  },
  {
    name: 'GitHub Releases',
    slug: 'github-releases',
    category: 'registry',
    status: 'available',
    url: 'https://github.com/libredb/libredb-studio/releases',
    blurb: 'Standalone tarballs on every release',
  },

  // ② Desktop apps & package managers — the os-desktop and package-managers
  // channels. Flathub is deprecated upstream (submission declined), so FlatPark
  // is the only Flatpak channel; never list Flathub here.
  {
    name: 'Homebrew',
    slug: 'homebrew',
    category: 'packages',
    status: 'available',
    url: 'https://github.com/libredb/homebrew-tap',
    blurb: 'brew install libredb/tap/libredb-studio',
  },
  {
    name: 'Snap Store',
    slug: 'snap',
    category: 'packages',
    status: 'available',
    url: 'https://snapcraft.io/libredb-studio',
    blurb: 'snap install libredb-studio',
  },
  {
    name: 'winget',
    slug: 'winget',
    category: 'packages',
    status: 'available',
    url: 'https://github.com/microsoft/winget-pkgs/tree/master/manifests/l/LibreDB/Studio',
    blurb: 'winget install LibreDB.Studio',
  },
  {
    name: 'Chocolatey',
    slug: 'chocolatey',
    category: 'packages',
    status: 'available',
    url: 'https://community.chocolatey.org/packages/libredb-studio',
    blurb: 'choco install libredb-studio',
  },
  {
    name: 'FlatPark',
    slug: 'flatpark',
    category: 'packages',
    status: 'available',
    url: 'https://flatpark.org/',
    docsUrl: 'https://github.com/libredb/libredb-studio/tree/main/packaging/flatpark',
    blurb: 'Signed Flatpak remote — org.libredb.Studio',
  },
  {
    name: 'Desktop app',
    slug: 'desktop-app',
    category: 'packages',
    status: 'available',
    url: RELEASES_URL,
    docsUrl: 'https://github.com/libredb/libredb-studio/blob/main/desktop/README.md',
    blurb: 'AppImage + GUI .deb, x64 and arm64',
  },
  {
    name: 'Linux .deb / .rpm',
    slug: 'linux-deb-rpm',
    category: 'packages',
    status: 'available',
    url: RELEASES_URL,
    blurb: 'apt / dnf install from the release assets',
  },

  {
    name: 'CapRover',
    slug: 'caprover',
    category: 'oss-paas',
    status: 'official',
    url: 'https://caprover.com',
    github: 'caprover/caprover',
    docsUrl: 'https://github.com/libredb/libredb-studio/tree/main/deploy/caprover',
    logo: '/logos/deploy/caprover.svg',
    blurb: 'Official one-click app',
  },
  {
    name: 'Dokploy',
    slug: 'dokploy',
    category: 'oss-paas',
    status: 'official',
    url: 'https://dokploy.com',
    github: 'Dokploy/dokploy',
    deployUrl: 'https://templates.dokploy.com/?q=libredb+studio',
    docsUrl: 'https://github.com/libredb/libredb-studio/tree/main/deploy/dokploy',
    logo: '/logos/deploy/dokploy.svg',
    blurb: 'Official template — one-click marketplace install',
  },
  {
    name: 'Cosmos',
    slug: 'cosmos',
    category: 'oss-paas',
    status: 'official',
    url: 'https://cosmos-cloud.io',
    github: 'azukaar/Cosmos-Server',
    docsUrl: 'https://github.com/libredb/libredb-studio/tree/main/deploy/cosmos',
    blurb: 'Official servapp — one-click marketplace install',
  },
  {
    name: 'Sealos',
    slug: 'sealos',
    category: 'oss-paas',
    status: 'available',
    url: 'https://sealos.io/products/app-store/libredb-studio',
    github: 'labring/sealos',
    blurb: 'App Store template — SQLite on a PVC by default',
  },
  {
    name: 'Unraid',
    slug: 'unraid',
    category: 'oss-paas',
    status: 'available',
    url: 'https://ca.unraid.net/apps/libredb-studio-0a5x41a1cy1kay',
    blurb: 'Community Applications template',
  },
  {
    name: 'TrueNAS SCALE',
    slug: 'truenas-scale',
    category: 'oss-paas',
    status: 'available',
    url: 'https://apps.truenas.com/catalog/libredb-studio_community/',
    blurb: 'Community apps catalog listing',
  },

  // ③ Kubernetes & orchestration — Helm chart install; stars shown (open-source)
  {
    name: 'Kubernetes',
    slug: 'kubernetes',
    category: 'kubernetes',
    status: 'available',
    url: 'https://kubernetes.io',
    github: 'kubernetes/kubernetes',
    docsUrl: 'https://artifacthub.io/packages/helm/libredb-studio/libredb-studio',
    logo: '/logos/deploy/kubernetes.svg',
    blurb: 'helm install from the published OCI chart',
  },
  // rancher/partner-charts#1158 merged (17 Aug 2026): the chart ships in
  // Rancher Partner Charts and is listed in the SUSE Solutions Catalog. Stays
  // 'available' rather than 'official' because a partner catalog is not a
  // one-click deploy of ours — the install is still an Apps catalog / ClusterRepo
  // step. 'official' is reserved for our own one-click listings.
  {
    name: 'Rancher',
    slug: 'rancher',
    category: 'kubernetes',
    status: 'available',
    url: 'https://www.rancher.com',
    github: 'rancher/rancher',
    docsUrl: 'https://github.com/libredb/libredb-studio/blob/main/docs/RANCHER.md',
    logo: '/logos/deploy/rancher.svg',
    blurb: 'In Rancher Partner Charts — SUSE catalog listed',
  },
  {
    name: 'Kubero',
    slug: 'kubero',
    category: 'kubernetes',
    status: 'official',
    url: 'https://www.kubero.dev',
    github: 'kubero-dev/kubero',
    docsUrl: 'https://github.com/libredb/libredb-studio/tree/main/deploy/kubero',
    blurb: 'Official one-click app in the Kubero catalog',
  },
  {
    name: 'Railway',
    slug: 'railway',
    category: 'managed-paas',
    status: 'official',
    url: 'https://railway.com',
    deployUrl: RAILWAY_DEPLOY_URL,
    docsUrl: 'https://github.com/libredb/libredb-studio/tree/main/deploy/railway',
    logo: '/logos/deploy/railway.svg',
    blurb: 'Official template — one-click deploy',
  },
  {
    name: 'Koyeb',
    slug: 'koyeb',
    category: 'managed-paas',
    status: 'available',
    url: 'https://www.koyeb.com',
    deployUrl: KOYEB_DEPLOY_URL,
    docsUrl: 'https://github.com/libredb/libredb-studio/tree/main/deploy/koyeb',
    logo: '/logos/deploy/koyeb.svg',
    blurb: 'Deploy button — serverless, scale-to-zero',
  },
  {
    name: 'Render',
    slug: 'render',
    category: 'managed-paas',
    status: 'available',
    url: 'https://render.com',
    deployUrl: RENDER_DEPLOY_URL,
    docsUrl: 'https://github.com/libredb/libredb-studio/tree/main#-one-click-deploy',
    logo: '/logos/deploy/render.svg',
    blurb: 'One-click deploy via render.yaml Blueprint',
  },
  {
    name: 'Fly.io',
    slug: 'fly',
    category: 'managed-paas',
    status: 'available',
    url: 'https://fly.io',
    docsUrl: 'https://github.com/libredb/libredb-studio/blob/main/docs/FLY.md',
    logo: '/logos/deploy/fly.svg',
    blurb: 'fly launch from the repo fly.toml',
  },
  {
    name: 'DigitalOcean',
    slug: 'digitalocean',
    category: 'managed-paas',
    status: 'available',
    url: 'https://marketplace.digitalocean.com/apps/libredb-studio',
    docsUrl: 'https://github.com/libredb/libredb-studio/tree/main/deploy/digitalocean',
    logo: '/logos/deploy/digitalocean.svg',
    blurb: 'Marketplace app — 1-Click Droplet',
  },
];

/** Categories whose targets are open-source platforms — we show live star counts there. */
const STAR_CATEGORIES: CategoryId[] = ['oss-paas', 'kubernetes'];

/** Repos whose live star counts we display (open-source platforms with a public repo). */
export const starRepos: string[] = deployTargets
  .filter((t) => STAR_CATEGORIES.includes(t.category) && t.github)
  .map((t) => t.github as string);
