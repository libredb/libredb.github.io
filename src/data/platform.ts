/**
 * LibreDB Platform — the governed form of Studio, and the only thing on this
 * site that costs money: free up to 1 admin and 3 users, paid beyond that.
 *
 * Why this page exists: without it the site never says that a paid product
 * exists, which leaves the open-core story with a hole in it. "Studio is free
 * and always will be" is a much weaker sentence when a visitor cannot see what
 * is NOT free, because the obvious next thought is that the catch is hidden
 * somewhere.
 *
 * STATUS DISCIPLINE. The previous site badged this "Live" and linked to
 * https://platform.libredb.org. That host does not serve: DNS resolves to a
 * live server, but the TLS handshake is answered with an internal-error alert
 * and no certificate for the name, and plain HTTP returns 404 — the reverse
 * proxy has no vhost for it. So this page:
 *
 *   - does NOT link to platform.libredb.org,
 *   - routes interest to the waiting list, which is an email to `contact.email`.
 *
 * Restore the link in the same change that makes the host serve, and not
 * before. A dead link on the page that names the eventual paid product is the
 * most expensive dead link on the site.
 *
 * PRICE DISCIPLINE (2026-10-19). Platform is a released product, not a beta —
 * do not call it one anywhere. The free licence covers 1 admin seat and 3 user
 * seats for 12 months; more seats are paid, priced on request. Every surface
 * that names the free licence must name the paid line in the same breath. If
 * the offer changes, change ALL of these together: `offer` below, the tiers
 * row, the hero chip in home.ts, the form's licence choice in platform.astro,
 * and the Platform sections of llms.txt.ts and llms-full.txt.ts.
 *
 * THE WAITING LIST IS AN EMAIL. Production is GitHub Pages, which cannot
 * receive a form post, and a third-party form relay would put visitors' details
 * through a processor the privacy policy does not name. So the form composes a
 * message in the visitor's own mail app (src/scripts/waitlist.ts); nothing
 * leaves this site. The address is printed beside the form for anyone without a
 * mail app.
 *
 * SOURCE OF TRUTH: libredb-platform → README.md (Features, Install, License).
 */

export const status = {
  /** Shown in the badge. Never say "live" while the host does not answer. */
  label: 'Self-hosted · free for 1 admin + 3 users',
  headline: { before: 'Stop handing out ', gradient: 'connection strings' },
  intro:
    'LibreDB Platform puts one door in front of every database your team uses. Admins decide who reaches which database, people sign in with the company’s single sign-on, every query is logged against a name — and nobody is ever emailed a password. It runs on your own servers, next to your data.',
};

/** Where waiting-list requests and licence questions go. The Platform README
 *  names this address for licence keys; it is not the vendor's general inbox
 *  in company.ts. */
export const contact = {
  email: 'info@libredb.org',
  subject: 'LibreDB Platform — waiting list',
} as const;

/**
 * The 60-second tour, on the LibreDB YouTube channel (uploaded in 4K).
 *
 * CLICK TO LOAD. The page shows only our own poster until the visitor presses
 * play; the YouTube player is created then, from the youtube-nocookie.com
 * domain (src/scripts/youtube-facade.ts). The privacy policy promises that a
 * visitor who declines cookies loads nothing from Google, so an iframe present
 * at page load would break that promise. Do not "simplify" this into a plain
 * embed.
 *
 * The video burns its own caption cards into the picture, so do not upload a
 * captions track to YouTube either — the two sets would sit on top of each
 * other.
 */
export const tour = {
  /** The YouTube thumbnail, kept here so the poster needs no request to Google. */
  poster: '/video/libredb-platform-tour.jpg',
  title: 'LibreDB Platform in 60 seconds',
  youtube: 'https://www.youtube.com/watch?v=YTf8dEG_Zo0',
  /** Canonical embed URL, for structured data. */
  youtubeEmbed: 'https://www.youtube.com/embed/YTf8dEG_Zo0',
  /** What the play button actually loads. */
  player: 'https://www.youtube-nocookie.com/embed/YTf8dEG_Zo0?autoplay=1&rel=0',
  uploadDate: '2026-10-19',
  duration: 'PT59S',
};

