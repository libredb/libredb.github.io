import { test, expect, mock, afterEach } from 'bun:test';
import { formatStars, getStars, FALLBACK_STARS } from './github-stars';
import { starRepos } from '../data/deploy-targets';

// Tests assign globalThis.fetch directly (not spyOn), which mock.restore()
// does not revert — capture and restore the original to keep tests isolated.
const originalFetch = globalThis.fetch;
afterEach(() => {
  mock.restore();
  globalThis.fetch = originalFetch;
});

test('formatStars renders compact counts', () => {
  expect(formatStars(0)).toBe('0');
  expect(formatStars(980)).toBe('980');
  expect(formatStars(1000)).toBe('1k');
  expect(formatStars(1500)).toBe('1.5k');
  expect(formatStars(41200)).toBe('41.2k');
  expect(formatStars(132000)).toBe('132k');
});

test('getStars uses the live count on success', async () => {
  globalThis.fetch = mock(
    async () => new Response(JSON.stringify({ stargazers_count: 12345 }), { status: 200 }),
  ) as unknown as typeof fetch;

  const result = await getStars(['caprover/caprover']);
  expect(result['caprover/caprover']).toBe(12345);
});

test('getStars falls back when the request fails', async () => {
  globalThis.fetch = mock(async () => new Response('nope', { status: 403 })) as unknown as typeof fetch;

  const result = await getStars(['caprover/caprover']);
  expect(result['caprover/caprover']).toBe(FALLBACK_STARS['caprover/caprover']);
});

test('getStars falls back when fetch throws', async () => {
  globalThis.fetch = mock(async () => {
    throw new Error('offline');
  }) as unknown as typeof fetch;

  const result = await getStars(['Dokploy/dokploy']);
  expect(result['Dokploy/dokploy']).toBe(FALLBACK_STARS['Dokploy/dokploy']);
});

test('every starRepo has a baked fallback (build/client total coherence)', () => {
  for (const repo of starRepos) {
    expect(FALLBACK_STARS).toHaveProperty(repo);
  }
});
