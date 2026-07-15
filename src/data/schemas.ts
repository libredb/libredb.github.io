// src/data/schemas.ts
// Schema grouping for the Explorer tree. One connection (libredb.org), three
// schemas: studio (production hero), database (early-beta engine), platform
// (commercial, now has an internal overview page at /platform plus an external
// live-app link to platform.libredb.org).

export interface SchemaMeta {
  id: 'studio' | 'database' | 'platform';
  label: string; // tree heading
  badge?: string; // e.g. "early-beta", "beta · teams"
  badgeClass?: string; // styling hook (Tailwind classes)
  external?: { label: string; href: string }; // secondary "open app" row after the schema's internal sections (platform)
}

export const schemas: SchemaMeta[] = [
  { id: 'studio', label: 'studio' },
  {
    id: 'database',
    label: 'database',
    badge: 'early-beta',
    badgeClass: 'text-dim',
  },
  {
    id: 'platform',
    label: 'platform',
    badge: 'beta · teams',
    badgeClass: 'text-dim',
    external: { label: 'open app', href: 'https://platform.libredb.org' },
  },
];
