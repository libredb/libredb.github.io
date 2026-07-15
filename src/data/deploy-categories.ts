export type CategoryId = 'registry' | 'oss-paas' | 'kubernetes' | 'managed-paas';

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
    id: 'kubernetes',
    title: 'Kubernetes & orchestration',
    tagline: 'Install the published Helm chart on any cluster — including enterprise distributions.',
    order: 3,
  },
  {
    id: 'managed-paas',
    title: 'Managed & commercial PaaS',
    tagline: 'One-click deploys on hosted platforms — no servers to manage.',
    order: 4,
  },
];
