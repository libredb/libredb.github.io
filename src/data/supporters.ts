/**
 * Page content for /supporters — the attribution page.
 *
 * This URL is a commitment made on application forms, not a marketing idea.
 * The sibling repo's docs/summaries/OSS_CREDITS_SUBMISSIONS.md answer B18 reads
 * "the supporter's logo goes on libredb.org/supporters and in the repo README
 * the same day, plus whatever badge the program requires", and its § G step 2
 * requires this page to exist before the first application is sent, because
 * several programmes check that attribution is possible before they accept.
 * So the page is written to be read by a programme reviewer first and a visitor
 * second: what the project asks for, what a supporter gets, and what cannot be
 * bought.
 *
 * `needs` is transcribed from the vendor sheets in that file (§ D) — it is the
 * list actually being applied to, not a wish list. When a sheet moves out of
 * § D, the row here moves with it.
 *
 * `supporters` holds only accepted programmes. It stayed empty until one
 * landed, which is the same rule /deploy applies to distribution channels — a
 * submitted application is not a listing. The bar is an acceptance or a covered
 * cost, so a self-serve free tier that any public repository gets (Codecov,
 * Grafana Cloud, Semgrep, GitGuardian, Socket) does not qualify and is not here:
 * nobody granted the project anything, and naming them would inflate the page
 * with support that was never given.
 *
 * Tailscale, accepted 2026-08-30, is the first entry. BrowserStack followed on
 * 2026-08-31, and is the first whose `badge` is not optional: their programme
 * validates the exact sentence in README.md before it will approve an
 * application, so the wording is a condition of the grant rather than a thank-you.
 * Docker-Sponsored Open Source landed on 2026-09-01 and is the opposite case, which
 * is why `badge` is deliberately empty on it: Docker awards the mark on its own
 * namespace, so there is no wording here to keep true. It is not unconditional
 * either — the condition simply lives on a surface this repository does not own.
 */

/** A programme or company whose support the project has accepted. */
export interface Supporter {
  /** How the supporter is named in its own materials. */
  name: string;
  /** What the support actually covers. The attribution, not the logo, is the point. */
  role: string;
  href: string;
  /** Path under public/brand/supporters/. Text-only until a logo is supplied. */
  logo?: string;
  /**
   * Intrinsic pixel size of `logo`, so the image reserves its box before it
   * loads instead of shifting the card under it. Aspect ratios differ per
   * vendor, so this cannot be derived from the CSS height cap.
   */
  logoSize?: { w: number; h: number };
  /** ISO date the acceptance landed — the day the entry went live. */
  since?: string;
  /**
   * The wording or mark the programme requires, kept verbatim.
   * Not decoration: "Search by Algolia" and the Docker Sponsored OSS badge are
   * conditions of the grant, so they are stored beside the entry that owes them.
   */
  badge?: string;
}

export const supporters: Supporter[] = [
  {
    name: 'Tailscale',
    role: 'The Community on GitHub plan behind the private network maintainers use to reach the database probe hosts, so testing against real engines does not mean exposing database ports to the internet.',
    href: 'https://tailscale.com/opensource',
    since: '2026-08-30',
  },
  {
    name: 'BrowserStack',
    role: 'Live, Automate and Percy across real browsers and devices. The product is a browser application, so a browser bug is a product bug — and CI can only see desktop Chromium. Safari, older WebKit and mobile layout need hardware.',
    href: 'https://www.browserstack.com/open-source',
    since: '2026-08-31',
    badge: 'This project is tested with BrowserStack.',
  },
  {
    name: 'Docker',
    role: 'The Docker-Sponsored Open Source programme on the libredb namespace, which removes pull rate limits for everyone pulling the public image. GHCR remains the canonical registry; this is what keeps the Docker Hub mirror usable without an account.',
    href: 'https://www.docker.com/community/open-source/',
    since: '2026-09-01',
  },
];

