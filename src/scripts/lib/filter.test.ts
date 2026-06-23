import { test, expect } from 'bun:test';
import { fuzzyMatch, filterItems } from './filter';

test('empty query matches everything with score 0', () => {
  expect(fuzzyMatch('', 'features')).toBe(0);
});

test('subsequence matches, non-subsequence does not', () => {
  expect(fuzzyMatch('ftr', 'features')).not.toBeNull();
  expect(fuzzyMatch('xyz', 'features')).toBeNull();
});

test('contiguous match scores better (lower) than gapped', () => {
  const contiguous = fuzzyMatch('feat', 'features')!;
  const gapped = fuzzyMatch('fts', 'features')!;
  expect(contiguous).toBeLessThan(gapped);
});

test('filterItems returns matches ordered by score, empty query returns all', () => {
  const items = ['home', 'features', 'deploy', 'faq'];
  expect(filterItems('', items, (s) => s)).toEqual(items);
  expect(filterItems('fa', items, (s) => s)).toEqual(['faq', 'features']);
  expect(filterItems('zzz', items, (s) => s)).toEqual([]);
});
