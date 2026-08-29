/**
 * Page-only content for /open-source.
 *
 * The homepage section (home.ts → openSource) carries the comparison table and
 * the headline stats, lifted from the design handoff. This file holds what a
 * dedicated page owes on top of it: what the licence actually permits, how the
 * project is contributed to, and how a vulnerability is reported.
 *
 * Sources: libredb-studio LICENSE, CONTRIBUTING.md, SECURITY.md and
 * CODE_OF_CONDUCT.md. Nothing here restates a claim the homepage already makes.
 */

/** The four permissions people actually ask about, in the order they ask. */
export const licenceGrants = [
  {
    t: 'Run it commercially',
    d: 'Inside a company, for paying customers, on infrastructure you bill for. No seat count, no revenue ceiling, no separate commercial licence to buy.',
  },
  {
    t: 'Modify and fork it',
    d: 'Change any part of it and ship the result. You are not required to contribute the change back, and nothing in the licence reaches into the code you wrote around it.',
  },
  {
    t: 'Embed it in your product',
    d: 'The npm package exists for exactly this. Your product does not inherit the licence — MIT is not copyleft.',
  },
  {
    t: 'Redistribute it',
    d: 'Republish it, repackage it, resell it. Keep the copyright notice and the licence text with it; that is the whole obligation.',
  },
] as const;

/** How work actually reaches the repository. */
export const contributing = [
  {
    t: 'Report a bug',
    d: 'Open an issue with the version, the engine, the steps and what you expected instead. Reproduction beats description.',
    href: 'https://github.com/libredb/libredb-studio/issues/new',
    cta: 'Open an issue ↗',
  },
  {
    t: 'Propose a feature',
    d: 'Describe the problem before the solution. A feature request that names the workflow it unblocks gets read differently from one that names a control.',
    href: 'https://github.com/libredb/libredb-studio/issues/new',
    cta: 'Start a proposal ↗',
  },
  {
    t: 'Send a pull request',
    d: 'The contributing guide covers the development setup, the environment variables, the local database, the coding guidelines and the commit convention.',
    href: 'https://github.com/libredb/libredb-studio/blob/main/CONTRIBUTING.md',
    cta: 'Read CONTRIBUTING ↗',
  },
  {
    t: 'Add a database provider',
    d: 'The provider interface is documented end to end, including what a provider must declare it cannot do — capability flags are how the honest-limits claim is kept.',
    href: 'https://github.com/libredb/libredb-studio/blob/main/docs/ADDING_A_PROVIDER.md',
    cta: 'Read the provider guide ↗',
  },
] as const;

/** Vulnerability reporting, stated the way the policy states it. */
export const security = {
  headline: 'Found a vulnerability? Do not open an issue.',
  body: 'Security reports go to the vendor by email, not through the public tracker, so a fix can ship before the details are public. The policy covers what to include, what to expect and the disclosure timeline.',
  email: 'info@sekoya.tech',
  note: 'Security updates are provided for the current minor line; older lines are not patched. The policy also documents the known security considerations and publishes a software bill of materials.',
} as const;