export const supportersPage = {
  eyebrow: 'Supporters',
  headline: { before: 'Who pays for the parts ', gradient: 'we do not build' },
  intro:
    'LibreDB Studio is MIT and self-hosted, but the work around it is not free: a build fleet, sixteen database engines to probe against, a public trial anyone can open, signed Windows binaries. Where a company or an open-source programme covers one of those, it is named here.',

  empty: {
    kicker: 'Current supporters',
    headline: 'None yet',
    body: 'No programme has accepted the project so far, so this list is empty rather than padded. When one does, its name, what it covers and the date it started appear here the same day the acceptance lands — and in the repository README alongside it.',
  },

  /** What the project is actually applying for, grouped by what it pays for. */
  needsHead: {
    kicker: 'What support means here',
    headline: 'The parts that cost money',
    lead: 'Each of these is infrastructure the MIT project runs in public. None of them is a feature held back from the repository — the software is complete without any of them; it is the verification and distribution around it that has a bill.',
  },
  needs: [
    {
      t: 'Site hosting and CDN',
      d: 'libredb.org and the documentation, plus the release and Helm chart downloads that spike on every version.',
    },
    {
      t: 'CI and build capacity',
      d: 'Multi-architecture container builds on every release, and Apple-silicon runners for the desktop build and its notarisation.',
    },
    {
      t: 'Security and supply chain',
      d: 'Dependency, container and secret scanning over the public repository and the published package, alongside the checks already in CI.',
    },
    {
      t: 'Code signing',
      d: 'An Authenticode certificate for the Windows artifacts. Unsigned binaries teach people to click through the warning, which is the opposite of what a database client should teach.',
    },
    {
      t: 'Error tracking and uptime',
      d: 'The two public instances strangers use to evaluate the project — errors, uptime checks and a health dashboard a contributor can read without a paid seat.',
    },
    {
      t: 'Browsers and real devices',
      d: 'Automated tests cover desktop Chromium. Safari, WebKit and mobile regressions in a browser-based editor need hardware nobody has on their desk.',
    },
    {
      t: 'Developer tool licences',
      d: 'IDE and assistant seats used for maintaining this repository — review, triage and the pull requests that come in from outside.',
    },
    {
      t: 'Managed database instances',
      d: 'Every supported engine is probed against a live server, not a mock. Managed instances are how the provider behaviour stays honest against the hosted versions people actually run.',
    },
    {
      t: 'Model inference',
      d: 'Credits for the evaluation suite behind the optional AI features, so measuring them does not cost the maintainer per query.',
    },
    {
      t: 'Domains and transactional mail',
      d: 'Project hostnames and the mail path that carries security disclosures — the address on the security policy has to work.',
    },
  ],

  /** What a supporter is promised, in the words the applications use. */
  attributionHead: {
    kicker: 'The commitment',
    headline: 'What a supporter gets, and when',
    lead: 'This is the same wording the applications carry, so a reviewer can hold the page against the form.',
  },
  attribution: [
    {
      t: 'A named entry here, the same day',
      d: 'Name, link and what the support covers — published the day the acceptance lands, not at the next site release.',
    },
    {
      t: 'The same entry in the repository',
      d: 'The README carries it too, so the attribution survives someone reading the project on GitHub and never opening this site.',
    },
    {
      t: 'The badge the programme requires, kept visible',
      d: 'Where a grant is conditional on specific wording or a mark in a specific place, that condition is stored with the entry and kept, not honoured once and forgotten.',
    },
    {
      t: 'Removal on request, without argument',
      d: 'A supporter that ends its support, or simply asks to come off the page, is removed. Attribution is a courtesy that is owed, not a licence to keep using a logo.',
    },
  ],

  /** The limit. This site states them; this one is worth stating loudly. */
  limitHead: 'What this page is not',
  limit:
    'A place on this page cannot be bought. An entry appears here because a programme accepted the project or a company covered a specific cost — never because someone paid for the placement, and never as an advertisement. Donations through GitHub Sponsors are genuinely appreciated and they do not put a name here; they are thanked in the sponsor listing itself. Nothing on this page is an endorsement of LibreDB Studio by the companies named on it, and no supporter has any say in what the project builds.',

  funding: {
    kicker: 'Who pays for the rest',
    body: 'LibreDB Studio is developed and published by Sekoya Tech, which funds its maintenance and supports it at no charge. Nothing here is sold: no paid edition, no support contract, no add-ons, and LibreDB Platform — the separate product intended to carry a price one day — is not on sale either. GitHub Sponsors donations supplement the work, and no feature is withheld from the MIT build to create a reason to pay.',
  },

  cta: {
    headline: 'Supporting the project',
    body: 'If your company runs an open-source programme covering anything in the list above, the fastest path is to say so by email — the applications are being sent either way. Individual support goes through GitHub Sponsors.',
  },
} as const;
