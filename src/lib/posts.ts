import { engines } from '../data/engines';

/**
 * Which engine a post is about, read from its slug.
 *
 * The blog is organised by engine — `postgresql-explain-analyze-executes`,
 * `mysql-cancel-runaway-query`, `sqlserver-no-execution-plan-shown`. That
 * grouping is real and load-bearing (nine PostgreSQL posts, eight MySQL) but it
 * lived only in the filename, so nothing could use it: "Keep reading" showed the
 * two newest posts to all 104, and a reader on a Postgres page was never offered
 * the other eight.
 *
 * `engines.ts` is the source of the id list — a second copy here would drift the
 * moment an engine is added. Longest match first, because `sqlserver` and
 * `sqlite` both start with `sql`, and `libsql` contains `sql` outright.
 */
const ENGINE_IDS = [...engines.map((e) => e.id)].sort((a, b) => b.length - a.length);

export function postEngine(id: string): string | undefined {
  const slug = id.toLowerCase();
  return ENGINE_IDS.find((engineId) => slug === engineId || slug.startsWith(`${engineId}-`));
}

/** The engine's display name, for a heading that names what it is offering. */
export function engineName(engineId: string): string | undefined {
  return engines.find((e) => e.id === engineId)?.name;
}

type Datable = { id: string; data: { publishedAt: Date } };

/**
 * The engine archives the blog actually offers: engine id to its posts, newest
 * first, for engines with at least two posts.
 *
 * The threshold and the grouping live here because two routes need the same
 * answer — the archive page and its feed. When they each carried their own copy
 * of the loop, the only thing keeping a feed from existing without its page was
 * that both happened to say `>= 2`. One edit to either and they part silently,
 * which is the drift this repo keeps writing rules against.
 *
 * Two is the floor because one post is the post, not an archive of it.
 */
/** The shape both engine routes hand each other: a list of published posts. */
export type PublishedPosts = Awaited<ReturnType<typeof import('astro:content').getCollection<'posts'>>>;

/** One post is the post, not an archive of it. */
const ARCHIVE_MIN = 2;

export function engineArchives<T extends Datable>(posts: T[]): Map<string, T[]> {
  const byEngine = new Map<string, T[]>();
  for (const post of posts) {
    const id = postEngine(post.id);
    if (!id) continue;
    byEngine.set(id, [...(byEngine.get(id) ?? []), post]);
  }

  const byDate = (a: T, b: T) => b.data.publishedAt.getTime() - a.data.publishedAt.getTime();
  return new Map(
    [...byEngine.entries()]
      .filter(([, list]) => list.length >= ARCHIVE_MIN)
      .map(([id, list]) => [id, [...list].sort(byDate)]),
  );
}

/**
 * Posts to offer at the end of `post`: same engine first, newest first, topped
 * up with recent posts when that engine has too few to fill the block.
 *
 * Falling back matters — seven of the eighteen engines have four posts or fewer,
 * and a post with no engine at all (`counting-databases`) must still get a
 * block rather than an empty aside.
 */
export function relatedPosts<T extends Datable>(post: T, all: T[], limit = 4): T[] {
  const family = postEngine(post.id);
  const rest = all.filter((p) => p.id !== post.id);
  const byDate = (a: T, b: T) => b.data.publishedAt.getTime() - a.data.publishedAt.getTime();

  const sameEngine = family ? rest.filter((p) => postEngine(p.id) === family).sort(byDate) : [];
  if (sameEngine.length >= limit) return sameEngine.slice(0, limit);

  const seen = new Set(sameEngine.map((p) => p.id));
  const filler = rest.filter((p) => !seen.has(p.id)).sort(byDate);
  return [...sameEngine, ...filler].slice(0, limit);
}

/**
 * The previous and next post within the same engine, oldest → newest, so a
 * reader can walk one engine's posts in the order they were written. Falls back
 * to the whole blog for a post that belongs to no engine.
 */
export function postNeighbours<T extends Datable>(post: T, all: T[]): { prev?: T; next?: T } {
  const family = postEngine(post.id);
  const series = (family ? all.filter((p) => postEngine(p.id) === family) : [...all]).sort(
    (a, b) => a.data.publishedAt.getTime() - b.data.publishedAt.getTime(),
  );
  const i = series.findIndex((p) => p.id === post.id);
  if (i === -1) return {};
  return { prev: series[i - 1], next: series[i + 1] };
}
