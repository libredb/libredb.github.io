import config from '../../site.config.json' with { type: 'json' };

export const site = config;

/** Absolute, trailing-slash-free canonical URL for a site-relative path. */
export function canonicalUrl(path: string): string {
  const base = config.url.replace(/\/+$/, '');
  const clean = `/${path.replace(/^\/+/, '')}`.replace(/\/+$/, '');
  return clean === '' ? `${base}/` : `${base}${clean}`;
}
