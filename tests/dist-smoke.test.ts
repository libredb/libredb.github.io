import { beforeAll, describe, expect, it } from 'bun:test';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { parseHTML } from 'linkedom';
import site from '../site.config.json' with { type: 'json' };
import { engines } from '../src/data/engines';

const page = (path: string) => parseHTML(readFileSync(path, 'utf8')).document;

/** Every stylesheet the homepage links, concatenated. Astro splits them per
 *  component, so which chunk the hero lands in is not something to assert on. */
const styles = () => {
  const hrefs = [...page('dist/index.html').querySelectorAll('link[rel="stylesheet"]')]
    .map((l) => l.getAttribute('href') ?? '')
    .filter((h) => h.startsWith('/_astro/'));
  if (!hrefs.length) throw new Error('no built stylesheet linked from dist/index.html');
  return hrefs.map((h) => readFileSync(`dist${h}`, 'utf8')).join('\n');
};

let home: Document;
let blog: Document;
let post: Document;

beforeAll(() => {
  home = page('dist/index.html') as unknown as Document;
  blog = page('dist/blog/index.html') as unknown as Document;
  post = page('dist/blog/the-tool-goes-to-the-data/index.html') as unknown as Document;
});

describe('landmarks and document shape', () => {
  it('gives every page one main, one header and one footer', () => {
    for (const [name, doc] of [
      ['home', home],
      ['blog', blog],
      ['post', post],
    ] as const) {
      expect(doc.querySelectorAll('main').length, `${name}: main`).toBe(1);
      expect(doc.querySelectorAll('header.hdr').length, `${name}: header`).toBe(1);
      expect(doc.querySelectorAll('footer').length, `${name}: footer`).toBe(1);
      expect(doc.querySelectorAll('h1').length, `${name}: exactly one h1`).toBe(1);
    }
  });

  it('opens with a skip link that targets #main', () => {
    const skip = home.querySelector('a.u-skip-link');
    expect(skip?.getAttribute('href')).toBe('#main');
    expect(home.querySelector('#main')).toBeTruthy();
  });

  it('declares one language, on every page', () => {
    // The site is English only. `lang` is set once, on <html>, and nothing below
    // it overrides — a stray lang="tr" would hand a screen reader a Turkish
    // voice for English copy, and turn text-transform:uppercase "Light" into
    // "LIGHT" with a dotted capital I.
    for (const [name, doc] of [
      ['home', home],
      ['blog', blog],
      ['post', post],
    ] as const) {
      expect(doc.documentElement.getAttribute('lang'), `${name}: html lang`).toBe('en');
      const overrides = [...doc.querySelectorAll('[lang]')]
        .filter((el) => el.tagName.toLowerCase() !== 'html')
        .map((el) => el.getAttribute('lang'));
      expect(overrides, `${name}: nothing below <html> declares its own language`).toEqual([]);
    }
  });
});

