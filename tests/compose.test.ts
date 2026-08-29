import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { composeGroups, composeQuickStart } from '../src/data/compose';
import site from '../site.config.json' with { type: 'json' };

const yaml = readFileSync('src/data/docker-compose.example.yml', 'utf8');

/**
 * /docker-compose exists because people search for "libredb studio docker
 * compose" and want the file, not a tour of it. So the two failures that matter
 * are: the file we show is not the file that runs, and the variable table
 * describes something the image never reads.
 *
 * The compose file is a verbatim copy of libredb-studio's. These tests cannot
 * reach that repository, so they pin the shape instead — enough that a partial
 * or mangled copy fails here rather than in someone's terminal.
 */

/**
 * Every VAR Studio itself reads, live or commented out.
 *
 * Scoped to the `libredb-studio` service's `environment:` block on purpose: the
 * optional bundled postgres service further down sets POSTGRES_USER and friends,
 * and those configure that container, not Studio. Documenting them on the page
 * would tell people to set variables the image never looks at.
 */
const envBlock = (() => {
  const start = yaml.indexOf('    environment:');
  const end = yaml.indexOf('    # volumes:', start);
  expect(start, 'the environment block moved').toBeGreaterThan(-1);
  expect(end, 'the volumes comment that ends the block moved').toBeGreaterThan(start);
  return yaml.slice(start, end);
})();

const declared = new Set([...envBlock.matchAll(/^\s*#?\s*([A-Z][A-Z0-9_]{2,}):/gm)].map((m) => m[1]));

const documented = composeGroups.flatMap((g) => g.vars);

describe('the compose file is intact', () => {
  it('is the published image, not a source build', () => {
    expect(yaml).toContain('image: ghcr.io/libredb/libredb-studio:latest');
    expect(yaml, 'a build: stanza means someone swapped in a local build').not.toMatch(/^\s{4}build:/m);
  });

  it('refuses to start without the two secrets', () => {
    // `:?` is compose's "fail loudly if unset". Downgrading either of these to a
    // `:-default` would ship every reader the same admin password.
    expect(yaml).toMatch(/ADMIN_PASSWORD: \$\{ADMIN_PASSWORD:\?/);
    expect(yaml).toMatch(/JWT_SECRET: \$\{JWT_SECRET:\?/);
  });

  it('hardcodes no secret value', () => {
    for (const key of ['ADMIN_PASSWORD', 'JWT_SECRET', 'USER_PASSWORD', 'LLM_API_KEY', 'OIDC_CLIENT_SECRET']) {
      const line = new RegExp(`^\\s*#?\\s*${key}: (?!\\$\\{)(?!$).+$`, 'm');
      expect(yaml, `${key} has a literal value`).not.toMatch(line);
    }
  });

  it('keeps the healthcheck, since the PaaS templates wait on it', () => {
    expect(yaml).toContain('healthcheck:');
    expect(yaml).toContain('/api/db/health');
  });
});

describe('the table on the page matches the file', () => {
  it('documents no variable the file never mentions', () => {
    const extra = documented.map((v) => v.name).filter((n) => !declared.has(n));
    expect(extra).toEqual([]);
  });

  it('omits no variable the file offers', () => {
    const names = new Set(documented.map((v) => v.name));
    const missing = [...declared].filter((n) => !names.has(n));
    expect(missing).toEqual([]);
  });

  it('marks a variable "set" only when its line really is uncommented', () => {
    for (const v of documented) {
      const live = new RegExp(`^\\s+${v.name}:`, 'm').test(yaml);
      expect(live, `${v.name} is ${live ? 'live' : 'commented'} in the file but labelled "${v.state}"`).toBe(
        v.state === 'active',
      );
    }
  });

  it('names each variable once', () => {
    const names = documented.map((v) => v.name);
    expect(names.length).toBe(new Set(names).size);
  });
});

describe('the quick start actually works', () => {
  it('downloads from this site, so the mirror is what gets run', () => {
    expect(composeQuickStart).toContain(`${site.url}/docker-compose.example.yml`);
  });

  it('renames the file to the one compose reads by default', () => {
    expect(composeQuickStart).toContain('mv docker-compose.example.yml docker-compose.yml');
  });

  it('writes both required secrets before bringing the stack up', () => {
    const env = composeQuickStart.indexOf('.env');
    const up = composeQuickStart.indexOf('docker compose up');
    expect(env).toBeGreaterThan(-1);
    expect(up).toBeGreaterThan(env);
    expect(composeQuickStart).toContain('ADMIN_PASSWORD=');
    expect(composeQuickStart).toContain('JWT_SECRET=');
  });
});

describe('the mirror is actually served', () => {
  it('publishes the raw file byte-for-byte at the URL the quick start curls', () => {
    // Both the page and this file come from one `?raw` import, so the only way
    // they diverge is the endpoint disappearing — which the quick start would
    // not survive, and nothing else in the suite would notice.
    expect(readFileSync('dist/docker-compose.example.yml', 'utf8')).toBe(yaml);
  });

  it('keeps it out of the sitemap, since it is a download and not a page', () => {
    expect(readFileSync('dist/sitemap-0.xml', 'utf8')).not.toContain('docker-compose.example.yml');
  });
});
