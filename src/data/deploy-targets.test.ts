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

test('only open-source platforms declare a github repo (stars constraint)', () => {
  const starCategories = ['oss-paas', 'kubernetes'];
  const withGithub = deployTargets.filter((t) => t.github);
  expect(withGithub.every((t) => starCategories.includes(t.category))).toBe(true);
  expect(starRepos.length).toBeGreaterThan(0);
});

test('official integrations are present', () => {
  const official = deployTargets.filter((t) => t.status === 'official').map((t) => t.slug);
  expect(official).toContain('railway');
  expect(official).toContain('caprover');
});
