/**
 * Latest LibreDB Studio version, fetched from GitHub releases at build time.
 * The studio repo cuts two release tracks: app releases tagged as bare semver
 * ("0.9.56") and Helm chart releases with prefixed tags — only bare-semver
 * tags count. Any failure falls back to FALLBACK_STUDIO_VERSION so an
 * offline/rate-limited build still renders a plausible number.
 */
export const FALLBACK_STUDIO_VERSION = '0.9.56';

interface ReleaseLike {
  tag_name?: string;
  draft?: boolean;
  prerelease?: boolean;
}

/** First published bare-semver tag wins (the releases API returns newest first). */
export function pickLatestStudioVersion(releases: ReleaseLike[]): string | null {
  for (const r of releases) {
    if (r.draft || r.prerelease) continue;
    const tag = r.tag_name ?? '';
    if (/^\d+\.\d+\.\d+$/.test(tag)) return tag;
  }
  return null;
}

async function fetchStudioVersion(): Promise<string> {
  try {
    // per_page=30 comfortably covers interleaved chart releases; the timeout
    // keeps a slow/blocked network from hanging the static build.
    const res = await fetch('https://api.github.com/repos/libredb/libredb-studio/releases?per_page=30', {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'libredb-website' },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`status ${res.status}`);
    const releases = (await res.json()) as ReleaseLike[];
    return pickLatestStudioVersion(releases) ?? FALLBACK_STUDIO_VERSION;
  } catch {
    return FALLBACK_STUDIO_VERSION;
  }
}

let cached: Promise<string> | null = null;

/** Memoized per build — every component shares one API call. */
export function getStudioVersion(): Promise<string> {
  cached ??= fetchStudioVersion();
  return cached;
}
