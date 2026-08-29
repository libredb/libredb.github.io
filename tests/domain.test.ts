import { describe, expect, it } from 'bun:test';
import { readFileSync, readdirSync } from 'node:fs';
import site from '../site.config.json' with { type: 'json' };
import { redirectPaths } from '../src/data/redirects';

/** Assertions are about configuration, not the prose explaining it. */
const stripJs = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const stripYaml = (s: string) => s.replace(/^\s*#.*$/gm, '');

/**
 * The domain is repeated in astro.config, public/CNAME, robots.txt and every
 * canonical URL. Update one and forget another and the site still builds — it
 * just advertises the wrong canonical host, which is a silent SEO failure.
 * site.config.json is the single source; these assert the derivations.
 */
describe('the domain has one source of truth', () => {
  it('drives astro.config through site.config.json', () => {
    const config = stripJs(readFileSync('astro.config.mjs', 'utf8'));
    expect(config).toContain("import site from './site.config.json'");
    expect(config).toContain('site: site.url');
    expect(config, 'a hard-coded host would drift from site.config.json').not.toContain(site.domain);
  });

  it('matches public/CNAME', () => {
    expect(readFileSync('public/CNAME', 'utf8').trim()).toBe(site.domain);
  });

  it('points robots.txt at the sitemap on the same host', () => {
    expect(readFileSync('public/robots.txt', 'utf8')).toContain(`${site.url}/sitemap-index.xml`);
  });

  it('sets no `base` — a custom domain serves from the root', () => {
    // `base` is only for a GitHub *project* page (user.github.io/repo). Setting
    // it here would double-prefix every asset and route.
    const config = stripJs(readFileSync('astro.config.mjs', 'utf8'));
    expect(config).not.toMatch(/^\s*base:/m);
  });

  it('lists every shipped route in site.config.json', () => {
    // Read from dist rather than a second hand-kept list. The literal this
    // replaced had already fallen behind /privacy-policy, so the test passed
    // while the inventory it guards was wrong — which is the only thing the
    // inventory is for.
    const built: string[] = [];
    const walk = (dir: string, prefix = '') => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.isDirectory()) walk(`${dir}/${entry.name}`, `${prefix}/${entry.name}`);
        else if (entry.name === 'index.html') built.push(prefix || '/');
        else if (entry.name === '404.html') built.push('/404');
        else if (entry.name === 'rss.xml') built.push(`${prefix}/rss.xml`);
      }
    };
    walk('dist');

    // Blog posts are content, and the legacy stubs are tombstones — neither is
    // a route of the site, and neither belongs in an inventory of what the site
    // offers.
    const routes = built.filter((r) => !r.startsWith('/blog/') && !redirectPaths.includes(r));
    expect([...site.routes].sort()).toEqual(routes.sort());
  });

  it('keeps the deploy workflow on a Node version astro and lighthouse both accept', () => {
    // astro@7 needs >= 22.12, lighthouse@13 needs >= 22.19 — pin, do not drift on lts/*
    const workflow = stripYaml(readFileSync('.github/workflows/deploy.yml', 'utf8'));
    expect(workflow).toMatch(/node-version:\s*'?24'?/);
    expect(workflow, "'lts/*' drifts and can drop below the floor").not.toContain('lts/*');
  });
});
