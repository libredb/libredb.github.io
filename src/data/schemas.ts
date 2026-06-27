// src/data/schemas.ts
// Schema grouping for the Explorer tree. One connection (libredb.org), three
// schemas: studio (production hero), database (pre-alpha engine), platform
// (commercial, external). Sections belong to studio or database; platform has
// no internal sections — only an external link.

export interface SchemaMeta {
  id: 'studio' | 'database' | 'platform';
  label: string;            // tree heading
  badge?: string;           // e.g. "pre-alpha", "beta · teams"
  badgeClass?: string;      // styling hook (Tailwind classes)
  external?: { label: string; href: string }; // platform: link row, no section
}

export const schemas: SchemaMeta[] = [
  { id: 'studio', label: 'studio' },
  {
    id: 'database',
    label: 'database',
    badge: '🧪 pre-alpha',
    badgeClass: 'text-warn border border-warn/40',
  },
  {
    id: 'platform',
    label: 'platform',
    badge: 'beta · teams',
    badgeClass: 'text-ai border border-ai/40',
    external: { label: 'overview', href: 'https://platform.libredb.org' },
  },
];
