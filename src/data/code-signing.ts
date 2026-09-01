/**
 * The code signing policy page.
 *
 * This page exists because a grant demands it. The SignPath Foundation provides
 * free Authenticode signing to open-source projects, and its terms
 * (https://signpath.org/terms.html, read 2026-09-01) require four published
 * things: a page reachable under the term "Code signing policy" from the home
 * page, the team roles and their members, a privacy statement, and a verbatim
 * attribution on the home and download pages.
 *
 * WHAT IS DELIBERATELY ABSENT: the attribution, and the provider's name. The
 * application went out on 2026-09-01 and has not been answered. "Free code
 * signing provided by SignPath.io" is a claim about the binaries people
 * download, not a courtesy line, so it cannot be true before a certificate
 * exists. `SIGNING_ACTIVE` is the single switch; tests/code-signing.test.ts
 * asserts both of its arms so the false state cannot rot into a vacuous pass.
 *
 * WHAT IS NOT ABSENT, and this is the point of publishing early: the governance
 * the terms ask about is real today. The roles below are the repository's actual
 * permissions, MFA is enforced at the organisation, releases are already a
 * deliberate human sequence. None of that waits on a certificate, and a page
 * that describes it is useful to a Windows user hitting SmartScreen whether or
 * not any foundation ever answers.
 *
 * SOURCE OF TRUTH for the roles: repository collaborator permissions on
 * github.com/libredb/libredb-studio. If those change, this file is wrong.
 */

const REPO = 'https://github.com/libredb/libredb-studio';

/**
 * Fixed by the grant, down to the punctuation. Not a sentence to improve:
 * the terms print it as the text to reproduce, so an edit here is a breach,
 * which is why the test compares it character for character.
 */
export const ATTRIBUTION = 'Free code signing provided by SignPath.io, certificate by SignPath Foundation';

/** The two names inside ATTRIBUTION are links in the terms' own rendering. */
export const ATTRIBUTION_LINKS: Record<string, string> = {
  'SignPath.io': 'https://about.signpath.io',
  'SignPath Foundation': 'https://signpath.org',
};

/**
 * Flip to `true` on the day a certificate is issued and the release workflow
 * actually signs — not on the day the acceptance email arrives. The email
 * grants the certificate; the binaries are what the sentence describes.
 */
export const SIGNING_ACTIVE = false;

/**
 * Offered by the terms as an alternative to linking a privacy policy. We do
 * both: the sentence is what they check for, the link is what a reader wants.
 * It is accurate — the application ships no telemetry, Next.js telemetry is
 * disabled in the image, and every outbound connection (a database, an optional
 * model provider) is one the operator configured.
 */
export const PRIVACY_STATEMENT =
  'This program will not transfer any information to other networked systems unless specifically requested by the user or the person installing or operating it';

export interface Role {
  role: string;
  /** The terms' own definition, so a reader can check the members against it. */
  definition: string;
  members: string[];
  /** How the role is enforced rather than merely asserted. */
  enforcement: string;
}

export const roles: Role[] = [
  {
    role: 'Authors',
    definition: 'People trusted to modify the source code in the version control system without an additional review.',
    members: ['cevheri', 'kaya-abdullah', 'yusuf-gundogdu'],
    enforcement:
      'Write access on the repository — two administrators and one maintainer. Everyone else, including the fourth organisation member, has read access and lands changes only through a pull request.',
  },
  {
    role: 'Reviewers',
    definition: 'Each change proposed by someone who is not a committer is reviewed by a team member.',
    members: ['cevheri', 'kaya-abdullah', 'yusuf-gundogdu'],
    enforcement:
      'main is protected: no direct pushes, and lint, typecheck, build, the full test suite and a secret scan must pass before a merge. An outside pull request is additionally read by one of the people above before it lands.',
  },
  {
    role: 'Approvers',
    definition: 'Each signing request is approved by a team member trusted by the entire team.',
    members: ['cevheri', 'kaya-abdullah', 'yusuf-gundogdu'],
    enforcement:
      'Three approvers, so a release is never gated on one person being available. Signing is never automatic: a release is a tag pushed by hand, and each signing request is approved individually.',
  },
];

export const codeSigningPage = {
  eyebrow: 'Code signing policy',
  headline: { before: 'Who can sign ', gradient: 'a release, and how' },
  intro:
    'LibreDB Studio publishes Windows binaries from public CI. This page states who is trusted to change the source, who approves a release for signing, and what the software does on the network — the three questions a certificate authority asks before it lends its name to a binary, and the three a cautious user should ask before running one.',

  /** The honest current state. Rewritten, not deleted, when signing goes live. */
  status: {
    kicker: SIGNING_ACTIVE ? 'Current state' : 'Current state — unsigned',
    headline: SIGNING_ACTIVE ? 'Windows builds are signed' : 'Windows builds are not signed yet',
    body: SIGNING_ACTIVE
      ? 'The Windows portable zip and the winget and Chocolatey payloads are Authenticode-signed. The private key never leaves the signing service’s HSM, and the signature is applied from the public release workflow.'
      : 'The Windows portable zip and the winget and Chocolatey payloads ship unsigned, so SmartScreen will warn on first run. That warning is correct and you should treat it as correct: verify the checksum published with the release before running the binary. An application for free open-source code signing is open; this page is written so that when it is granted, nothing about who approves a release has to change.',
    href: `${REPO}/releases`,
    linkLabel: 'Releases and checksums',
  },

  rolesHead: {
    kicker: 'Team roles',
    headline: 'Who holds which trust',
    lead: 'The definitions are the ones a signing foundation uses. The members are the repository’s actual permissions rather than a list assembled for this page — if the two ever disagree, the repository is right and this page is a bug.',
  },

  /** What happens between a commit and a signed artifact. */
  processHead: {
    kicker: 'How a release is approved',
    headline: 'Nothing signs itself',
  },
  process: [
    {
      t: 'Built from a tag, in public',
      d: 'Every artifact is produced by GitHub Actions from a pushed tag, using workflows anyone can read in the repository. Nothing is built on a maintainer’s machine and uploaded.',
    },
    {
      t: 'Multi-factor authentication, enforced',
      d: 'Two-factor authentication is required for every member of the GitHub organisation, enforced at the organisation level rather than requested. It was enabled on 2026-09-01 and applies to all four members.',
    },
    {
      t: 'Each signing request approved by hand',
      d: 'A release is never signed as a side effect of a merge. An Approver authorises each request individually, after the release assets are built and verified.',
    },
    {
      t: 'A release is never rewritten',
      d: 'Published releases and package versions are immutable here by policy: a bad release is replaced by the next patch version, never re-uploaded under the same one. A signature therefore always describes the bytes it was made for.',
    },
  ],

  privacyHead: {
    kicker: 'What the software sends',
    headline: 'Where data goes, and on whose instruction',
  },
  privacyNote:
    'LibreDB Studio is self-hosted and ships no telemetry or analytics; the container disables the framework’s own telemetry as well. It connects to the databases you configure, and to a model provider only if you configure one — both are outbound connections you set up, and the second is documented as a limit rather than a feature, because it means query content leaves the machine.',

  attributionHead: {
    kicker: 'Attribution',
    headline: 'Who pays for the certificate',
  },
} as const;
