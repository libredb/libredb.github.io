import { describe, expect, it } from 'bun:test';
import { spawnSync } from 'bun';
import { existsSync, readFileSync } from 'node:fs';
import site from '../site.config.json' with { type: 'json' };

const json = (p: string) => JSON.parse(readFileSync(p, 'utf8'));

describe('Outstatic wiring', () => {
  it('writes content where Astro reads it', () => {
    const config = readFileSync('src/content.config.ts', 'utf8');
    expect(site.cms.contentPath).toBe('outstatic/content');
    expect(config, 'the glob base must point at the collection folder').toContain(
      `base: './${site.cms.contentPath}/posts'`,
    );
  });

  it('scopes the glob to the posts folder so sidecar JSON never leaks in', () => {
    // globbing outstatic/content/**/*.md would swallow _singletons/*.md too
    const config = readFileSync('src/content.config.ts', 'utf8');
    expect(config).not.toMatch(/base:\s*'\.\/outstatic\/content'/);
    expect(config).toContain("pattern: '**/*.md'");
  });

  it('never starts the glob pattern with ../ or / — astro throws on both', () => {
    const config = readFileSync('src/content.config.ts', 'utf8');
    const patterns = [...config.matchAll(/pattern:\s*'([^']+)'/g)].map((m) => m[1]);
    expect(patterns.length).toBeGreaterThan(0);
    for (const p of patterns) {
      expect(p.startsWith('../'), `pattern "${p}"`).toBe(false);
      expect(p.startsWith('/'), `pattern "${p}"`).toBe(false);
    }
  });

  it('pins the markdown extension so a surprise .mdx cannot slip past the glob', () => {
    expect(json('outstatic/config.json').mdExtension).toBe('md');
  });

  it('pre-answers the media dialog — without it the editor refuses to save an image', () => {
    const config = json('outstatic/config.json');
    expect(config.repoMediaPath, 'legacy media paths are validated to end with /').toMatch(/\/$/);
    expect(config.publicMediaPath).toMatch(/\/$/);
    expect(existsSync('public/images'), 'the repo media path must exist').toBe(true);
  });

  it('declares the posts collection at the path Outstatic expects', () => {
    const [collection] = json('outstatic/content/collections.json');
    expect(collection.slug).toBe('posts');
    expect(collection.path).toBe(`${site.cms.contentPath}/posts`);
    expect(collection.parent).toBeNull();
  });

  it('defines every non-built-in field the Astro schema requires', () => {
    // description / coverImage / tags are NOT built in — a fresh collection ships
    // `properties: {}` and the editor would never be shown them.
    const props = json('outstatic/content/posts/schema.json').properties;
    for (const key of ['description', 'coverImage', 'tags']) {
      expect(props[key], `${key} is missing from the collection schema`).toBeTruthy();
      expect(props[key].fieldType).toBeTruthy();
      expect(props[key].dataType).toBeTruthy();
    }
  });

  it('offers the editor no language field — the site is English only', () => {
    // A Select left in the collection would keep writing `lang:` into new posts,
    // which the Astro schema no longer knows about and nothing would render.
    expect(json('outstatic/content/posts/schema.json').properties.lang).toBeUndefined();
  });

  it('keeps the CMS app out of the Astro typecheck', () => {
    expect(JSON.parse(readFileSync('tsconfig.json', 'utf8')).exclude).toContain('cms');
  });

  it('never commits CMS credentials', () => {
    const ignore = readFileSync('.gitignore', 'utf8');
    expect(ignore).toContain('cms/.env.local');
    // The question is whether git TRACKS the file, not whether it exists on
    // disk. Anyone who actually runs the dashboard has a filled-in local copy —
    // an existsSync() check here fails the gate for exactly the person the CMS
    // was built for, which is what it did.
    const tracked = spawnSync(['git', 'ls-files', '--', 'cms/.env.local']).stdout.toString().trim();
    expect(tracked, 'a real .env.local must never be committed').toBe('');
    expect(existsSync('cms/.env.local.example'), 'ship the template instead').toBe(true);
  });

  it('documents every OST_* variable the app needs', () => {
    const example = readFileSync('cms/.env.local.example', 'utf8');
    for (const key of [
      'OST_GITHUB_ID',
      'OST_GITHUB_SECRET',
      'OST_REPO_OWNER',
      'OST_REPO_SLUG',
      'OST_REPO_BRANCH',
      'OST_CONTENT_PATH',
      'OST_REPO_MEDIA_PATH',
      'OST_PUBLIC_MEDIA_PATH',
    ]) {
      expect(example, `${key} is undocumented`).toContain(key);
    }
    // a prefix prepended to EVERY repo path; setting it would move content into cms/
    expect(example).toMatch(/^#\s*OST_MONOREPO_PATH/m);
  });

  it('points the CMS at the same repo and branch the site config names', () => {
    const example = readFileSync('cms/.env.local.example', 'utf8');
    expect(example).toContain(`OST_REPO_OWNER=${site.repo.owner}`);
    expect(example).toContain(`OST_REPO_SLUG=${site.repo.site}`);
    expect(example).toContain(`OST_REPO_BRANCH=${site.repo.branch}`);
    expect(example).toContain(`OST_CONTENT_PATH=${site.cms.contentPath}`);
  });
});
