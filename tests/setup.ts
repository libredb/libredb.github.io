import { existsSync } from 'node:fs';

/**
 * Loaded once per test process via `[test] preload` in bunfig.toml — the bun
 * equivalent of vitest's `globalSetup`. Without a build, the dist suite would
 * pass vacuously or fail confusingly, so fail here with the fix instead.
 */
const required = ['dist/index.html', 'dist/blog/index.html', 'dist/rss.xml', 'dist/sitemap-index.xml'];
const missing = required.filter((p) => !existsSync(p));
if (missing.length) {
  throw new Error(
    `Missing build output: ${missing.join(', ')}\nRun \`bun run build\` before \`bun test\` (\`bun run gate\` does both, in order).`,
  );
}
