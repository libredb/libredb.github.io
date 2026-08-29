import { describe, expect, it } from 'bun:test';
import { readFileSync, readdirSync } from 'node:fs';
import { z } from 'astro/zod';

/**
 * The schema is duplicated here from src/content.config.ts on purpose: importing
 * it would pull in `astro:content`, which only exists inside a build. The shape
 * guard at the bottom fails if the two drift.
 */
const text = (fallback = '') => z.preprocess((v) => (v === null || v === undefined ? fallback : v), z.string());
const list = <T extends z.ZodType>(item: T) =>
  z.preprocess((v) => (v === null || v === undefined || v === '' ? [] : v), z.array(item));
const tag = z.object({ value: z.string(), label: z.string() });

const schema = z.looseObject({
  title: text(),
  status: z.enum(['published', 'draft']),
  slug: text(),
  publishedAt: z.coerce.date(),
  author: z
    .preprocess(
      (v) => (v === null || v === undefined || v === '' ? {} : v),
      z.looseObject({ name: text(), picture: text() }),
    )
    .default({ name: '', picture: '' }),
  description: text(),
  coverImage: text(),
  tags: list(tag).default([]),
});

const base = {
  title: 'Hello',
  status: 'published',
  slug: 'hello',
  publishedAt: new Date('2026-08-29T10:00:00.000Z'),
  description: 'A description.',
};

describe('Outstatic frontmatter tolerance (PITFALLS A2)', () => {
  it('accepts the payload Outstatic writes for a fully filled document', () => {
    expect(() =>
      schema.parse({
        ...base,
        author: { name: 'LibreDB', picture: 'https://example.test/a.png' },
        coverImage: '/images/x.png',
        tags: [{ value: 'engineering', label: 'Engineering' }],
      }),
    ).not.toThrow();
  });

  it('accepts EMPTY STRING for fields the editor typed into and then cleared', () => {
    const out = schema.parse({
      ...base,
      author: { name: '', picture: '' },
      coverImage: '',
      description: '',
      tags: '',
    });
    expect(out.coverImage).toBe('');
    expect(out.tags).toEqual([]);
  });

  it('accepts literal null, which the YAML writer can emit', () => {
    const out = schema.parse({
      ...base,
      author: null,
      coverImage: null,
      description: null,
      tags: null,
    });
    expect(out.author).toEqual({ name: '', picture: '' });
    expect(out.tags).toEqual([]);
    expect(out.coverImage).toBe('');
  });

  it('accepts ABSENT keys for fields the editor never touched', () => {
    const out = schema.parse(base);
    expect(out.tags).toEqual([]);
    expect(out.author.name).toBe('');
  });

  it('coerces the unquoted ISO timestamp the CMS writes into a Date', () => {
    const out = schema.parse({ ...base, publishedAt: '2026-08-29T10:00:00.000Z' });
    expect(out.publishedAt).toBeInstanceOf(Date);
    expect(out.publishedAt.getUTCFullYear()).toBe(2026);
  });

  it('still rejects genuinely broken content', () => {
    expect(() => schema.parse({ ...base, status: 'archived' })).toThrow();
    expect(() => schema.parse({ ...base, publishedAt: 'not-a-date' })).toThrow();
  });

  it('uses no bare .optional() in the real schema, which only accepts undefined', () => {
    const src = readFileSync('src/content.config.ts', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    expect(src, 'a bare .optional() re-opens the empty-string failure mode').not.toMatch(/\.optional\(\)/);
  });

  it('keeps this fixture schema in step with src/content.config.ts', () => {
    const src = readFileSync('src/content.config.ts', 'utf8');
    const keys = ['title', 'status', 'slug', 'publishedAt', 'author', 'description', 'coverImage', 'tags'];
    for (const key of keys) {
      expect(src, key + ' missing from the real schema').toMatch(new RegExp('\\b' + key + ':'));
    }
  });
});

describe('content integrity', () => {
  const dir = 'outstatic/content/posts';
  const files = readdirSync(dir).filter((f) => f.endsWith('.md'));

  it('has seed content', () => {
    expect(files.length).toBeGreaterThanOrEqual(2);
  });

  it('loses no frontmatter key to silent schema stripping (PITFALLS D1)', () => {
    const known = new Set([
      'title',
      'status',
      'author',
      'slug',
      'description',
      'coverImage',
      'tags',
      'publishedAt',
      'name',
      'picture',
      'value',
      'label',
    ]);
    for (const file of files) {
      const raw = readFileSync(dir + '/' + file, 'utf8');
      const front = raw.split('---')[1] ?? '';
      const declared = [...front.matchAll(/^\s*-?\s*([a-zA-Z][\w]*):/gm)].map((m) => m[1]);
      const unknown = declared.filter((k) => !known.has(k));
      expect(unknown, file + ' declares keys the schema does not read').toEqual([]);
    }
  });

  it('carries no mojibake from a broken bulk edit (PITFALLS E4)', () => {
    // UTF-8 decoded as Latin-1 leaves a C3/C4/C5 lead byte followed by an 80-BF byte
    const suspicious = /[ÃÄÅ][-¿]/;
    for (const file of files) {
      const raw = readFileSync(dir + '/' + file, 'utf8');
      expect(suspicious.test(raw), file + ' looks mis-encoded').toBe(false);
    }
  });

  it('publishes English only', () => {
    // The site declares one language on <html> and offers the editor no language
    // field, so a post in another language would be read out in an English voice
    // and hyphenated by English rules. The check is on the title and description
    // because those are what leave the page — cards, RSS, search results.
    const turkish = /[\u011f\u011e\u0131\u0130\u015f\u015e\u00e7\u00c7\u00f6\u00d6\u00fc\u00dc]/;
    for (const file of files) {
      const front = readFileSync(dir + '/' + file, 'utf8').split('---')[1] ?? '';
      if (!/^status: published$/m.test(front)) continue;
      for (const key of ['title', 'description']) {
        const value = new RegExp('^' + key + ': (.*)$', 'm').exec(front)?.[1] ?? '';
        expect(turkish.test(value), `${file}: ${key} is not English`).toBe(false);
      }
    }
  });

  it('declares no per-post language, in any post', () => {
    // Outstatic keeps writing whatever the collection schema offers. A `lang:`
    // reappearing here means the Select came back in schema.json.
    for (const file of files) {
      expect(readFileSync(dir + '/' + file, 'utf8'), `${file} still carries a lang key`).not.toMatch(/^lang:/m);
    }
  });
});
