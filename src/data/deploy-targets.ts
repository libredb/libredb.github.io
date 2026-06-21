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
    blurb: 'Open-source deployment platform' },
  { name: 'Portainer', slug: 'portainer', category: 'oss-paas', status: 'planned',
    url: 'https://www.portainer.io', github: 'portainer/portainer',
    logo: '/logos/deploy/portainer.svg', blurb: 'Container management UI' },
  { name: 'Dokku', slug: 'dokku', category: 'oss-paas', status: 'planned',
    url: 'https://dokku.com', github: 'dokku/dokku',
    blurb: 'Docker-powered mini-Heroku' },
  { name: 'Easypanel', slug: 'easypanel', category: 'oss-paas', status: 'planned',
    url: 'https://easypanel.io', blurb: 'Modern server control panel' },
  { name: 'Kubero', slug: 'kubero', category: 'oss-paas', status: 'planned',
    url: 'https://www.kubero.dev', github: 'kubero-dev/kubero',
    blurb: 'Heroku-like PaaS on Kubernetes' },
  { name: 'Kamal', slug: 'kamal', category: 'oss-paas', status: 'planned',
    url: 'https://kamal-deploy.org', github: 'basecamp/kamal',
    blurb: 'Deploy containers to any host' },
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
    blurb: 'Self-hosted server with reverse proxy' },

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
    url: 'https://www.heroku.com', blurb: 'The original PaaS' },
  { name: 'Northflank', slug: 'northflank', category: 'managed-paas', status: 'planned',
    url: 'https://northflank.com', blurb: 'Full-stack deployment platform' },
  { name: 'Qovery', slug: 'qovery', category: 'managed-paas', status: 'planned',
    url: 'https://www.qovery.com', blurb: 'Deploy on your own cloud' },
  { name: 'Platform.sh', slug: 'platformsh', category: 'managed-paas', status: 'planned',
    url: 'https://platform.sh', blurb: 'End-to-end PaaS' },

  // ④ Cloud hyperscalers — no stars
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

/** Repos whose live star counts we display (oss-paas with a public repo). */
export const starRepos: string[] = deployTargets
  .filter((t) => t.category === 'oss-paas' && t.github)
  .map((t) => t.github as string);
