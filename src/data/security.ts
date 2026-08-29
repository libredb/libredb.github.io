/**
 * The security model page.
 *
 * This is the page a DBA or a security reviewer opens before letting a tool
 * near production, so it is written for someone looking for a reason to say no.
 * Two halves, and the second half is the one that earns the first:
 *
 *   controls — what is enforced, and where it is enforced
 *   limits   — where those guarantees end
 *
 * The limits are not a disclaimer. They are transcribed from the project's own
 * SECURITY.md § Known Security Considerations, which documents them because a
 * reviewer who finds an undocumented limitation stops trusting the documented
 * controls too. A page that lists only the controls is the weaker page, not the
 * stronger one — the reviewer finds the same facts in the repository ten
 * minutes later, and now they have found them in spite of us.
 *
 * SOURCE OF TRUTH: libredb-studio → SECURITY.md, with docs/OIDC.md,
 * docs/STORAGE.md and docs/SEED_CONNECTIONS.md for the individual controls.
 * Nothing here may claim more than those files claim.
 */

const REPO = 'https://github.com/libredb/libredb-studio';

export interface Control {
  control: string;
  detail: string;
  href?: string;
  linkLabel?: string;
}

export const controls: Control[] = [
  {
    control: 'Authentication',
    detail:
      'OpenID Connect SSO — Auth0, Keycloak, Okta, Entra ID or any OIDC provider — over Authorization Code Flow with PKCE. The session is a JWT in an httpOnly, SameSite=Lax cookie, never in localStorage. Token lifetime is a fixed 24 hours.',
    href: `${REPO}/blob/main/docs/OIDC.md`,
    linkLabel: 'OIDC guide',
  },
  {
    control: 'Authorization',
    detail:
      'Role-based access control with per-connection visibility scoping: a connection can be exposed to admins only, to users, or to everyone. Roles map from your identity provider’s claims, so joiners and leavers are handled where you already handle them.',
  },
  {
    control: 'Database credentials',
    detail:
      'Seed connections resolve ${ENV_VAR} placeholders at runtime, so the secret lives in your environment or secret manager and never in a config file. Pair each connection with a dedicated least-privilege database account — read-only until something needs more.',
    href: `${REPO}/blob/main/docs/SEED_CONNECTIONS.md`,
    linkLabel: 'Seed connections',
  },
  {
    control: 'Credentials at rest',
    detail:
      'With a server-side store, the password, connection string, TLS client key and SSH key material are encrypted with AES-256-GCM before they are written — from STORAGE_ENCRYPTION_KEY, or derived from JWT_SECRET when that is unset, so there is no new required configuration. Host, port, user and database name stay readable so an operator can still tell what a dump contains.',
    href: `${REPO}/blob/main/docs/STORAGE.md#credential-encryption-at-rest`,
    linkLabel: 'Credential encryption',
  },
  {
    control: 'Transport',
    detail:
      'TLS between the browser and the app; TLS and SSH tunnels between the app and your databases — including databases behind a firewall that are never given public exposure at all.',
  },
  {
    control: 'Request integrity',
    detail:
      'Every state-changing request must carry an Origin or Referer matching the deployment’s own host, behind the SameSite cookie. Responses carry CSP, HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy and Permissions-Policy. Logins, denials and rate-limit trips are written to the audit log and emitted as structured JSON on stdout.',
    href: `${REPO}/blob/main/docs/API_DOCS.md`,
    linkLabel: 'API reference',
  },
  {
    control: 'Self-hosting and isolation',
    detail:
      'Self-hosting is the default path, not a downgrade: your infrastructure, your network, behind your VPN. Nothing has to leave the perimeter — including the AI, which runs fully local against Ollama or LM Studio.',
  },
  {
    control: 'Supply chain',
    detail:
      'MIT source you can read line by line. Every release ships SHA-256 checksums; CI runs CodeQL and SonarCloud, scans dependencies on every pull request and scans the published image daily. Every commit is scanned for credentials, and the full history was swept and classified once.',
  },
];

export interface Limit {
  title: string;
  detail: string;
}

/**
 * Transcribed from SECURITY.md § Known Security Considerations. Each of these
 * is a real constraint an operator has to design around, not a hypothetical.
 */
export const limits: Limit[] = [
  {
    title: 'The browser store keeps credentials in the clear',
    detail:
      'Without a server-side store, connection details — database passwords and SSH private keys included — are held unencrypted in browser localStorage. That is what lets Studio work with no master password, and it means the browser profile is secret material: anyone who can read it can read every configured credential. It is also why cross-site scripting is treated as a top-severity issue here. Set STORAGE_PROVIDER to sqlite or postgres and the encryption above applies instead.',
  },
  {
    title: 'The built-in local login does not hash',
    detail:
      'ADMIN_PASSWORD and USER_PASSWORD are compared directly. They are not stored in a database and not hashed — protect them the way you protect any other server environment variable, or skip them entirely and use OIDC.',
  },
  {
    title: 'Saved passwords are returned to their owner',
    detail:
      'Credentials never reach the application logs, but the storage API returns them in plaintext to the authenticated owner, because the app has to be able to redisplay a saved connection for editing. Session theft is therefore credential theft.',
  },
  {
    title: 'Masking is display-level',
    detail:
      'Detected sensitive columns are masked across the grid, exports and clipboard with RBAC enforced. It is a display control, and a display control is not a boundary — for a hard guarantee, pair it with database-side grants on the account the connection uses.',
  },
  {
    title: 'Rate limits are per replica',
    detail:
      'The counters live in the application process, so two replicas mean two budgets. Enforce the same budgets at the ingress for any multi-replica deployment; the RATE_LIMIT_* variables document what the application applies.',
  },
  {
    title: 'A cloud LLM sees the query',
    detail:
      'API keys are held server-side only, but a query sent to a hosted model may be logged by that provider. This is the reason the local-model path exists, and the reason it is the one to choose when the data is sensitive.',
  },
];

export const disclosure = {
  headline: 'Report it privately, and it gets fixed before it is public',
  body: 'A vulnerability goes to the address in the security policy, not into a public issue — that is what lets a fix ship before the details are known. The policy documents what to include, what response to expect, and the disclosure timeline it commits to.',
  note: 'Security updates are provided for the current minor line; older lines are not patched. The policy also publishes a software bill of materials and the known considerations above, in the project’s own words.',
  href: `${REPO}/blob/main/SECURITY.md`,
};
