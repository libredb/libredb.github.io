/**
 * Approximate star counts baked in as a fallback so a build that is offline or
 * rate-limited still renders a number (and the client refresh can update it).
 * Snapshot these from the live repos when editing the data file.
 */
export const FALLBACK_STARS: Record<string, number> = {
  'caprover/caprover': 13700,
  'coollabsio/coolify': 42000,
  'Dokploy/dokploy': 19000,
  'portainer/portainer': 32000,
  'dokku/dokku': 30000,
  'kubero-dev/kubero': 1700,
  'basecamp/kamal': 13000,
  'rancher/rancher': 24000,
  'okd-project/okd': 1700,
  'kubernetes/kubernetes': 116000,
  'appwrite/appwrite': 51000,
  'nhost/nhost': 8000,
  'azukaar/Cosmos-Server': 4000,
};

/** 41200 -> "41.2k", 132000 -> "132k", 980 -> "980". */
export function formatStars(n: number): string {
  if (n < 1000) return String(n);
  const k = n / 1000;
  const rounded = k >= 100 ? Math.round(k) : Math.round(k * 10) / 10;
  return `${rounded}k`;
}

/**
 * Fetch star counts for each repo. Runs at build time (Node) and is safe to
 * call from a browser too. Any failure falls back to FALLBACK_STARS (or 0).
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
        return [repo, typeof stars === 'number' ? stars : FALLBACK_STARS[repo] ?? 0];
      } catch {
        return [repo, FALLBACK_STARS[repo] ?? 0];
      }
    }),
  );
  return Object.fromEntries(entries);
}
