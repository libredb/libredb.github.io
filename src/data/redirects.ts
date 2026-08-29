/**
 * Tombstones for the URLs the previous libredb.org served.
 *
 * The old site generated one route per row of `sections.ts` — nineteen of them,
 * all of them live and indexed today. The redesign keeps some URLs, renames
 * others and drops a few outright. Every renamed or dropped URL gets a stub
 * here so an existing link, a search result or a marketplace listing lands on
 * the page that replaced it instead of on a 404.
 *
 * A URL that survived the redesign unchanged (/features, /deploy, /faq,
 * /get-started, /playground, /privacy-policy, /databases, and the four pages
 * rebuilt at their original paths — /security, /support, /platform, /compare)
 * is NOT listed: it needs no redirect, and listing it would collide with the
 * real page.
 *
 * THESE ARE TEMPORARY. Nothing inside the LibreDB repositories links to any URL
 * below — the only cross-repo libredb.org links are the Helm repo at
 * /libredb-studio/ (a separate Pages deployment, from the studio repo's own
 * gh-pages branch), the OIDC role-claim URI /roles, the two /.well-known files
 * and /privacy-policy, all of which are unaffected. So these stubs exist purely
 * to hand the search index over, and they can be deleted — the whole file, and
 * the page that renders it — once Search Console reports no impressions on
 * them. Review after 2027-08-29, a year from the cutover.
 *
 * `to` is where the visitor ends up, fragment included. `canonical` is the
 * indexable page the ranking signal should consolidate onto, so it never
 * carries a fragment — a canonical pointing at `/#why` and one pointing at `/`
 * are the same URL to a crawler, and only one of the two spellings is honest.
 */
export interface Redirect {
  /** the old path, without a trailing slash */
  from: string;
  /** where the visitor is sent — may carry a fragment */
  to: string;
  /** the page that inherits the ranking signal — never carries a fragment */
  canonical: string;
  /** shown on the fallback page, so a visitor knows what they are being handed */
  label: string;
  /** why this is the right target, for whoever edits this file next */
  because: string;
}

export const redirects: Redirect[] = [
  {
    from: '/providers',
    to: '/databases',
    canonical: '/databases',
    label: 'Databases',
    because: 'Same page, renamed: "providers" is the code word for it, "databases" is what people search for.',
  },
  {
    from: '/manifesto',
    to: '/#why',
    canonical: '/',
    label: 'Why LibreDB Studio exists',
    because: 'The manifesto became the "Why it exists" section of the homepage rather than a page of its own.',
  },
  {
    from: '/docker-compose-example',
    to: '/docker-compose',
    canonical: '/docker-compose',
    label: 'Docker Compose',
    because:
      'Shorter path for the same page. The raw file also moved, from /docker-compose.example.yml — which is unchanged, so it needs no stub.',
  },
  {
    from: '/database',
    to: '/libredb-database',
    canonical: '/libredb-database',
    label: 'LibreDB, the embeddable database',
    because:
      'Renamed away from /database, which sat one letter from /databases and pointed at a different product. The old pair was a genuine navigation trap.',
  },
  {
    from: '/database-architecture',
    to: '/libredb-database#architecture',
    canonical: '/libredb-database',
    label: 'LibreDB architecture',
    because: 'Three pages on one product became three sections of one page; this is its second section.',
  },
  {
    from: '/database-reliability',
    to: '/libredb-database#reliability',
    canonical: '/libredb-database',
    label: 'LibreDB reliability',
    because: 'Three pages on one product became three sections of one page; this is its third section.',
  },
  {
    from: '/tech-stack',
    to: '/open-source',
    canonical: '/open-source',
    label: 'Open source',
    because:
      'The stack list was a feature-table in disguise. What it was actually answering — what is this built on, who can read it — is what /open-source answers, with the licence and the repository attached.',
  },
];

/** Paths that exist in the build but are tombstones, not pages of the site. */
export const redirectPaths: readonly string[] = redirects.map((r) => r.from);
