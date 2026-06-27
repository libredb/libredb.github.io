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

test('every section has page SEO fields', () => {
  for (const s of sections) {
    expect(typeof s.slug).toBe('string');
    expect(s.pageTitle.length).toBeGreaterThan(0);
    expect(s.pageDescription.length).toBeGreaterThan(0);
  }
});

test('every section declares a schema of studio or database', () => {
  for (const s of sections) {
    expect(['studio', 'database']).toContain(s.schema);
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
