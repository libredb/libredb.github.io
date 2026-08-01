// Single source of truth for the footer quick links. Rendered twice — once in
// the desktop status bar, once in the mobile footer — so the two cannot drift
// apart the way a hand-copied list would.

export interface QuickLink {
  label: string;
  href: string;
  /** Off-site links get target/rel; internal routes must not. */
  external?: boolean;
  /** Trailing glyph rendered in the accent colour, e.g. the sponsor heart. */
  accent?: string;
}

export const QUICK_LINKS: readonly QuickLink[] = [
  { label: 'GitHub', href: 'https://github.com/libredb/libredb-studio', external: true },
  { label: 'LinkedIn', href: 'https://www.linkedin.com/company/libredb', external: true },
  { label: 'X', href: 'https://x.com/libredb', external: true },
  { label: 'YouTube', href: 'https://www.youtube.com/@libredb', external: true },
  { label: 'Instagram', href: 'https://www.instagram.com/libredb/', external: true },
  { label: 'Reddit', href: 'https://www.reddit.com/r/libredb/', external: true },
  { label: 'Docker', href: 'https://hub.docker.com/r/libredb/libredb-studio', external: true },
  { label: 'Sponsor', href: 'https://github.com/sponsors/libredb', external: true, accent: '♥' },
  { label: 'Privacy', href: '/privacy-policy' },
] as const;
