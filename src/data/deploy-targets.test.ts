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

test('registries mirror the live channels in distribution/channels.yaml', () => {
  const registries = deployTargets.filter((t) => t.category === 'registry');
  const available = registries.filter((t) => t.status === 'available').map((t) => t.slug);
  expect(available.toSorted()).toEqual(
    ['ghcr', 'docker', 'helm', 'artifacthub', 'npm', 'homebrew', 'snap', 'github-releases'].toSorted(),
  );
});

test('only live targets are listed — planned platforms stay off the page', () => {
  expect(deployTargets.every((t) => t.status !== 'planned')).toBe(true);
});

test('only open-source platforms declare a github repo (stars constraint)', () => {
  const starCategories = ['oss-paas', 'kubernetes'];
  const withGithub = deployTargets.filter((t) => t.github);
  expect(withGithub.every((t) => starCategories.includes(t.category))).toBe(true);
  expect(starRepos.length).toBeGreaterThan(0);
});

test('rancher is listed under kubernetes and points at our Rancher docs', () => {
  const rancher = deployTargets.find((t) => t.slug === 'rancher');
  expect(rancher).toBeDefined();
  expect(rancher?.category).toBe('kubernetes');
  // Stays 'available' until rancher/partner-charts#1158 merges and the chart
  // ships in Rancher's own Partners repository.
  expect(rancher?.status).toBe('available');
  expect(rancher?.docsUrl).toContain('docs/RANCHER.md');
});

test('official integrations are present', () => {
  const official = deployTargets.filter((t) => t.status === 'official').map((t) => t.slug);
  for (const slug of ['railway', 'caprover', 'dokploy', 'cosmos', 'kubero']) {
    expect(official).toContain(slug);
  }
});
