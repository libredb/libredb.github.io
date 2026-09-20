import { describe, expect, it } from 'bun:test';
import { readFileSync, readdirSync } from 'node:fs';
import { buildSeo } from '../src/lib/seo';
import { site } from '../src/lib/site';
import { redirectPaths } from '../src/data/redirects';

/**
 * What a result listing has room for.
 *
 * Google renders roughly 60 characters of a title and 160 of a description.
 * Both were overrun sitewide — 96 of 146 titles and 23 descriptions — and in
 * each case the overrun came from a fixed cost rather than from the writing:
 * ` — LibreDB Studio` on every title, and a description doing double duty as
 * the lede printed on the page.
 *
 * Neither is solved by shortening the writing. The brand suffix is fitted to
 * what is left, and the description is trimmed for the tag only, at a sentence.
 */

const html: string[] = [];
const walk = (dir: string) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) walk(`${dir}/${entry.name}`);
    else if (entry.name === 'index.html') html.push(`${dir}/${entry.name}`);
  }
};
walk('dist');

const tag = (doc: string, re: RegExp) => re.exec(doc)?.[1];
const titleOf = (doc: string) => tag(doc, /<title>([^<]*)<\/title>/);
const descOf = (doc: string) => tag(doc, /<meta name="description" content="([^"]*)"/);

/** Entities are one rendered character each; counting the source overcounts. */
const rendered = (s: string) =>
  s
    .replace(/&mdash;/g, '—')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').length;

describe('the brand suffix is fitted, not fixed', () => {
  it('keeps the full name when the title leaves room', () => {
    expect(buildSeo({ path: '/x', title: 'Short one' }).title).toBe(`Short one — ${site.name}`);
  });

  it('falls back to the short name before dropping the brand', () => {
    const title = buildSeo({ path: '/x', title: 'A title of precisely fifty characters, give or ta' }).title;
    expect(title).toContain(site.shortName);
    expect(title).not.toContain(site.name);
    expect(title.length).toBeLessThanOrEqual(60);
  });

  it('drops the brand rather than the page’s own words', () => {
    const long = 'A headline that is already past what a result listing will ever render';
    expect(buildSeo({ path: '/x', title: long }).title).toBe(long);
  });

  it('lets a page title itself for the listing without changing its H1', () => {
    const seo = buildSeo({ path: '/x', title: 'The headline the page wants', seoTitle: 'The one search needs' });
    expect(seo.title).toContain('The one search needs');
    expect(seo.title).not.toContain('The headline the page wants');
  });
});

describe('the description is trimmed for the tag, not for the page', () => {
  it('leaves a description that already fits alone', () => {
    const short = 'Eighty characters is comfortably inside what a result listing will render.';
    expect(buildSeo({ path: '/x', description: short }).description).toBe(short);
  });

  it('stops at a sentence rather than mid-word', () => {
    const text =
      'The first sentence says the useful thing and stops well inside the budget. ' +
      'The second one exists only to push the whole string past what a listing renders.';
    const out = buildSeo({ path: '/x', description: text }).description;
    expect(out.length).toBeLessThanOrEqual(160);
    expect(out.endsWith('.')).toBe(true);
    expect(out).not.toContain('…');
  });

  it('ellipsises only when there is no sentence to stop at', () => {
    const out = buildSeo({ path: '/x', description: 'word '.repeat(60) }).description;
    expect(out.length).toBeLessThanOrEqual(160);
    expect(out.endsWith('…')).toBe(true);
  });

  it('accepts an override written for the listing', () => {
    const seo = buildSeo({ path: '/x', description: 'The lede.', seoDescription: 'The listing.' });
    expect(seo.description).toBe('The listing.');
  });
});

describe('every built page fits what a listing renders', () => {
  it('keeps titles inside the budget, or spends it on the page’s own words', () => {
    const over = html
      .map((f) => [f, titleOf(readFileSync(f, 'utf8')) ?? ''] as const)
      .filter(([, t]) => rendered(t) > 60);

    // A handful of editorial headlines are genuinely longer than 60 characters
    // with no brand attached. Those are a writing call, not a template one —
    // `seoTitle` is how a post makes it. This guards the template regressing.
    expect(over.length, 'the brand suffix is back on titles that cannot afford it').toBeLessThan(20);
    for (const [, t] of over) {
      expect(t, 'a long title is still paying for the brand').not.toContain(` — ${site.name}`);
      expect(t, 'a long title is still paying for the brand').not.toContain(` — ${site.shortName}`);
    }
  });

  it('keeps every description inside the budget', () => {
    const over = html
      .map((f) => [f, descOf(readFileSync(f, 'utf8')) ?? ''] as const)
      .filter(([, d]) => rendered(d) > 160);
    expect(over.map(([f]) => f)).toEqual([]);
  });

  it('gives every page a description worth showing', () => {
    for (const file of html) {
      // Tombstones are deliberately minimal: their whole body is a redirect.
      const route = file.replace(/^dist/, '').replace(/\/index\.html$/, '') || '/';
      if (redirectPaths.includes(route)) continue;
      const d = descOf(readFileSync(file, 'utf8')) ?? '';
      expect(rendered(d), `${file}: description too thin to be useful`).toBeGreaterThan(50);
    }
  });
});

describe('every article node names an author', () => {
  it('leaves none of them anonymous', () => {
    for (const file of html) {
      const doc = readFileSync(file, 'utf8');
      const blobs = [...doc.matchAll(/<script[^>]+ld\+json[^>]*>([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]!));
      for (const blob of blobs) {
        for (const node of blob['@graph'] ?? [blob]) {
          if (!['Article', 'TechArticle', 'BlogPosting'].includes(node['@type'])) continue;
          expect(node.author, `${file}: ${node['@type']} has no author`).toBeTruthy();
          expect(node.author.name, `${file}: author has no name`).toBeTruthy();
        }
      }
    }
  });
});
