/**
 * Distribution channels for /deploy.
 *
 * SOURCE OF TRUTH: libredb-studio → distribution/channels.yaml (the "visibility
 * matrix"), rendered for humans in docs/CHANNELS.md. That file is generated;
 * this one is transcribed from it.
 *
 * RULE: only `status: live` channels appear here. A channel that is `pending`
 * (submitted, not yet listed) or `deprecated` must never be shown — the page
 * would be promising an install that does not exist yet. As of the transcription
 * below, channels.yaml holds 33 channels: 26 live, 6 pending, 1 deprecated. The
 * 26 live ones are all present.
 *
 * When channels.yaml changes, re-transcribe rather than adding by hand — the
 * scorecard in docs/CHANNELS.md is the number to reconcile against.
 */
export type ChannelCategory =
  | 'registries-releases'
  | 'containers'
  | 'kubernetes-operators'
  | 'package-managers'
  | 'os-desktop'
  | 'paas-catalogs'
  | 'deploy-recipes'
  | 'cloud-marketplaces';

export type Platform = 'Linux' | 'macOS' | 'Windows' | 'Container' | 'Kubernetes' | 'Cloud';

export interface Channel {
  /** matches the `id` in channels.yaml */
  id: string;
  name: string;
  category: ChannelCategory;
  platforms: Platform[];
  url: string;
  /** the literal command, where the channel has one */
  command?: string;
  /** one line on what this channel actually gives you */
  note?: string;
  /** true where release CI publishes it on every release */
  automated: boolean;
}

export interface CategoryMeta {
  id: ChannelCategory;
  title: string;
  tagline: string;
}

export const channelCategories: CategoryMeta[] = [
  {
    id: 'registries-releases',
    title: 'Registries & releases',
    tagline: 'The published artifacts every other channel is built from.',
  },
  {
    id: 'containers',
    title: 'Containers',
    tagline: 'One image, the fastest path from nothing to a running Studio.',
  },
  {
    id: 'kubernetes-operators',
    title: 'Kubernetes',
    tagline: 'The published Helm chart, on any cluster — including a certified partner listing.',
  },
  {
    id: 'package-managers',
    title: 'Package managers',
    tagline: 'Install on your own machine with the manager you already use.',
  },
  {
    id: 'os-desktop',
    title: 'OS & desktop packages',
    tagline: 'A desktop application and native Linux packages, from the release assets.',
  },
  {
    id: 'paas-catalogs',
    title: 'PaaS catalogs',
    tagline: 'Listed in the catalog of a platform you already run — self-hosted or managed.',
  },
  {
    id: 'deploy-recipes',
    title: 'Deploy recipes',
    tagline: 'A config file in the repository that a platform reads to deploy it for you.',
  },
  {
    id: 'cloud-marketplaces',
    title: 'Cloud marketplaces',
    tagline: 'Provisioned from a cloud provider’s own marketplace.',
  },
];

