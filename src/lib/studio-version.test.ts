import { test, expect } from 'bun:test';
import { pickLatestStudioVersion, FALLBACK_STUDIO_VERSION } from './studio-version';

test('picks the newest bare-semver app release', () => {
  const releases = [
    { tag_name: '0.9.57', draft: false, prerelease: false },
    { tag_name: '0.9.56', draft: false, prerelease: false },
  ];
  expect(pickLatestStudioVersion(releases)).toBe('0.9.57');
});

test('skips chart releases, drafts, prereleases, and moving tags', () => {
  const releases = [
    { tag_name: 'libredb-studio-chart-0.1.16', draft: false, prerelease: false },
    { tag_name: '1.0.0', draft: true, prerelease: false },
    { tag_name: '0.10.0-rc.1', draft: false, prerelease: false },
    { tag_name: 'main', draft: false, prerelease: true },
    { tag_name: '0.9.56', draft: false, prerelease: false },
  ];
  expect(pickLatestStudioVersion(releases)).toBe('0.9.56');
});

test('returns null when no bare-semver release exists', () => {
  expect(pickLatestStudioVersion([{ tag_name: 'libredb-studio-chart-0.1.16' }])).toBeNull();
  expect(pickLatestStudioVersion([])).toBeNull();
});

test('fallback version is itself bare semver', () => {
  expect(FALLBACK_STUDIO_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
});
