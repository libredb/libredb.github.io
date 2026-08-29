import { canonicalUrl, site } from './site';

export interface SeoInput {
  title?: string;
  description?: string;
  path: string;
  /** site-relative or absolute image used for og:image / twitter:image */
  image?: string;
  type?: 'website' | 'article';
  locale?: string;
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
  locale: string;
  publishedTime?: string;
  modifiedTime?: string;
  authors: string[];
  noindex: boolean;
}

const DEFAULT_IMAGE = '/og/default.png';

export function buildSeo(input: SeoInput): Seo {
  const title = input.title ? `${input.title} — ${site.name}` : `${site.name} — ${site.tagline}`;
  return {
    title,
    description: input.description ?? site.description,
    canonical: canonicalUrl(input.path),
    image: canonicalUrl(input.image ?? DEFAULT_IMAGE),
    type: input.type ?? 'website',
    locale: input.locale ?? site.defaultLocale,
    publishedTime: input.publishedTime,
    modifiedTime: input.modifiedTime,
    authors: input.authors ?? [],
    noindex: input.noindex ?? false,
  };
}

/** BCP-47-ish og:locale (en → en_US, tr → tr_TR). */
export function ogLocale(locale: string): string {
  const map: Record<string, string> = { en: 'en_US', tr: 'tr_TR' };
  return map[locale] ?? 'en_US';
}
