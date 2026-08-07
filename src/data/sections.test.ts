import { test, expect } from 'bun:test';
import { sections, sectionById } from './sections';
import { schemas } from './schemas';

test('every section has a unique slug; home is empty', () => {
  const slugs = sections.map((s) => s.slug);
  expect(new Set(slugs).size).toBe(slugs.length);
  expect(sectionById['home'].slug).toBe('');
  expect(sectionById['tech_stack'].slug).toBe('tech-stack');
  expect(sectionById['get_started'].slug).toBe('get-started');
  expect(sectionById['docker_compose'].slug).toBe('docker-compose-example');
});

test('docker_compose table exists with page SEO', () => {
  const d = sectionById['docker_compose'];
  expect(d).toBeDefined();
  expect(d.pageTitle.length).toBeGreaterThan(0);
  expect(d.pageDescription.length).toBeGreaterThan(0);
});

test('support section exists at /support and names the platform columns', () => {
  const s = sectionById['support'];
  expect(s).toBeDefined();
  expect(s.slug).toBe('support');
  expect(s.table).toBe('support');
  expect(s.schema).toBe('studio');
  // The certification evidence lives in these three columns; renaming one
  // silently breaks the parity with the table in docs/RANCHER.md.
  expect(s.columns.map((c) => c.name)).toEqual(['component', 'supported', 'validated']);
});

test('studio manifesto section exists at /manifesto and names the story columns', () => {
  const m = sectionById['manifesto'];
  expect(m).toBeDefined();
  expect(m.slug).toBe('manifesto');
  expect(m.table).toBe('manifesto');
  expect(m.schema).toBe('studio');
  // The page renders one card per consequence of the belief; renaming a column
  // silently breaks the parity with docs/BRAND_MESSAGING.md in libredb-studio.
  expect(m.columns.map((c) => c.name)).toEqual(['belief', 'consequence']);
});

test('no section copy hardcodes an engine count', () => {
  // engines.ts is the single source of truth precisely so counts cannot drift.
  // Copy that spells out "7+ engines" goes stale the moment a provider lands.
  for (const s of sections) {
    expect(s.explain).not.toMatch(/\d\s*\+?\s*(engines|databases)/i);
    expect(s.pageDescription).not.toMatch(/\d\s*\+?\s*(engines|databases)/i);
  }
});

test('every section has page SEO fields', () => {
  for (const s of sections) {
    expect(typeof s.slug).toBe('string');
    expect(s.pageTitle.length).toBeGreaterThan(0);
    expect(s.pageDescription.length).toBeGreaterThan(0);
  }
});

test('every section declares a schema of studio, database, or platform', () => {
  for (const s of sections) {
    expect(['studio', 'database', 'platform']).toContain(s.schema);
  }
});

test('all existing (non-database) sections are schema "studio"', () => {
  const studioIds = ['home', 'features', 'compare', 'tech_stack', 'get_started', 'faq', 'deploy', 'docker_compose'];
  for (const id of studioIds) {
    expect(sectionById[id].schema).toBe('studio');
  }
});

test('schemas manifest has studio, database, platform in order', () => {
  expect(schemas.map((s) => s.id)).toEqual(['studio', 'database', 'platform']);
  const platform = schemas.find((s) => s.id === 'platform');
  expect(platform?.external?.href).toBe('https://platform.libredb.org');
});

test('providers section replaces databases (id, slug, table)', () => {
  expect(sectionById['databases']).toBeUndefined();
  const p = sectionById['providers'];
  expect(p).toBeDefined();
  expect(p.slug).toBe('providers');
  expect(p.table).toBe('providers');
  expect(p.schema).toBe('studio');
});

test('database-schema sections exist with correct slugs', () => {
  const dbSections = sections.filter((s) => s.schema === 'database');
  expect(dbSections.map((s) => s.id).sort()).toEqual(
    ['database', 'database_architecture', 'database_reliability', 'playground'].sort(),
  );
  expect(sectionById['database'].slug).toBe('database');
  expect(sectionById['database_architecture'].slug).toBe('database-architecture');
  expect(sectionById['database_reliability'].slug).toBe('database-reliability');
  expect(sectionById['playground'].slug).toBe('playground');
});

test('platform overview section exists (internal /platform)', () => {
  const p = sectionById['platform'];
  expect(p).toBeDefined();
  expect(p.slug).toBe('platform');
  expect(p.table).toBe('overview');
  expect(p.schema).toBe('platform');
});
