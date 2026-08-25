export type CategoryId = 'registry' | 'packages' | 'oss-paas' | 'kubernetes' | 'managed-paas';

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
    id: 'packages',
    title: 'Desktop apps & package managers',
    tagline: 'Install on your own machine with the package manager you already use.',
    order: 2,
  },
  {
    id: 'oss-paas',
    title: 'Open-source & self-hosted PaaS',
    tagline: 'Run LibreDB Studio inside the open-source platforms you already self-host.',
    order: 3,
  },
  {
    id: 'kubernetes',
    title: 'Kubernetes & orchestration',
    tagline: 'Install the published Helm chart on any cluster — including enterprise distributions.',
    order: 4,
  },
  {
    id: 'managed-paas',
    title: 'Managed & commercial PaaS',
    tagline: 'One-click deploys on hosted platforms — no servers to manage.',
    order: 5,
  },
];
