/**
 * LibreDB Platform — the commercial, governed form of Studio.
 *
 * Why this page exists: without it the site never says that a paid product
 * exists, which leaves the open-core story with a hole in it. "Studio is free
 * and always will be" is a much weaker sentence when a visitor cannot see what
 * is NOT free, because the obvious next thought is that the catch is hidden
 * somewhere.
 *
 * STATUS DISCIPLINE. The previous site badged this "Live · beta" and linked to
 * https://platform.libredb.org. That host does not serve: DNS resolves to a
 * live server, but the TLS handshake is answered with an internal-error alert
 * and no certificate for the name, and plain HTTP returns 404 — the reverse
 * proxy has no vhost for it. So this page:
 *
 *   - does NOT call the product live,
 *   - does NOT link to platform.libredb.org,
 *   - routes interest to the vendor's address instead.
 *
 * Restore the link in the same change that makes the host serve, and not
 * before. A dead link on the page that asks for money is the most expensive
 * dead link on the site.
 *
 * SOURCE OF TRUTH: libredb-platform → README.md and docs/product-map.md.
 */

export const status = {
  /** Shown in the badge. Never say "live" while the host does not answer. */
  label: 'Beta · self-hosted · by request',
  headline: { before: 'Stop distributing ', gradient: 'connection strings' },
  intro:
    'LibreDB Platform is the governed, multi-team form of LibreDB: admins decide who can reach which database, every query is logged against a person, and nobody is emailed a password. It is self-hosted on your infrastructure, like Studio — the difference is who is accountable for the access, not where it runs.',
};

export interface Capability {
  name: string;
  detail: string;
}

export const capabilities: Capability[] = [
  {
    name: 'Multi-tenant organisations',
    detail: 'Isolated data per organisation, so one deployment serves several teams without them seeing each other.',
  },
  {
    name: 'Five-role RBAC',
    detail:
      'Platform Admin, Platform Tech, Tenant Admin, Editor and Viewer — least privilege as the starting point rather than as a hardening step.',
  },
  {
    name: 'Connection governance',
    detail:
      'Encrypted credentials behind a permission matrix per connection. Access is granted to a person; the password is never handed over.',
  },
  {
    name: 'Query audit log',
    detail: 'Every query recorded with who ran it, how long it took and how it ended. Accountability, not telemetry.',
  },
  {
    name: 'SSO through your provider',
    detail: 'Vendor-agnostic OIDC — Auth0, Keycloak, Okta, Entra ID. Joiners and leavers stay one system’s problem.',
  },
  {
    name: 'Licensing',
    detail:
      'Per-organisation licences during the beta, self-hosted, with plan tiers configurable at runtime. There is no online checkout yet — a licence is arranged directly.',
  },
];

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
    href: '/open-source',
    cta: 'What MIT lets you do →',
  },
  {
    tier: 'LibreDB Platform',
    line: 'Commercial · beta · self-hosted · licensed',
    detail:
      'Governance on top of that editor for an organisation that has to answer who reached which data, and when. It funds the open-source work.',
  },
];
