import config from '../../site.config.json' with { type: 'json' };

export const site = config;

/**
 * A site-relative path in the form the static host actually serves.
 *
 * `build.format: 'directory'` emits `/features/index.html`, so GitHub Pages
 * serves `/features/` and answers `/features` with a 301 to it. A link or a
 * canonical written without the slash therefore points at a redirect rather
 * than at the page — the crawler spends two requests per link and the
 * canonical disagrees with the URL it is stamped on.
 *
 * Assets are left alone: `/og/default.png/` is not a file.
 */
export function pagePath(path: string): string {
  const clean = `/${path.replace(/^\/+/, '')}`.replace(/\/+$/, '');
  if (clean === '') return '/';
  return /\.[a-z0-9]+$/i.test(clean) ? clean : `${clean}/`;
}

/** Absolute canonical URL for a site-relative path, slashed as {@link pagePath}. */
export function canonicalUrl(path: string): string {
  const base = config.url.replace(/\/+$/, '');
  return `${base}${pagePath(path)}`;
}
