// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import site from './site.config.json' with { type: 'json' };
import { redirectPaths } from './src/data/redirects.ts';
import { postEngine } from './src/lib/posts.ts';
import { readFileSync, readdirSync } from 'node:fs';

// Read from the posts themselves rather than a generated list: a second copy of
// this mapping is exactly the drift CLAUDE.md warns about. `updatedAt` wins when
// a post declares one, otherwise the publication date is the last time it
// changed.
const POSTS = './outstatic/content/posts';
const postDates = Object.fromEntries(
  readdirSync(POSTS)
    .filter((f) => f.endsWith('.md'))
    .map((f) => {
      const front = readFileSync(`${POSTS}/${f}`, 'utf8').split('---')[1] ?? '';
      const pick = (key) => new RegExp(`^${key}:\\s*['"]?([0-9T:.Z+-]+)`, 'm').exec(front)?.[1];
      return [f.replace(/\.md$/, ''), pick('updatedAt') ?? pick('publishedAt')];
    })
    .filter(([, date]) => Boolean(date)),
);

// Custom domain (libredb.org) => the site is served from the root, so `base`
// stays at its default. Setting it would double-prefix every asset and route;
// `base` is only for a GitHub *project* page (user.github.io/repo).
export default defineConfig({
  site: site.url,
  output: 'static',

  // 'ignore' let links, canonicals and the sitemap disagree: the build emits
  // directories, so the host serves `/features/` and 301s `/features` to it.
  // Every internal link spent a redirect and every canonical pointed at one.
  // 'always' makes the dev server agree with the deployed host, and
  // `pagePath()` in src/lib/site.ts is what writes the slash into links.
  trailingSlash: 'always',

  // Astro 7 defaults compressHTML to 'jsx', which strips newline-containing
  // whitespace between inline elements. That silently welded the hero headline
  // into "Youcreatedthedatabase." — see tests/dist-smoke.test.ts.
  compressHTML: true,

  // one shared, cacheable stylesheet beats re-inlining ~100KB on every page
  build: { format: 'directory', inlineStylesheets: 'never' },
  prefetch: { prefetchAll: true, defaultStrategy: 'hover' },

  // A retired URL must stay out of the sitemap. Submitting a page whose only
  // job is to send the crawler somewhere else asks Google to index a redirect,
  // which it reports back as a "Page with redirect" error — and it contradicts
  // the canonical the stub itself carries.
  integrations: [
    sitemap({
      filter: (page) =>
        !page.includes('/404') && !redirectPaths.some((p) => new URL(page).pathname.replace(/\/$/, '') === p),

      // lastmod only where a date is actually known — the posts' own front
      // matter. Stamping every URL with the build date would tell Google the
      // whole site changed on every deploy, which is the fastest way to have
      // the signal ignored. Marketing pages carry no date and get none.
      serialize: (item) => {
        const path = new URL(item.url).pathname;

        // An engine archive is as fresh as its newest post: it changes when one
        // is published and at no other time.
        const engine = /^\/blog\/engine\/([^/]+)\/?$/.exec(path)?.[1];
        if (engine) {
          // `postEngine` is the one place that reads an engine out of a slug;
          // re-deriving it here is the drift this file already warns about, and
          // it would miss the longest-match rule that keeps `sqlite` from
          // claiming a `sqlserver-` post.
          const dates = Object.entries(postDates)
            .filter(([slug]) => postEngine(slug) === engine)
            .map(([, d]) => d)
            .sort();
          const newest = dates.at(-1);
          return newest ? { ...item, lastmod: newest } : item;
        }

        const slug = /^\/blog\/([^/]+)\/?$/.exec(path)?.[1];
        const date = slug ? postDates[slug] : undefined;
        return date ? { ...item, lastmod: date } : item;
      },
    }),
  ],

  vite: {
    build: {
      cssMinify: 'lightningcss',
      // Never base64 a webfont into the render-blocking stylesheet: the default
      // limit inlined ~70KB of woff2 and tripled the critical CSS.
      // `false` = never inline this file; `undefined` = fall back to the
      // default size heuristic for everything else.
      assetsInlineLimit: (filePath) => (/\.(woff2?|ttf|otf|eot)$/i.test(filePath) ? false : undefined),
    },
  },
});
