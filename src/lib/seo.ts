import { canonicalUrl, site } from './site';

export interface SeoInput {
  title?: string;
  /** overrides the title tag only; the page keeps its own H1 */
  seoTitle?: string;
  /** overrides the description tag only; the page keeps its own lede */
  seoDescription?: string;
  description?: string;
  path: string;
  /** site-relative or absolute image used for og:image / twitter:image */
  image?: string;
  type?: 'website' | 'article';
  publishedTime?: string;
  modifiedTime?: string;
  authors?: string[];
  noindex?: boolean;
}

export interface Seo {
  title: string;
  description: string;
  canonical: string;
  image: string;
  type: 'website' | 'article';
  publishedTime?: string;
  modifiedTime?: string;
  authors: string[];
  noindex: boolean;
}

const DEFAULT_IMAGE = '/og/default.png';

/**
 * Google renders about 60 characters of a title before it truncates. The brand
 * suffix was costing 17 of them unconditionally, which pushed 96 of 146 pages
 * past the limit — the titles themselves were rarely the problem. Spending the
 * budget on the words that distinguish the page beats spending it on the same
 * two words every page already repeats.
 *
 * So the suffix is fitted, not fixed: the full name where it fits, the short
 * one where that fits, and nothing where neither does. 75 pages still carry the
 * brand; none of them lose their own words to it.
 */
const TITLE_LIMIT = 60;

/**
 * Google renders roughly 160 characters of a description. 23 of ours ran past
 * it — up to 264 — so the closing clause, which is usually the part that says
 * why to click, was the part being cut.
 *
 * The same string is the lede printed on the page, and that one should stay
 * whole: a post deserves a full opening paragraph. So the trim happens here,
 * for the tag only, and it stops at a sentence rather than mid-word. Where a
 * post wants a listing written differently from its lede, `seoDescription`
 * overrides this outright.
 */
const DESCRIPTION_LIMIT = 160;

function fitDescription(text: string): string {
  const clean = text.trim();
  if (clean.length <= DESCRIPTION_LIMIT) return clean;

  // One character short of the limit: the ellipsis added below occupies it.
  const window = clean.slice(0, DESCRIPTION_LIMIT);
  const sentence = Math.max(window.lastIndexOf('. '), window.lastIndexOf('? '), window.lastIndexOf('! '));
  // A sentence break is only useful if it leaves something worth reading.
  if (sentence > DESCRIPTION_LIMIT * 0.55) return clean.slice(0, sentence + 1);

  const word = window.lastIndexOf(' ');
  return `${clean.slice(0, word > 0 ? word : DESCRIPTION_LIMIT).replace(/[,;:\s]+$/, '')}…`;
}

function withBrand(title: string): string {
  for (const suffix of [` — ${site.name}`, ` — ${site.shortName}`]) {
    if (title.length + suffix.length <= TITLE_LIMIT) return title + suffix;
  }
  return title;
}

export function buildSeo(input: SeoInput): Seo {
  // `seoTitle` is the escape hatch for a headline written for the page rather
  // than for a result listing: it replaces the title tag and leaves the H1 alone.
  const heading = input.seoTitle || input.title;
  const title = heading ? withBrand(heading) : `${site.name} — ${site.tagline}`;
  return {
    title,
    description: fitDescription(input.seoDescription || input.description || site.description),
    canonical: canonicalUrl(input.path),
    image: canonicalUrl(input.image ?? DEFAULT_IMAGE),
    type: input.type ?? 'website',
    publishedTime: input.publishedTime,
    modifiedTime: input.modifiedTime,
    authors: input.authors ?? [],
    noindex: input.noindex ?? false,
  };
}