export const channels: Channel[] = [
  // --- registries & releases (2 live) ---
  {
    id: 'github-release',
    name: 'GitHub Releases',
    category: 'registries-releases',
    platforms: ['Linux', 'macOS', 'Windows'],
    url: 'https://github.com/libredb/libredb-studio/releases',
    note: 'Standalone tarballs plus the .deb, .rpm and snap assets every other channel repackages.',
    automated: true,
  },
  {
    id: 'npm',
    name: 'npm — @libredb/studio',
    category: 'registries-releases',
    platforms: ['Linux', 'macOS', 'Windows'],
    url: 'https://www.npmjs.com/package/@libredb/studio',
    command: 'npx @libredb/studio',
    note: 'No Docker needed. Node 24+; downloads the release server archive. Also the package you embed in your own product.',
    automated: true,
  },

  // --- containers (2 live) ---
  {
    id: 'docker-ghcr',
    name: 'Docker image — GHCR',
    category: 'containers',
    platforms: ['Container'],
    url: 'https://github.com/libredb/libredb-studio/pkgs/container/libredb-studio',
    command: 'docker run -p 3000:3000 ghcr.io/libredb/libredb-studio:latest',
    note: 'The canonical image. Zero-config: the admin password is printed to the log on first run.',
    automated: true,
  },
  {
    id: 'docker-hub-mirror',
    name: 'Docker Hub mirror',
    category: 'containers',
    platforms: ['Container'],
    url: 'https://hub.docker.com/r/libredb/libredb-studio',
    command: 'docker run -p 3000:3000 libredb/libredb-studio',
    note: 'A mirror for discoverability. GHCR above is the canonical registry.',
    automated: true,
  },

  // --- kubernetes (2 live) ---
  {
    id: 'helm',
    name: 'Helm chart',
    category: 'kubernetes-operators',
    platforms: ['Kubernetes'],
    url: 'https://artifacthub.io/packages/helm/libredb-studio/libredb-studio',
    command: 'helm install libredb oci://ghcr.io/libredb/charts/libredb-studio',
    note: 'Published to the libredb.org repo, GHCR as OCI, and ArtifactHub. First-run credentials are printed to the pod log.',
    automated: true,
  },
  {
    id: 'rancher-partner',
    name: 'Rancher Partner Charts',
    category: 'kubernetes-operators',
    platforms: ['Kubernetes'],
    url: 'https://www.suse.com/pcsc/viewVersionPage?versionID=26969',
    note: 'A certified chart in Rancher Partner Charts, with a SUSE Partner Certification listing.',
    automated: false,
  },

  // --- package managers (5 live) ---
  {
    id: 'homebrew',
    name: 'Homebrew tap',
    category: 'package-managers',
    platforms: ['macOS', 'Linux'],
    url: 'https://github.com/libredb/homebrew-tap',
    command: 'brew trust libredb/tap && brew install libredb/tap/libredb-studio',
    note: 'brew trust is required once on Homebrew 6+; run brew update first if the command is unknown.',
    automated: true,
  },
  {
    id: 'snap',
    name: 'Snap Store',
    category: 'package-managers',
    platforms: ['Linux'],
    url: 'https://snapcraft.io/libredb-studio',
    command: 'sudo snap install libredb-studio',
    note: 'Stable channel, amd64 and arm64. The admin password is printed to sudo snap logs libredb-studio.',
    automated: true,
  },
  {
    id: 'winget',
    name: 'winget',
    category: 'package-managers',
    platforms: ['Windows'],
    url: 'https://github.com/microsoft/winget-pkgs/tree/master/manifests/l/LibreDB/Studio',
    command: 'winget install LibreDB.Studio',
    note: 'Portable zip with a bundled Node.js runtime — then run libredb-studio.',
    automated: true,
  },
  {
    id: 'chocolatey',
    name: 'Chocolatey',
    category: 'package-managers',
    platforms: ['Windows'],
    url: 'https://community.chocolatey.org/packages/libredb-studio',
    command: 'choco install libredb-studio',
    note: 'The same standalone zip as winget, from the Chocolatey community repository.',
    automated: true,
  },
  {
    id: 'flatpark',
    name: 'FlatPark (Flatpak)',
    category: 'package-managers',
    platforms: ['Linux'],
    url: 'https://flatpark.org/',
    note: 'A signed Flatpak remote carrying org.libredb.Studio, repackaged from the official vendor build.',
    automated: false,
  },

  // --- OS / desktop (3 live) ---
  {
    id: 'appimage',
    name: 'Desktop app — AppImage & .deb',
    category: 'os-desktop',
    platforms: ['Linux'],
    url: 'https://github.com/libredb/libredb-studio/releases/latest',
    note: 'A desktop wrapper shipped as release assets: AppImage and a GUI .deb, x64 and arm64.',
    automated: true,
  },
  {
    id: 'linux-deb-rpm',
    name: 'Linux .deb / .rpm',
    category: 'os-desktop',
    platforms: ['Linux'],
    url: 'https://github.com/libredb/libredb-studio/releases/latest',
    note: 'Native server packages, attached to every release.',
    automated: true,
  },
  {
    id: 'appimagehub',
    name: 'AppImageHub',
    category: 'os-desktop',
    platforms: ['Linux'],
    url: 'https://appimage.github.io/LibreDB_Studio/',
    note: 'The catalog AppImage Pool and Zap read. It resolves the latest release itself, so the listing follows every release without a submission.',
    automated: false,
  },

  // --- PaaS catalogs (8 live) ---
  {
    id: 'railway-template',
    name: 'Railway',
    category: 'paas-catalogs',
    platforms: ['Cloud'],
    url: 'https://railway.com/deploy/libredb-studio',
    note: 'A one-click template in Railway’s own catalog.',
    automated: false,
  },
  {
    id: 'caprover-official',
    name: 'CapRover',
    category: 'paas-catalogs',
    platforms: ['Cloud'],
    url: 'https://github.com/caprover/one-click-apps',
    note: 'Listed in CapRover’s official one-click apps.',
    automated: false,
  },
  {
    id: 'dokploy',
    name: 'Dokploy',
    category: 'paas-catalogs',
    platforms: ['Cloud'],
    url: 'https://templates.dokploy.com',
    note: 'In the Dokploy template catalog.',
    automated: false,
  },
  {
    id: 'kubero',
    name: 'Kubero',
    category: 'paas-catalogs',
    platforms: ['Cloud'],
    url: 'https://www.kubero.dev/templates',
    note: 'In the Kubero template catalog.',
    automated: false,
  },
  {
    id: 'sealos',
    name: 'Sealos',
    category: 'paas-catalogs',
    platforms: ['Cloud'],
    url: 'https://sealos.io/products/app-store/libredb-studio',
    note: 'A template in the Sealos App Store.',
    automated: false,
  },
  {
    id: 'cosmos',
    name: 'Cosmos',
    category: 'paas-catalogs',
    platforms: ['Container'],
    url: 'https://github.com/azukaar/cosmos-servapps-official',
    note: 'A servapp in the Cosmos marketplace.',
    automated: false,
  },
  {
    id: 'unraid-ca',
    name: 'Unraid Community Applications',
    category: 'paas-catalogs',
    platforms: ['Container'],
    url: 'https://ca.unraid.net/apps/libredb-studio-0a5x41a1cy1kay',
    note: 'Installable from Unraid’s Community Applications tab.',
    automated: false,
  },
  {
    id: 'truenas-scale',
    name: 'TrueNAS SCALE',
    category: 'paas-catalogs',
    platforms: ['Container'],
    url: 'https://apps.truenas.com/catalog/libredb-studio_community/',
    note: 'In the TrueNAS SCALE community apps catalog.',
    automated: false,
  },

  // --- deploy recipes (3 live) ---
  {
    id: 'fly-io',
    name: 'Fly.io',
    category: 'deploy-recipes',
    platforms: ['Cloud'],
    url: 'https://github.com/libredb/libredb-studio/blob/main/fly.toml',
    note: 'A fly.toml in the repository — fly launch reads it.',
    automated: false,
  },
  {
    id: 'render',
    name: 'Render',
    category: 'deploy-recipes',
    platforms: ['Cloud'],
    url: 'https://github.com/libredb/libredb-studio/blob/main/render.yaml',
    note: 'A render.yaml Blueprint in the repository.',
    automated: false,
  },
  {
    id: 'koyeb-deploy-button',
    name: 'Koyeb',
    category: 'deploy-recipes',
    platforms: ['Cloud'],
    url: 'https://github.com/libredb/libredb-studio/tree/main/deploy/koyeb',
    note: 'A deploy button in the repository README. It deliberately ships no default credentials — you supply your own.',
    automated: false,
  },

  // --- cloud marketplaces (1 live) ---
  {
    id: 'digitalocean',
    name: 'DigitalOcean Marketplace',
    category: 'cloud-marketplaces',
    platforms: ['Cloud'],
    url: 'https://marketplace.digitalocean.com/apps/libredb-studio',
    note: 'Provisioned straight from DigitalOcean’s marketplace.',
    automated: false,
  },
];