describe('the CSS that JS behaviour depends on', () => {
  const css = () =>
    readdirSync('dist/_astro')
      .filter((f) => f.endsWith('.css'))
      .map((f) => readFileSync(`dist/_astro/${f}`, 'utf8'))
      .join('\n');

  it('forces [hidden] to win over component display rules', () => {
    // every panel toggle sets el.hidden; the UA rule loses to any display:flex
    expect(css()).toMatch(/\[hidden\]\s*\{\s*display:\s*none\s*!important/);
  });

  it('ships no empty stylesheet — an unparsable file silently drops a component', () => {
    for (const f of readdirSync('dist/_astro').filter((n) => n.endsWith('.css'))) {
      expect(readFileSync(`dist/_astro/${f}`, 'utf8').trim().length, f).toBeGreaterThan(0);
    }
  });
});

describe('the hero headline survives HTML compression', () => {
  it('keeps the spaces between the animated words', () => {
    const h1 = home.querySelector('.hero__title');
    expect(h1?.textContent?.replace(/\s+/g, ' ').trim()).toBe(
      'You created the database. The editor is already beside it.',
    );
  });

  it('wraps each word so the lbWord stagger has something to animate', () => {
    expect(home.querySelectorAll('.hero__title span').length).toBe(10);
  });
});

describe('assets are self-hosted', () => {
  it('hot-links no third-party CDN for logos, fonts or styles', () => {
    for (const doc of [home, blog, post]) {
      const html = doc.documentElement.outerHTML;
      for (const cdn of ['cdn.jsdelivr.net', 'cdn.simpleicons.org', 'fonts.googleapis.com', 'fonts.gstatic.com']) {
        expect(html, `${cdn} is still referenced`).not.toContain(cdn);
      }
    }
  });

  it('serves a mark from /engines/ for every engine, and nothing extra', () => {
    const marks = readdirSync('dist/engines').filter((f) => f.endsWith('.svg'));
    // Derived, not pinned: this broke when LibreDB became the seventeenth engine
    // and the literal here still said sixteen.
    expect(marks.sort()).toEqual(engines.map((e) => e.logo.replace('/engines/', '')).sort());
    for (const img of home.querySelectorAll('.hex img')) {
      expect(img.getAttribute('src')).toMatch(/^\/engines\/[a-z]+\.svg$/);
    }
  });

  it('self-hosts the webfonts as separate files, not base64 inside the CSS', () => {
    const fonts = readdirSync('dist/_astro').filter((f) => f.endsWith('.woff2'));
    expect(fonts.length).toBeGreaterThan(0);
    for (const f of readdirSync('dist/_astro').filter((n) => n.endsWith('.css'))) {
      expect(readFileSync(`dist/_astro/${f}`, 'utf8'), `${f} inlines a font`).not.toContain('data:font');
    }
  });
});

describe('SEO surface', () => {
  const meta = (doc: Document, sel: string) => doc.querySelector(sel)?.getAttribute('content');

  it('gives every page a canonical, a description and an absolute og:image', () => {
    for (const [name, doc, path] of [
      ['home', home, '/'],
      ['blog', blog, '/blog'],
      ['post', post, '/blog/the-tool-goes-to-the-data'],
    ] as const) {
      const canonical = doc.querySelector('link[rel=canonical]')?.getAttribute('href');
      expect(canonical, `${name}: canonical`).toBe(path === '/' ? `${site.url}/` : `${site.url}${path}`);
      expect(meta(doc, 'meta[name=description]')?.length ?? 0, `${name}: description`).toBeGreaterThan(50);
      expect(meta(doc, 'meta[property="og:image"]'), `${name}: og:image`).toMatch(/^https:\/\//);
      expect(meta(doc, 'meta[name="twitter:card"]'), `${name}: twitter card`).toBe('summary_large_image');
    }
  });

  it('marks the post as an article with a published time', () => {
    expect(meta(post, 'meta[property="og:type"]')).toBe('article');
    expect(meta(post, 'meta[property="article:published_time"]')).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('emits JSON-LD that parses', () => {
    for (const doc of [home, post]) {
      const raw = doc.querySelector('script[type="application/ld+json"]')?.textContent ?? '';
      expect(() => JSON.parse(raw)).not.toThrow();
      expect(JSON.parse(raw)['@graph'].length).toBeGreaterThan(1);
    }
  });

  it('publishes a sitemap and an RSS feed carrying every published post', () => {
    const rss = readFileSync('dist/rss.xml', 'utf8');
    const items = (rss.match(/<item>/g) ?? []).length;
    expect(items).toBe(readdirSync('dist/blog', { withFileTypes: true }).filter((e) => e.isDirectory()).length);
    expect(rss).toContain(`${site.url}/blog/the-tool-goes-to-the-data`);
    expect(rss).toContain('<language>en</language>');

    const sitemap = readFileSync('dist/sitemap-0.xml', 'utf8');
    expect(sitemap).toContain(`${site.url}/`);
    expect(sitemap, '404 must stay out of the sitemap').not.toContain('/404');
  });

  it('keeps 404 out of the index', () => {
    const notFound = page('dist/404.html');
    expect(notFound.querySelector('meta[name=robots]')?.getAttribute('content')).toContain('noindex');
  });
});

describe('every internal link resolves to a built page', () => {
  it('has no dangling in-site href', () => {
    const built = new Set<string>(['/']);
    const walk = (dir: string, prefix = '') => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.isDirectory()) walk(`${dir}/${entry.name}`, `${prefix}/${entry.name}`);
        else if (entry.name === 'index.html') built.add(prefix || '/');
        else if (entry.name.endsWith('.html')) built.add(`${prefix}/${entry.name.replace('.html', '')}`);
        else if (entry.name === 'rss.xml') built.add(`${prefix}/rss.xml`);
      }
    };
    walk('dist');

    const pages = ['dist/index.html', 'dist/blog/index.html', 'dist/faq/index.html', 'dist/404.html'];
    const dangling: string[] = [];
    for (const p of pages) {
      for (const a of page(p).querySelectorAll('a[href]')) {
        const href = a.getAttribute('href') ?? '';
        if (!href.startsWith('/') || href.startsWith('//')) continue;
        const path = href.split('#')[0].replace(/\/$/, '') || '/';
        if (!built.has(path)) dangling.push(`${p}: ${href}`);
      }
    }
    expect(dangling).toEqual([]);
  });

  it('resolves every homepage anchor to a real element id', () => {
    const ids = new Set([...home.querySelectorAll('[id]')].map((e) => e.getAttribute('id')));
    const missing = [...home.querySelectorAll('a[href^="#"], a[href^="/#"]')]
      .map((a) => (a.getAttribute('href') ?? '').split('#')[1])
      .filter((id) => id && !ids.has(id));
    expect(missing).toEqual([]);
  });
});

describe('hero product tour', () => {
  const DESKTOP = '/demo/libredb-studio-demo.html';
  const MOBILE = '/demo/libredb-studio-demo-mobile.html';

  it('ships both bundles', () => {
    // The two are authored at different sizes (1920x1080 and 422x950). Losing
    // the phone one silently falls back to the desktop tour at 17% scale.
    for (const f of [DESKTOP, MOBILE]) {
      expect(existsSync(`dist${f}`), `${f} is missing from the build`).toBe(true);
    }
  });

  it('leaves src off the iframe so only one bundle is fetched', () => {
    const frame = home.querySelector('[data-demo]');
    expect(frame, 'hero tour iframe is missing').not.toBe(null);
    expect(frame?.getAttribute('src'), 'a server-rendered src downloads the wrong bundle').toBe(null);
    expect(frame?.getAttribute('data-demo-desktop')).toBe(DESKTOP);
    expect(frame?.getAttribute('data-demo-mobile')).toBe(MOBILE);
  });

  it('keeps a no-JS fallback', () => {
    // linkedom parses the iframe as a child element, so textContent is only the
    // whitespace around it — assert on the markup instead.
    const fallback = [...home.querySelectorAll('noscript')].map((n) => n.innerHTML).join('');
    expect(fallback).toContain(DESKTOP);
  });

  it("crops to the card with the tour's own geometry", () => {
    // The tour paints a 1920-wide stage holding a 1735x976 card at (92.5, 104).
    // Those four numbers are what the crop is built from, so if a re-export from
    // the design tool moves the card, this is the test that says so.
    const css = styles();
    for (const [name, value] of [
      ['--stage-w', '1920'],
      ['--card-w', '1735'],
      ['--card-x', '92.5'],
      ['--card-y', '104'],
    ]) {
      expect(css, `${name} is not the value the crop was measured against`).toContain(`${name}:${value}`);
    }
  });

  it('offers an accessible way to expand it', () => {
    const button = home.querySelector('[data-demo-expand]');
    expect(button, 'no expand control').not.toBe(null);
    expect(button?.tagName.toLowerCase(), 'must be focusable and operable by keyboard').toBe('button');
    expect(button?.getAttribute('aria-label')).toBeTruthy();
  });
});
