import { describe, expect, it } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { redirects } from '../src/data/redirects';
import site from '../site.config.json' with { type: 'json' };

/**
 * Every route the previous libredb.org served, as it stood on the day of the
 * redesign cutover. Transcribed from that site's src/data/sections.ts, plus the
 * two routes it had outside the section manifest.
 *
 * This is a historical record, so it is a literal and it does not change. It is
 * the one list that cannot be derived: the old repository is a backup folder
 * today and will not be one forever.
 */
const OLD_ROUTES = [
  '/',
  '/manifesto',
  '/features',
  '/providers',
  '/database',
  '/database-architecture',
  '/database-reliability',
  '/playground',
  '/compare',
  '/tech-stack',
  '/get-started',
  '/faq',
  '/security',
  '/support',
  '/deploy',
  '/docker-compose-example',
  '/platform',
  '/databases',
  '/privacy-policy',
] as const;

const stub = (from: string) => readFileSync(`dist${from}/index.html`, 'utf8');

describe('retired URLs', () => {
  it('accounts for every route the old site served', () => {
    // The point of the redesign is not to silently drop pages. A URL from the
    // old site is either still a route here, or it has a tombstone — there is
    // no third option that is not a 404 for someone who bookmarked it.
    const kept = new Set<string>(site.routes);
    const moved = new Set(redirects.map((r) => r.from));
    const orphaned = OLD_ROUTES.filter((r) => !kept.has(r) && !moved.has(r));
    expect(orphaned, 'these old URLs would 404 after the cutover').toEqual([]);
  });

  it('redirects nothing that is still a route', () => {
    // A stub at a live path would shadow the real page, or lose to it, and
    // which of the two happens is a build-order detail nobody should rely on.
    for (const r of redirects) {
      expect(site.routes, `${r.from} is both a route and a redirect`).not.toContain(r.from);
    }
  });

  it('sends every visitor somewhere that exists', () => {
    for (const r of redirects) {
      const path = r.to.split('#')[0];
      expect(
        existsSync(`dist${path === '/' ? '' : path}/index.html`),
        `${r.from} points at ${r.to}, which is not built`,
      ).toBe(true);
    }
  });

  it('lands on the anchor it promises', () => {
    // A fragment that no longer exists in the target is worse than no fragment:
    // the visitor is dropped at the top of a long page believing they were
    // taken to the part they asked for.
    for (const r of redirects.filter((x) => x.to.includes('#'))) {
      const [path, id] = r.to.split('#');
      const html = readFileSync(`dist${path === '/' ? '' : path}/index.html`, 'utf8');
      expect(html, `${r.to} has no #${id} to land on`).toMatch(new RegExp(`id="${id}"`));
    }
  });

  it('gives the crawler a fragment-free canonical that is a real page', () => {
    for (const r of redirects) {
      expect(r.canonical, `${r.from}: a canonical with a fragment is not a distinct URL`).not.toContain('#');
      expect(site.routes, `${r.from}: canonical ${r.canonical} is not a route`).toContain(r.canonical);
    }
  });

  it('carries all three redirect signals, and nothing else', () => {
    for (const r of redirects) {
      const html = stub(r.from);
      expect(html, `${r.from}: no instant meta refresh`).toContain(`content="0; url=${r.to}"`);
      expect(html, `${r.from}: no location.replace`).toContain(`location.replace(${JSON.stringify(r.to)})`);
      expect(html, `${r.from}: no canonical`).toContain(`rel="canonical"`);
      // A subresource on a page that exists for one frame delays the redirect
      // it is part of. This is what moving off a .astro page bought.
      expect(html, `${r.from}: pulls in a stylesheet`).not.toContain('rel="stylesheet"');
      expect(html, `${r.from}: pulls in a script file`).not.toContain('<script src');
      expect(html.length, `${r.from}: grew past a kilobyte`).toBeLessThan(1024);
    }
  });

  it('keeps tombstones out of the sitemap', () => {
    // Submitting a redirect asks Google to index it, which it reports back as
    // a "Page with redirect" error — and it contradicts the stub's own canonical.
    // Compared as whole <loc> values, not substrings: /database is a prefix of
    // /databases, and a substring check calls the live page a tombstone.
    const locs = [...readFileSync('dist/sitemap-0.xml', 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) =>
      m[1].replace(/\/$/, ''),
    );
    for (const r of redirects) {
      expect(locs, `${r.from} is in the sitemap`).not.toContain(`${site.url}${r.from}`);
    }
  });

  it('is reachable by a visitor whose browser ran neither the refresh nor the script', () => {
    for (const r of redirects) {
      expect(stub(r.from), `${r.from}: no clickable fallback`).toContain(`<a href="${r.to}">`);
    }
  });
});
