// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import site from './site.config.json' with { type: 'json' };

// Custom domain (libredb.org) => the site is served from the root, so `base`
// stays at its default. Setting it would double-prefix every asset and route;
// `base` is only for a GitHub *project* page (user.github.io/repo).
export default defineConfig({
  site: site.url,
  output: 'static',
  trailingSlash: 'ignore',

  // Astro 7 defaults compressHTML to 'jsx', which strips newline-containing
  // whitespace between inline elements. That silently welded the hero headline
  // into "Youcreatedthedatabase." — see tests/dist-smoke.test.ts.
  compressHTML: true,

  // one shared, cacheable stylesheet beats re-inlining ~100KB on every page
  build: { format: 'directory', inlineStylesheets: 'never' },
  prefetch: { prefetchAll: true, defaultStrategy: 'hover' },

  integrations: [sitemap({ filter: (page) => !page.includes('/404') })],

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
