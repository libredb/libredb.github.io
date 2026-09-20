import { describe, expect, it } from 'bun:test';
import { readFileSync, readdirSync } from 'node:fs';
import { canonicalUrl, pagePath, site } from '../src/lib/site';
import { redirectPaths } from '../src/data/redirects';

/**
 * `build.format: 'directory'` emits `/features/index.html`, so the host serves
 * `/features/` and answers `/features` with a 301. Every internal link written
 * without the slash therefore costs a redirect, and a canonical written without
 * it names the redirect instead of the page it is stamped on.
 *
 * The site shipped that way for months: links, canonicals, the RSS feed and the
 * sitemap disagreed three ways. The fix is `pagePath()`; these assert the built
 * output so a hand-written `href="/foo"` cannot quietly reintroduce it.
 */

const html: string[] = [];
const walk = (dir: string) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) walk(`${dir}/${entry.name}`);
    // Routes are directories with an index.html. Standalone artefacts under
    // /demo are shipped files, not pages: they carry no canonical and nothing
    // links to them as a route.
    else if (entry.name === 'index.html' || entry.name === '404.html') html.push(`${dir}/${entry.name}`);
  }
};
walk('dist');

/** A path that names a file is an asset, not a page: `/og/default.png/` is nothing. */
const isAsset = (p: string) => /\.[a-z0-9]+$/i.test(p);

describe('pagePath', () => {
  it('slashes page paths and leaves assets alone', () => {
    expect(pagePath('/features')).toBe('/features/');
    expect(pagePath('/features/')).toBe('/features/');
    expect(pagePath('features')).toBe('/features/');
    expect(pagePath('/')).toBe('/');
    expect(pagePath('')).toBe('/');
    expect(pagePath('/og/default.png')).toBe('/og/default.png');
    expect(pagePath('/docker-compose.example.yml')).toBe('/docker-compose.example.yml');
  });

  it('builds canonicals on the same rule', () => {
    expect(canonicalUrl('/features')).toBe(`${site.url}/features/`);
    expect(canonicalUrl('/')).toBe(`${site.url}/`);
    expect(canonicalUrl('/og/default.png')).toBe(`${site.url}/og/default.png`);
  });
});

describe('the built site agrees with the host it is served from', () => {
  it('ends every internal link with a slash', () => {
    const offenders: string[] = [];
    for (const file of html) {
      const doc = readFileSync(file, 'utf8');
      for (const [, href] of doc.matchAll(/href="(\/[^"#?]*)"/g)) {
        if (href === '/' || isAsset(href) || href.endsWith('/')) continue;
        offenders.push(`${file} → ${href}`);
      }
    }
    expect(offenders, 'these links cost a 301 each; wrap them in pagePath()').toEqual([]);
  });

  it('stamps each page with the canonical the host serves', () => {
    const offenders: string[] = [];
    for (const file of html) {
      // 404.html is served for paths that do not exist; it has no canonical URL.
      if (file.endsWith('404.html')) continue;
      // A tombstone's whole job is to point at the page that replaced it, so its
      // canonical names the destination rather than itself. That is deliberate —
      // see src/data/redirects.ts.
      const route = file.replace(/^dist/, '').replace(/\/index\.html$/, '') || '/';
      if (redirectPaths.includes(route)) continue;
      const doc = readFileSync(file, 'utf8');
      const canonical = /<link rel="canonical" href="([^"]+)"/.exec(doc)?.[1];
      const served = `${site.url}${file.replace(/^dist/, '').replace(/index\.html$/, '')}`;
      if (canonical !== served) offenders.push(`${file}: ${canonical} ≠ ${served}`);
    }
    expect(offenders, 'a canonical that differs from the served URL names a redirect').toEqual([]);
  });

  it('lists the same URLs in the sitemap that the pages call canonical', () => {
    const sitemap = readFileSync('dist/sitemap-0.xml', 'utf8');
    const listed = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    expect(listed.length).toBeGreaterThan(100);
    expect(listed.filter((u) => !u.endsWith('/'))).toEqual([]);
  });

  it('links to slashed post URLs from the feed', () => {
    const feed = readFileSync('dist/rss.xml', 'utf8');
    const links = [...feed.matchAll(/<item>[\s\S]*?<link>([^<]+)<\/link>/g)].map((m) => m[1]);
    expect(links.length).toBeGreaterThan(50);
    expect(links.filter((l) => !l.endsWith('/'))).toEqual([]);
  });
});
