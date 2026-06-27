/**
 * Approximate star counts baked in as a fallback so a build that is offline or
 * rate-limited still renders a number (and the client refresh can update it).
 * Note: production builds (GitHub Pages CI) frequently hit the unauthenticated
 * GitHub API rate limit, so these fallbacks are what most visitors actually see
 * — keep them current. Snapshot from the live repos when editing the data file.
 * Last snapshot: 2026-06-22.
 */
export const FALLBACK_STARS: Record<string, number> = {
  'caprover/caprover': 15000,
  'coollabsio/coolify': 57000,
  'Dokploy/dokploy': 35000,
  'portainer/portainer': 38000,
  'dokku/dokku': 32000,
  'kubero-dev/kubero': 4300,
  'basecamp/kamal': 14000,
  'rancher/rancher': 26000,
  'okd-project/okd': 2100,
  'kubernetes/kubernetes': 123000,
  'kubesphere/kubesphere': 17000,
  'k0rdent/k0rdent': 630,
  'appwrite/appwrite': 56000,
  'nhost/nhost': 9200,
  'azukaar/Cosmos-Server': 6000,
};

/** 41200 -> "41.2k", 132000 -> "132k", 980 -> "980". */
export function formatStars(n: number): string {
  if (n < 1000) return String(n);
  const k = n / 1000;
  const rounded = k >= 100 ? Math.round(k) : Math.round(k * 10) / 10;
  return `${rounded}k`;
}

/**
 * Fetch star counts for each repo. Build-time only (Node): it sets a
 * `User-Agent` header, which browsers forbid — the client refresh script in
 * deploy.astro does its own header-free fetch instead. Any failure falls back
 * to FALLBACK_STARS (or 0).
 */
export async function getStars(repos: string[]): Promise<Record<string, number>> {
  const entries = await Promise.all(
    repos.map(async (repo): Promise<[string, number]> => {
      try {
        const res = await fetch(`https://api.github.com/repos/${repo}`, {
          headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'libredb-website' },
        });
        if (!res.ok) throw new Error(`status ${res.status}`);
        const data = (await res.json()) as { stargazers_count?: number };
        const stars = data?.stargazers_count;
        return [repo, typeof stars === 'number' ? stars : (FALLBACK_STARS[repo] ?? 0)];
      } catch {
        return [repo, FALLBACK_STARS[repo] ?? 0];
      }
    }),
  );
  return Object.fromEntries(entries);
}
