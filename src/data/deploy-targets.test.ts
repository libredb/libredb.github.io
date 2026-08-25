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
  expect(available.toSorted()).toEqual(['ghcr', 'docker', 'helm', 'artifacthub', 'npm', 'github-releases'].toSorted());
});

test('package managers and desktop packages mirror the live channels', () => {
  const packages = deployTargets.filter((t) => t.category === 'packages').map((t) => t.slug);
  expect(packages.toSorted()).toEqual(
    ['homebrew', 'snap', 'winget', 'chocolatey', 'flatpark', 'desktop-app', 'linux-deb-rpm'].toSorted(),
  );
});

test('only live targets are listed — planned platforms stay off the page', () => {
  expect(deployTargets.every((t) => t.status !== 'planned')).toBe(true);
});

test('channels that are pending or deprecated upstream are not listed', () => {
  // Flathub is deprecated (submission declined — FlatPark is our Flatpak
  // channel); the rest are status: pending in distribution/channels.yaml.
  // OpenShift is not on this list: the community operator is live in the
  // OpenShift console catalog (community-operators-prod#10497), even though the
  // OperatorHub.io listing that would flip the yaml channel to live is still in
  // review.
  const offThePage = ['flathub', 'casaos', 'umbrel', 'easypanel', 'portainer', 'koyeb-catalog', 'appimagehub'];
  const slugs = deployTargets.map((t) => t.slug);
  for (const slug of offThePage) {
    expect(slugs).not.toContain(slug);
  }
});

test('only open-source platforms declare a github repo (stars constraint)', () => {
  const starCategories = ['oss-paas', 'kubernetes'];
  const withGithub = deployTargets.filter((t) => t.github);
  expect(withGithub.every((t) => starCategories.includes(t.category))).toBe(true);
  expect(starRepos.length).toBeGreaterThan(0);
});

test('rancher is official, leads the hero, and points at our Rancher docs', () => {
  const rancher = deployTargets.find((t) => t.slug === 'rancher');
  expect(rancher).toBeDefined();
  expect(rancher?.category).toBe('kubernetes');
  // rancher/partner-charts#1158 merged: certified chart in Rancher Partner
  // Charts, listed in the SUSE Partner Certification catalog.
  expect(rancher?.status).toBe('official');
  expect(rancher?.url).toContain('suse.com/pcsc');
  expect(rancher?.docsUrl).toContain('docs/RANCHER.md');
  // The hero renders official targets in array order — Rancher goes first.
  expect(deployTargets.filter((t) => t.status === 'official')[0]?.slug).toBe('rancher');
});

test('openshift installs via the community operator and is not claimed as official', () => {
  const openshift = deployTargets.find((t) => t.slug === 'openshift');
  expect(openshift).toBeDefined();
  expect(openshift?.category).toBe('kubernetes');
  expect(openshift?.status).toBe('available');
  expect(openshift?.blurb).toContain('operator');
});

test('official integrations are present', () => {
  const official = deployTargets.filter((t) => t.status === 'official').map((t) => t.slug);
  for (const slug of ['rancher', 'railway', 'caprover', 'dokploy', 'cosmos', 'kubero']) {
    expect(official).toContain(slug);
  }
});

test('official is reserved for first-party listings', () => {
  // Community-contributed catalog entries (Sealos, Unraid, TrueNAS) and plain
  // deploy buttons (Koyeb, Render, Fly.io, DigitalOcean) stay 'available'.
  const official = deployTargets.filter((t) => t.status === 'official').map((t) => t.slug);
  expect(official.toSorted()).toEqual(['rancher', 'railway', 'caprover', 'dokploy', 'cosmos', 'kubero'].toSorted());
});

test('every target links somewhere useful', () => {
  for (const t of deployTargets) {
    expect(t.url.startsWith('https://')).toBe(true);
    for (const link of [t.deployUrl, t.docsUrl]) {
      if (link) expect(link.startsWith('https://')).toBe(true);
    }
  }
});
