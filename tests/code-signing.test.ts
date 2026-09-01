import { describe, expect, it } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { parseHTML } from 'linkedom';
import { ATTRIBUTION, ATTRIBUTION_LINKS, PRIVACY_STATEMENT, SIGNING_ACTIVE, roles } from '../src/data/code-signing';

/**
 * The SignPath Foundation grant is conditional, and its conditions land on this
 * site rather than in the product. This file is where they are pinned.
 *
 * Every assertion below transcribes a sentence from https://signpath.org/terms.html,
 * read live on 2026-09-01. They are quoted in the `it` names so a future reader
 * can tell a requirement from a preference without opening the terms.
 *
 * The awkward one is placement. The attribution is a statement of fact — the
 * binaries either are signed by SignPath or they are not — so it cannot go up
 * before the grant lands, and a test that only checks "it appears" would pass
 * vacuously today and silently stop meaning anything the day it flips. So the
 * placement test asserts BOTH arms off `SIGNING_ACTIVE`: present everywhere when
 * true, absent everywhere when false. The wording itself is checked
 * unconditionally, because the string is the part that must survive an edit.
 */

const page = (path: string) => parseHTML(readFileSync(path, 'utf8')).document;

/**
 * The attribution is one sentence split across two links, so the markup carries
 * newlines and indentation inside it. HTML collapses any run of whitespace to a
 * single space when it renders, and the requirement is about the rendered
 * sentence — so the comparison collapses it too. This is not a loosening: a
 * space in the wrong PLACE still fails, which is how the missing-comma-hug bug
 * was caught. Only the width of an existing gap is normalised.
 */
const rendered = (path: string) => (page(path).body.textContent ?? '').replace(/\s+/g, ' ');

const HOME = 'dist/index.html';
const POLICY = 'dist/code-signing-policy/index.html';
const DOWNLOAD = 'dist/deploy/index.html';

/** Repository permission, read from the GitHub API on 2026-09-01. The published
 *  roles are a claim about who may do what; if they drift from the repository,
 *  the claim is false, so the mapping is pinned rather than trusted. */
const REPO_PERMISSION: Record<string, 'admin' | 'maintain' | 'read'> = {
  cevheri: 'admin',
  'kaya-abdullah': 'admin',
  'yusuf-gundogdu': 'maintain',
  mfatihdayan: 'read',
};

const roleNamed = (name: string) => {
  const found = roles.find((r) => r.role === name);
  if (!found) throw new Error(`no published role named ${name}`);
  return found;
};

describe('attribution wording — "Free code signing provided by SignPath.io, certificate by SignPath Foundation"', () => {
  it('keeps the sentence verbatim, including the two product names', () => {
    expect(ATTRIBUTION).toBe('Free code signing provided by SignPath.io, certificate by SignPath Foundation');
  });

  it('points each name at the host the terms link it to', () => {
    expect(ATTRIBUTION_LINKS['SignPath.io']).toBe('https://about.signpath.io');
    expect(ATTRIBUTION_LINKS['SignPath Foundation']).toBe('https://signpath.org');
  });
});

describe('team roles — "Authors", "Reviewers", "Approvers", published', () => {
  it('publishes all three roles the terms name, and nothing invented beside them', () => {
    expect(roles.map((r) => r.role)).toEqual(['Authors', 'Reviewers', 'Approvers']);
  });

  it('gives every role at least one named member', () => {
    for (const r of roles) expect(r.members.length, `${r.role} has no members`).toBeGreaterThan(0);
  });

  it('names only people who are actually in the organisation', () => {
    for (const r of roles) {
      for (const m of r.members) {
        expect(Object.keys(REPO_PERMISSION), `${r.role}: ${m}`).toContain(m);
      }
    }
  });

  it('restricts Authors to accounts that can actually write — "trusted to modify the source code"', () => {
    // A read-only account published as an Author is a false claim about who can
    // land a commit, and it is the discrepancy a reviewer checks first.
    for (const m of roleNamed('Authors').members) {
      expect(REPO_PERMISSION[m], `${m} is published as an Author`).not.toBe('read');
    }
  });

  it('keeps Approvers a subset of Authors — a signing request is approved by someone who ships', () => {
    for (const m of roleNamed('Approvers').members) {
      expect(roleNamed('Authors').members).toContain(m);
    }
  });

  it('keeps more than one Approver, so a release is not gated on one person', () => {
    expect(roleNamed('Approvers').members.length).toBeGreaterThanOrEqual(2);
  });
});

describe('the published page', () => {
  it('is built at /code-signing-policy', () => {
    expect(existsSync(POLICY), `${POLICY} was not built`).toBe(true);
  });

  it('carries the term "Code signing policy" on the home page, as the terms require', () => {
    // "Please add the term 'Code signing policy' on your project's home page" —
    // as a section header or a link to a dedicated page. This is the link arm.
    const home = page(HOME);
    const link = [...home.querySelectorAll('a')].find((a) => a.getAttribute('href') === '/code-signing-policy');
    expect(link, 'no link to /code-signing-policy on the home page').toBeTruthy();
    expect(link?.textContent?.trim().toLowerCase()).toBe('code signing policy');
  });

  it('lists every role and every member on the policy page itself', () => {
    const text = rendered(POLICY);
    for (const r of roles) {
      expect(text, `role ${r.role} missing`).toContain(r.role);
      for (const m of r.members) expect(text, `member ${m} missing`).toContain(m);
    }
  });

  it('carries the privacy statement the terms accept, verbatim', () => {
    expect(PRIVACY_STATEMENT).toBe(
      'This program will not transfer any information to other networked systems unless specifically requested by the user or the person installing or operating it',
    );
    expect(rendered(POLICY)).toContain(PRIVACY_STATEMENT);
  });

  it('links the privacy policy too, which the terms offer as the alternative', () => {
    const hrefs = [...page(POLICY).querySelectorAll('a')].map((a) => a.getAttribute('href'));
    expect(hrefs).toContain('/privacy-policy');
  });
});

describe('attribution placement follows SIGNING_ACTIVE, in both directions', () => {
  const surfaces = [
    ['home page', HOME],
    ['download page', DOWNLOAD],
    ['policy page', POLICY],
  ] as const;

  it(
    SIGNING_ACTIVE
      ? 'shows the attribution on the home page and the download page, as the terms require'
      : 'shows the attribution nowhere, because the binaries are not signed by SignPath yet',
    () => {
      for (const [name, path] of surfaces) {
        expect(rendered(path).includes(ATTRIBUTION), `${name}: attribution`).toBe(SIGNING_ACTIVE);
      }
    },
  );

  it('never claims signing anywhere while the grant is pending', () => {
    if (SIGNING_ACTIVE) return;
    for (const [name, path] of surfaces) {
      expect(rendered(path).toLowerCase().includes('signpath'), `${name}: names the provider`).toBe(false);
    }
  });
});
