import { describe, expect, it } from 'bun:test';
import { engines, externalEngines, engineReference, defaultEngineId } from '../src/data/engines';
import { readFileSync, existsSync } from 'node:fs';

/**
 * The engine cards make three kinds of claim a reader can act on: which doc to
 * open, how the provider connects, and what the engine cannot do. All three
 * drifted at once against libredb-studio/docs/providers — the REFERENCE line
 * pointed at two files that do not exist, Couchbase was described as using a
 * native SDK when the provider is HTTP REST, and two cards named the wrong set
 * of engines for agent mode. These lock the shape of those claims.
 */
describe('engine reference paths', () => {
  // docs/providers/README.md § Conventions: "Filename = canonical type-id".
  // Our ids are type-ids except for these two, which are product names.
  const CANONICAL_DOC: Record<string, string> = {
    postgresql: 'docs/providers/postgres.md',
    sqlserver: 'docs/providers/mssql.md',
    mariadb: 'docs/providers/mysql.md',
  };

  it('maps the product-name ids to their canonical type-id doc', () => {
    for (const [id, expected] of Object.entries(CANONICAL_DOC)) {
      expect(engineReference(id), `${id} must not point at docs/providers/${id}.md`).toBe(expected);
    }
  });

  it('leaves every other id alone — it already is the type-id', () => {
    for (const e of engines) {
      if (e.id in CANONICAL_DOC) continue;
      expect(engineReference(e.id)).toBe(`docs/providers/${e.id}.md`);
    }
  });

  it('points the default engine at a real doc name', () => {
    expect(engineReference(defaultEngineId)).toBe('docs/providers/postgres.md');
  });
});

describe('agent mode names the same seven engines everywhere', () => {
  // Seven type-ids carry a non-null agent statement language, which is what an
  // agent run that sends statements needs: libredb-studio/src/lib/agent/
  // agent-manifest.ts, AGENT_STATEMENT_LANGUAGE. MariaDB rides the MySQL one.
  // Cards that enumerate the set must name all seven: a stale list reads as
  // "MySQL cannot", which is how the four-engine list outlived MySQL's arm.
  const AGENT_ENGINES = ['postgresql', 'mysql', 'mariadb', 'sqlite', 'duckdb', 'sqlserver', 'mongodb', 'kubernetes'];
  const NAMES = ['PostgreSQL', 'MySQL', 'SQLite', 'DuckDB', 'SQL Server', 'MongoDB', 'Kubernetes'];

  it('advertises agent mode on exactly those engines, and on no other', () => {
    const advertised = engines.filter((e) => /agent mode/i.test(e.desc)).map((e) => e.id);
    expect(advertised.sort()).toEqual([...AGENT_ENGINES].sort());
  });

  it('never enumerates the set without all seven', () => {
    const enumerations = engines.filter((e) => /agent mode sends statements only on /i.test(e.not));
    expect(enumerations.length).toBeGreaterThan(0);
    for (const e of enumerations) {
      for (const n of NAMES) expect(e.not, `${e.id}: agent mode also runs on ${n}`).toContain(n);
    }
  });
});

describe('engine card data is complete', () => {
  it('gives every engine a transport, a description and a stated limit', () => {
    for (const e of engines) {
      expect(e.tr.length, `${e.id} transport`).toBeGreaterThan(0);
      expect(e.desc.length, `${e.id} description`).toBeGreaterThan(0);
      expect(e.not.length, `${e.id} limit`).toBeGreaterThan(0);
    }
  });

  it('has no duplicate ids', () => {
    expect(new Set(engines.map((e) => e.id)).size).toBe(engines.length);
  });
});

describe('the engine count is stated consistently', () => {
  // The count appears as prose in several places. It has drifted twice — the
  // site said sixteen while docs/providers/README.md listed seventeen providers,
  // and later nineteen (LibreDB included) while the product counted eighteen.
  //
  // The rule is libredb-studio's (src/lib/db/compatibility.ts,
  // `connectableProductCount`, #424): a published count is the external engines,
  // `EXTERNAL_DATABASE_TYPES`, so the embedded store is shown but never counted.
  const WORD = 'forty-one';
  const STALE = ['seventeen engines', 'eighteen engines', 'nineteen engines'];

  it('matches the number of external engines actually defined', () => {
    expect(externalEngines.length).toBe(41);
  });

  it('flags exactly one entry as the embedded store, and it is LibreDB', () => {
    expect(engines.filter((e) => e.embedded).map((e) => e.id)).toEqual(['libredb']);
  });

  it('shows MariaDB through the MySQL driver without counting it', () => {
    const viaEngines = engines.filter((e) => e.via);
    expect(viaEngines.map((e) => [e.id, e.via])).toEqual([['mariadb', 'mysql']]);
    for (const e of viaEngines) {
      expect(externalEngines).not.toContain(e);
      expect(
        engines.some((d) => d.id === e.via && !d.via),
        `${e.id}: via names a driver engine`,
      ).toBe(true);
    }
  });

  it('is spelled the same way everywhere it is written out', () => {
    const sources = ['src/data/home.ts', 'src/data/faq.ts', 'src/data/engines.ts', 'src/data/compare.ts'] as const;
    for (const f of sources) {
      const text = readFileSync(f, 'utf8').toLowerCase();
      for (const stale of STALE) expect(text.includes(stale), `${f} still says "${stale}"`).toBe(false);
      expect(text.includes(WORD), `${f} should name the count`).toBe(true);
    }
  });

  it('derives the count on /databases instead of writing it out', () => {
    const text = readFileSync('src/pages/databases.astro', 'utf8').toLowerCase();
    for (const stale of STALE) expect(text.includes(stale), `databases.astro still says "${stale}"`).toBe(false);
    expect(text).toContain('externalengines.length');
  });

  it('keeps every engine logo pointing at a file that exists', () => {
    for (const e of engines) {
      expect(existsSync(`public${e.logo}`), `${e.id}: missing public${e.logo}`).toBe(true);
    }
  });
});
