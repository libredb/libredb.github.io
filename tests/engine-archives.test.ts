import { describe, expect, it } from 'bun:test';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { postEngine } from '../src/lib/posts';
import { engines } from '../src/data/engines';
import { site } from '../src/lib/site';

/**
 * The per-engine archives, and the cross-links that feed them.
 *
 * The blog groups by engine and always did, but nothing in the site said so:
 * the tag chips were `<span>`s, there was no page for "everything about
 * Postgres", and a post naming another engine in prose left it as plain text.
 * 104 deep posts sat in one flat list with no way in but the list itself.
 */

const POSTS = 'outstatic/content/posts';
/**
 * Published posts only. Both routes filter on `status`, and the schema allows
 * `draft`, so a fixture that counted every file on disk would turn the gate red
 * the moment an editor saved a draft, with nothing wrong in the built site.
 */
const postSlugs = readdirSync(POSTS)
  .filter((f) => f.endsWith('.md'))
  .filter((f) => /^status:\s*published\s*$/m.test(readFileSync(`${POSTS}/${f}`, 'utf8')))
  .map((f) => f.replace(/\.md$/, ''));

const archives = existsSync('dist/blog/engine')
  ? readdirSync('dist/blog/engine', { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
  : [];

const counts = new Map<string, number>();
for (const slug of postSlugs) {
  const id = postEngine(slug);
  if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
}

const html = (path: string) => readFileSync(path, 'utf8');
/** The rendered prose, between the body container and the table of contents. */
const prose = (doc: string) => {
  const start = doc.indexOf('post__body prose');
  const end = doc.indexOf('<nav class="toc"');
  return start < 0 ? '' : doc.slice(start, end > start ? end : undefined);
};

describe('an archive exists for each engine that has posts', () => {
  it('builds one page per engine with two or more posts, and no others', () => {
    const expected = [...counts.entries()]
      .filter(([, n]) => n >= 2)
      .map(([id]) => id)
      .sort();
    expect(archives.sort()).toEqual(expected);
  });

  it('never ships an archive for an engine with nothing to list', () => {
    // A page listing zero or one post is the post, not an archive of it.
    for (const id of archives) expect(counts.get(id) ?? 0, `${id} archive is thin`).toBeGreaterThanOrEqual(2);
  });

  it('lists every post of its engine, and only those', () => {
    for (const id of archives) {
      const doc = html(`dist/blog/engine/${id}/index.html`);
      const listed = [...doc.matchAll(/href="\/blog\/([a-z0-9-]+)\/"/g)].map((m) => m[1]!);
      const mine = postSlugs.filter((s) => postEngine(s) === id);
      for (const slug of mine) expect(listed, `${id} omits ${slug}`).toContain(slug);
      for (const slug of listed) expect(postEngine(slug), `${id} lists a foreign post`).toBe(id);
    }
  });

  it('carries a breadcrumb, a collection schema and a route into the product', () => {
    for (const id of archives) {
      const doc = html(`dist/blog/engine/${id}/index.html`);
      expect(doc, `${id}: no breadcrumb`).toContain('"BreadcrumbList"');
      expect(doc, `${id}: no CollectionPage`).toContain('"CollectionPage"');
      expect(doc, `${id}: does not link /databases`).toContain('href="/databases/"');
      expect(doc, `${id}: canonical`).toContain(`<link rel="canonical" href="${site.url}/blog/engine/${id}/"`);
    }
  });

  it('links its sibling archives so engines can be compared sideways', () => {
    for (const id of archives) {
      const doc = html(`dist/blog/engine/${id}/index.html`);
      const siblings = [...doc.matchAll(/href="\/blog\/engine\/([a-z0-9-]+)\/"/g)].map((m) => m[1]!);
      expect(siblings, `${id} links itself as a sibling`).not.toContain(id);
      // Every sibling offered must exist — a chip pointing at a 404 is worse
      // than no chip.
      for (const s of siblings) expect(archives, `${id} links a missing archive ${s}`).toContain(s);
      expect(new Set(siblings).size, `${id} offers no siblings`).toBeGreaterThan(5);
    }
  });
});

describe('the listing offers a way in other than scrolling', () => {
  it('indexes every archive from /blog, as links rather than a script', () => {
    const doc = html('dist/blog/index.html');
    const index = /<nav class="blog__engines"[\s\S]*?<\/nav>/.exec(doc)?.[0] ?? '';
    expect(index, '/blog has no engine index').not.toBe('');
    const linked = [...index.matchAll(/href="\/blog\/engine\/([a-z0-9-]+)\/"/g)].map((m) => m[1]!);
    expect(linked.sort()).toEqual([...archives].sort());
  });

  it('says how many posts each archive holds', () => {
    const doc = html('dist/blog/index.html');
    const index = /<nav class="blog__engines"[\s\S]*?<\/nav>/.exec(doc)?.[0] ?? '';
    for (const id of archives) {
      const count = counts.get(id)!;
      const entry = new RegExp(`href="/blog/engine/${id}/"[^>]*>[\\s\\S]{0,120}?>${count}<`);
      expect(entry.test(index), `${id} is listed without its count`).toBe(true);
    }
  });
});

describe('the engine chip is the one tag that navigates', () => {
  it('points every engine post at its archive', () => {
    for (const slug of postSlugs) {
      const id = postEngine(slug);
      if (!id || !archives.includes(id)) continue;
      const doc = html(`dist/blog/${slug}/index.html`);
      expect(doc, `${slug}: engine chip missing`).toContain(`href="/blog/engine/${id}/"`);
    }
  });

  it('leaves the declared tags as plain text', () => {
    // "Engineering" is on all 104 posts and "Databases" on all but four: a link
    // on either leads to a page that duplicates /blog instead of narrowing it.
    const doc = html('dist/blog/postgresql-explain-analyze-executes/index.html');
    expect(doc).toMatch(/<span class="post__tag"[^>]*>Engineering<\/span>/);
    expect(doc).toMatch(/<a class="post__tag post__tag--engine"/);
  });
});

describe('prose names other engines as links, not as plain text', () => {
  it('cross-links a useful share of the blog', () => {
    const linked = postSlugs.filter((slug) =>
      /href="\/blog\/engine\//.test(prose(html(`dist/blog/${slug}/index.html`))),
    );
    expect(linked.length, 'in-body engine cross-links disappeared').toBeGreaterThan(50);
  });

  it('never links a post to its own engine', () => {
    for (const slug of postSlugs) {
      const own = postEngine(slug);
      if (!own) continue;
      const body = prose(html(`dist/blog/${slug}/index.html`));
      expect(body, `${slug} links its own archive mid-prose`).not.toContain(`href="/blog/engine/${own}/"`);
    }
  });

  it('keeps the linking sparse enough to read', () => {
    // Three per post is the cap the cross-linker applies; a body full of chips
    // reads as keyword stuffing and dilutes every link on the page.
    for (const slug of postSlugs) {
      const body = prose(html(`dist/blog/${slug}/index.html`));
      const n = [...body.matchAll(/href="\/blog\/engine\//g)].length;
      expect(n, `${slug} carries ${n} engine links in prose`).toBeLessThanOrEqual(3);
    }
  });

  it('leaves the product name alone', () => {
    // "LibreDB" in prose almost always means LibreDB Studio, not the embedded
    // database of the same name, so it is excluded from cross-linking.
    for (const slug of postSlugs) {
      const body = prose(html(`dist/blog/${slug}/index.html`));
      expect(body, `${slug} links the brand name to the engine archive`).not.toContain('href="/blog/engine/libredb/"');
    }
  });

  it('never links inside code, headings or quotations', () => {
    for (const slug of postSlugs) {
      const doc = html(`dist/blog/${slug}/index.html`);
      for (const re of [
        /<pre[\s\S]*?<\/pre>/g,
        /<h[1-6][^>]*>[\s\S]*?<\/h[1-6]>/g,
        /<blockquote[\s\S]*?<\/blockquote>/g,
      ]) {
        for (const [fragment] of doc.matchAll(re)) {
          expect(fragment, `${slug}: a link was injected where it does not belong`).not.toContain('/blog/engine/');
        }
      }
    }
  });

  it('names an engine that exists for every archive link it emits', () => {
    const ids = new Set(engines.map((e) => e.id));
    for (const slug of postSlugs) {
      const body = prose(html(`dist/blog/${slug}/index.html`));
      for (const [, id] of body.matchAll(/href="\/blog\/engine\/([a-z0-9-]+)\/"/g)) {
        expect(ids, `${slug} links unknown engine ${id}`).toContain(id!);
        expect(archives, `${slug} links archive-less engine ${id}`).toContain(id!);
      }
    }
  });
});

/**
 * Each archive's feed.
 *
 * The site feed carries all 104 posts, so an aggregator that wants one engine
 * has to filter downstream, and ours does: Planet for the MySQL Community runs
 * our entry through siftrss on a title regex, which drops the posts whose title
 * does not name the engine. These feeds are the fix, and nothing else in the
 * suite touches them: domain.test.ts collects rss.xml files but then drops
 * everything under /blog/, so all seventeen could stop building and the gate
 * would stay green.
 */
describe('each engine archive ships a feed of its own', () => {
  const feedPath = (id: string) => `dist/blog/engine/${id}/rss.xml`;
  // Read both sides off disk rather than filtering one out of the other, or a
  // feed with no archive page behind it is invisible to the comparison.
  const pages = archives.filter((id) => existsSync(`dist/blog/engine/${id}/index.html`));
  const feeds = archives.filter((id) => existsSync(feedPath(id)));

  it('pairs one feed with one archive, in both directions', () => {
    expect(feeds.length, 'no feeds were built').toBeGreaterThan(0);
    expect(feeds.sort()).toEqual([...pages].sort());
  });

  it('keeps serving the feed an aggregator already subscribed to', () => {
    // planet.oursqlcommunity.org holds /blog/engine/mysql/rss.xml as a URL in
    // its own configuration. The archive threshold would withdraw that address
    // without a redirect if MySQL ever fell to a single published post.
    expect(feeds, 'the MySQL feed is a published address now').toContain('mysql');
  });

  it('carries every post of that engine and no other', () => {
    for (const id of archives) {
      const xml = readFileSync(feedPath(id), 'utf8');
      const links = [...xml.matchAll(/<link>([^<]+)<\/link>/g)]
        .map((m) => m[1])
        .filter((href) => href.includes('/blog/') && !href.endsWith(`/blog/engine/${id}/`));

      expect(links.length, `${id}: item count`).toBe(counts.get(id)!);
      for (const href of links) {
        const slug = href.replace(/^.*\/blog\//, '').replace(/\/$/, '');
        expect(postEngine(slug), `${id}: ${slug} belongs to another engine`).toBe(id);
      }
    }
  });

  it('names the engine as the first category, which is what an aggregator filters on', () => {
    for (const id of archives) {
      const xml = readFileSync(feedPath(id), 'utf8');
      const name = engines.find((e) => e.id === id)!.name;
      const items = xml.split('<item>').slice(1);
      expect(items.length, `${id}: no items`).toBeGreaterThan(0);
      for (const item of items) {
        const first = item.match(/<category>(?:<!\[CDATA\[)?([^<\]]+)/);
        expect(first?.[1], `${id}: first category`).toBe(name);
      }
    }
  });

  it('points back at the archive it was cut from, not the home page', () => {
    for (const id of archives) {
      const xml = readFileSync(feedPath(id), 'utf8');
      const channelLink = xml.match(/<channel>[\s\S]*?<link>([^<]+)<\/link>/)?.[1];
      expect(channelLink, `${id}: channel link`).toBe(`${site.url}/blog/engine/${id}/`);
    }
  });

  it('is the feed the archive page advertises, so a reader subscribes to what they clicked', () => {
    for (const id of archives) {
      const doc = html(`dist/blog/engine/${id}/index.html`);
      const alternate = doc.match(/<link rel="alternate" type="application\/rss\+xml"[^>]*>/)?.[0] ?? '';
      expect(alternate, `${id}: alternate href`).toContain(`/blog/engine/${id}/rss.xml`);
      expect(doc, `${id}: visible feed link`).toContain(`href="/blog/engine/${id}/rss.xml"`);
      // The engine feed is listed first, but the site feed stays discoverable:
      // replacing it would hide the whole blog from a reader on this page.
      expect(doc, `${id}: site feed still advertised`).toContain(`href="${site.url}/rss.xml"`);
    }
  });
});
