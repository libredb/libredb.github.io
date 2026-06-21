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
    blurb: 'Open-source deployment platform' },
  { name: 'Portainer', slug: 'portainer', category: 'oss-paas', status: 'planned',
    url: 'https://www.portainer.io', github: 'portainer/portainer',
    logo: '/logos/deploy/portainer.svg', blurb: 'Container management UI' },
  { name: 'Dokku', slug: 'dokku', category: 'oss-paas', status: 'planned',
    url: 'https://dokku.com', github: 'dokku/dokku',
    blurb: 'Docker-powered mini-Heroku' },
  { name: 'Easypanel', slug: 'easypanel', category: 'oss-paas', status: 'planned',
    url: 'https://easypanel.io', blurb: 'Modern server control panel' },
  { name: 'Kamal', slug: 'kamal', category: 'oss-paas', status: 'planned',
    url: 'https://kamal-deploy.org', github: 'basecamp/kamal',
    blurb: 'Deploy containers to any host' },
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
    blurb: 'Self-hosted server with reverse proxy' },

  // ③ Kubernetes & orchestration — Helm chart install; stars shown (open-source)
  { name: 'Kubernetes', slug: 'kubernetes', category: 'kubernetes', status: 'available',
    url: 'https://kubernetes.io', github: 'kubernetes/kubernetes',
    docsUrl: 'https://artifacthub.io/packages/helm/libredb-studio/libredb-studio',
    logo: '/logos/deploy/kubernetes.svg', blurb: 'helm install from the published OCI chart' },
  { name: 'Rancher', slug: 'rancher', category: 'kubernetes', status: 'planned',
    url: 'https://www.rancher.com', github: 'rancher/rancher',
    logo: '/logos/deploy/rancher.svg', blurb: 'Enterprise Kubernetes management (SUSE)' },
  { name: 'OpenShift / OKD', slug: 'openshift', category: 'kubernetes', status: 'planned',
    url: 'https://www.openshift.com', github: 'okd-project/okd',
    logo: '/logos/deploy/openshift.svg', blurb: 'Red Hat Kubernetes platform' },
  { name: 'Kubero', slug: 'kubero', category: 'kubernetes', status: 'planned',
    url: 'https://www.kubero.dev', github: 'kubero-dev/kubero',
    blurb: 'Heroku-like PaaS on Kubernetes' },
  { name: 'KubeSphere', slug: 'kubesphere', category: 'kubernetes', status: 'planned',
    url: 'https://kubesphere.io', github: 'kubesphere/kubesphere',
    blurb: 'Open-source Kubernetes platform with app store' },
  { name: 'k0rdent', slug: 'k0rdent', category: 'kubernetes', status: 'planned',
    url: 'https://k0rdent.io', github: 'k0rdent/k0rdent',
    blurb: 'Multi-cluster management for platform engineering' },
  { name: 'Platform9', slug: 'platform9', category: 'kubernetes', status: 'planned',
    url: 'https://platform9.com', blurb: 'SaaS-managed Kubernetes with a Helm catalog' },
  { name: 'Mirantis Kubernetes Engine', slug: 'mke', category: 'kubernetes', status: 'planned',
    url: 'https://www.mirantis.com/software/mirantis-kubernetes-engine/',
    blurb: 'Enterprise Kubernetes engine (ex-Docker EE)' },
  { name: 'Giant Swarm', slug: 'giantswarm', category: 'kubernetes', status: 'planned',
    url: 'https://www.giantswarm.io', blurb: 'Curated managed Kubernetes platform' },

  // ④ Managed / commercial PaaS — no stars
  { name: 'Railway', slug: 'railway', category: 'managed-paas', status: 'official',
    url: 'https://railway.com', deployUrl: RAILWAY_DEPLOY_URL,
    docsUrl: 'https://github.com/libredb/libredb-studio/tree/main/deploy/railway',
    logo: '/logos/deploy/railway.svg', blurb: 'Official template — one-click deploy' },
  { name: 'Koyeb', slug: 'koyeb', category: 'managed-paas', status: 'available',
    url: 'https://www.koyeb.com', deployUrl: KOYEB_DEPLOY_URL,
    docsUrl: 'https://github.com/libredb/libredb-studio/tree/main/deploy/koyeb',
    logo: '/logos/deploy/koyeb.svg', blurb: 'Deploy button — serverless, scale-to-zero' },
  { name: 'Render', slug: 'render', category: 'managed-paas', status: 'available',
    url: 'https://render.com', deployUrl: RENDER_DEPLOY_URL,
    docsUrl: 'https://github.com/libredb/libredb-studio/tree/main#-one-click-deploy',
    logo: '/logos/deploy/render.svg', blurb: 'One-click deploy via render.yaml Blueprint' },
  { name: 'Fly.io', slug: 'fly', category: 'managed-paas', status: 'planned',
    url: 'https://fly.io', logo: '/logos/deploy/fly.svg', blurb: 'Run containers near users' },
  { name: 'Netlify', slug: 'netlify', category: 'managed-paas', status: 'planned',
    url: 'https://www.netlify.com', logo: '/logos/deploy/netlify.svg', blurb: 'Web platform' },
  { name: 'Heroku', slug: 'heroku', category: 'managed-paas', status: 'planned',
    url: 'https://www.heroku.com', blurb: 'The original PaaS' },
  { name: 'Northflank', slug: 'northflank', category: 'managed-paas', status: 'planned',
    url: 'https://northflank.com', blurb: 'Full-stack deployment platform' },
  { name: 'Qovery', slug: 'qovery', category: 'managed-paas', status: 'planned',
    url: 'https://www.qovery.com', blurb: 'Deploy on your own cloud' },
  { name: 'Platform.sh', slug: 'platformsh', category: 'managed-paas', status: 'planned',
    url: 'https://platform.sh', blurb: 'End-to-end PaaS' },

  // ⑤ Cloud hyperscalers — no stars
  { name: 'AWS', slug: 'aws', category: 'cloud', status: 'planned',
    url: 'https://aws.amazon.com', blurb: 'ECS / Fargate / App Runner' },
  { name: 'Google Cloud', slug: 'gcp', category: 'cloud', status: 'planned',
    url: 'https://cloud.google.com', logo: '/logos/deploy/gcp.svg', blurb: 'Cloud Run / GKE' },
  { name: 'Microsoft Azure', slug: 'azure', category: 'cloud', status: 'planned',
    url: 'https://azure.microsoft.com', blurb: 'Container Apps / ACI / AKS' },
  { name: 'DigitalOcean', slug: 'digitalocean', category: 'cloud', status: 'planned',
    url: 'https://www.digitalocean.com', logo: '/logos/deploy/digitalocean.svg', blurb: 'App Platform / Droplets' },
  { name: 'Alibaba Cloud', slug: 'alibaba', category: 'cloud', status: 'planned',
    url: 'https://www.alibabacloud.com', blurb: 'ECS / Container Service' },
];

/** Categories whose targets are open-source platforms — we show live star counts there. */
const STAR_CATEGORIES: CategoryId[] = ['oss-paas', 'kubernetes'];

/** Repos whose live star counts we display (open-source platforms with a public repo). */
export const starRepos: string[] = deployTargets
  .filter((t) => STAR_CATEGORIES.includes(t.category) && t.github)
  .map((t) => t.github as string);
