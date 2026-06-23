import { test, expect } from 'bun:test';
import { sections, sectionById } from './sections';

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