export interface Capability {
  name: string;
  detail: string;
}

export const capabilities: Capability[] = [
  {
    name: 'One sign-in for everyone',
    detail:
      'People sign in through Keycloak single sign-on, connected to the identity provider you already run. Joiners and leavers stay one system’s problem.',
  },
  {
    name: 'Passwords nobody sees',
    detail:
      'Database credentials are sealed to Studio’s public key when an admin registers a connection. People get access to a database — never its password.',
  },
  {
    name: 'Access, person by person',
    detail:
      'Grant a connection to a named user from the access panel, read-only or with write. Revoke it and it is gone from their Studio — no password to rotate.',
  },
  {
    name: 'Every query on the record',
    detail:
      'The audit log shows each query with who ran it, how long it took and how it ended. Accountability your auditors can read, not telemetry.',
  },
  {
    name: 'Roles that start at least privilege',
    detail:
      'Six system roles — Platform Admin, Platform Tech, Platform Support, Tenant Admin, Editor and Viewer — plus custom roles of your own.',
  },
  {
    name: 'Studio, managed centrally',
    detail:
      'Your analysts work in LibreDB Studio, the full editor for every engine. Its settings are set once from Platform and apply without a restart.',
  },
];

/**
 * The limits, stated beside the capabilities as everywhere else on this site.
 * Each one is in the Platform README; keep them in step with it.
 */
export const limits: { term: string; detail: string }[] = [
  {
    term: 'Install',
    detail:
      'One installer deploys PostgreSQL, Keycloak, Platform, Studio and a Caddy edge with Docker on a single x86_64 Linux host. Kubernetes support follows in the next release.',
  },
  {
    term: 'Licence key',
    detail:
      'Every self-hosted install needs a licence key, and Platform does not start without one. The key names your organization and the one domain Platform runs on, and sets the admin and user seats and the expiry.',
  },
  {
    term: 'Audit',
    detail:
      'The audit log records the queries Studio reports. Access that bypasses Platform — a password someone still holds — is outside it, which is why credentials are sealed.',
  },
  {
    term: 'Licence terms',
    detail:
      'Platform is source-available under the Elastic License 2.0: use, modify and self-host it, but not offer it to others as a hosted service. Studio stays MIT.',
  },
];

/** The licence offer, as the waiting list states it. `choices` is the form's
 *  licence question: two answers, so nobody has to work out where free ends. */
export const offer = {
  seats: '1 admin and 3 users',
  term: '12 months',
  headline: 'Join the waiting list',
  lead: 'The licence for 1 admin and 3 users is free for 12 months — no card, nothing to buy. Need more seats? Those are paid, and we will send a price for the number you need. Tell us your organization and the domain Platform will run on, and we will come back with a licence key and the installer.',
  choices: [
    { value: 'Free licence — 1 admin + 3 users', label: '1 admin + 3 users', note: 'Free for 12 months' },
    { value: 'Paid licence — more seats', label: 'More than that', note: 'Paid — we send a price' },
  ],
};

/**
 * The open-core line, stated as two rows rather than as a feature comparison.
 * A capability table here would invite the reading that Studio is the crippled
 * one, which is exactly the reading /open-source spends a page refuting.
 */
export const tiers = [
  {
    tier: 'LibreDB Studio',
    line: 'MIT · free · self-hosted · community support',
    detail:
      'The full editor. Every engine, every capability, no seat count and no enterprise tier. This is what most people need.',
    href: '/open-source/',
    cta: 'What MIT lets you do →',
  },
  {
    tier: 'LibreDB Platform',
    line: 'Self-hosted · Elastic License 2.0 · paid beyond 4 seats',
    detail:
      'Governance on top of that editor, for an organisation that has to answer who reached which data, and when. The licence is free for 1 admin and 3 users for 12 months; more seats are paid. It is here so the part that costs money is visible rather than hidden.',
    href: '#waitlist',
    cta: 'Join the waiting list →',
  },
];
