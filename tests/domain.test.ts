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

  it('keeps every workflow on a Node version astro and lighthouse both accept', () => {
    // astro@7 needs >= 22.12, lighthouse@13 needs >= 22.19 — pin, do not drift on lts/*
    // Checked across all workflows, not just deploy.yml: the floor applies to
    // whichever one happens to run the build, and a new workflow is exactly
    // where a stale `lts/*` gets copied in from a template.
    for (const file of readdirSync('.github/workflows').filter((f) => f.endsWith('.yml'))) {
      const workflow = stripYaml(readFileSync(`.github/workflows/${file}`, 'utf8'));
      if (!workflow.includes('node-version:')) continue;
      expect(workflow, `${file} pins the wrong Node`).toMatch(/node-version:\s*'?24'?/);
      expect(workflow, `${file}: 'lts/*' drifts and can drop below the floor`).not.toContain('lts/*');
    }
  });
});

/**
 * Two deploys, two environments, and they must never fire on the same event.
 * The test site is a place to look at main before it ships; production is gated
 * on a published release. If a trigger leaked from one into the other, merging
 * a pull request would publish libredb.org — and nothing about the merge would
 * say so.
 */
describe('the test and production deploys stay separate', () => {
  const netlify = readFileSync('.github/workflows/deploy-test.yml', 'utf8');
  const pages = readFileSync('.github/workflows/deploy.yml', 'utf8');
  /** The `on:` block only, so a trigger word inside a comment is not a match. */
  const triggers = (src: string) => src.slice(src.indexOf('\non:')).split(/\njobs:/)[0];

  it('publishes production only from a released tag', () => {
    expect(triggers(pages), 'production must not deploy on a push').not.toMatch(/^\s*push:/m);
    expect(triggers(pages)).toMatch(/release:/);
  });

  it('publishes the test site only from main', () => {
    expect(triggers(netlify), 'the test site must not deploy on a release').not.toMatch(/release:/);
    expect(triggers(netlify)).toMatch(/branches:\s*\[main\]/);
  });

  it('sends the test deploy somewhere that is not the production host', () => {
    // Scoped to the deploy step, not the whole file. A misconfigured
    // NETLIFY_SITE_ID cannot be caught here, but a production host written into
    // the command can — while the header comment and the job summary both
    // mention libredb.org on purpose, to say what this workflow is NOT doing.
    const step = netlify.slice(netlify.indexOf('name: Deploy to Netlify'), netlify.indexOf('name: Deploy summary'));
    expect(step, 'the deploy command names the production domain').not.toContain(site.domain);
    expect(step, 'the deploy is not marked --prod on the test site').toContain('--prod');
  });

  it('reads the Netlify credentials from the environment, never from argv', () => {
    // A token passed as a flag is readable from the runner's process list.
    expect(netlify, 'the auth token is on a command line').not.toMatch(/--auth[= ]/);
    expect(netlify).toMatch(/NETLIFY_AUTH_TOKEN:\s*\$\{\{\s*secrets\.NETLIFY_AUTH_TOKEN\s*\}\}/);
  });
});
