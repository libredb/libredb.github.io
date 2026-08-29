import { describe, expect, it } from 'bun:test';
import { engines, engineReference, defaultEngineId } from '../src/data/engines';
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
  };

  it('maps the two product-name ids to their canonical type-id doc', () => {
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

describe('agent mode names the same three engines everywhere', () => {
  // Exactly three providers implement `queryReadOnly`, which is what agent mode
  // runs on: postgres.ts, sqlite.ts and duckdb/index.ts. Cards that enumerate
  // the set must name all three — a stale pair reads as "DuckDB cannot".
  const AGENT_ENGINES = ['postgresql', 'sqlite', 'duckdb'];

  it('advertises agent mode on exactly those three, and on no other', () => {
    const advertised = engines.filter((e) => /agent mode/i.test(e.desc)).map((e) => e.id);
    expect(advertised.sort()).toEqual([...AGENT_ENGINES].sort());
  });

  it('never enumerates the set without DuckDB', () => {
    const stale = engines.filter((e) => /every engine but PostgreSQL and SQLite/i.test(e.not)).map((e) => e.id);
    expect(stale, 'agent mode also runs on DuckDB').toEqual([]);
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
  // The count appears as prose in five places. It has already drifted once — the
  // site said sixteen while docs/providers/README.md listed seventeen providers,
  // because LibreDB (the embedded store /playground runs) was never added.
  const WORD = 'seventeen';

  it('matches the number of engines actually defined', () => {
    expect(engines.length).toBe(17);
  });

  it('is spelled the same way everywhere it is written out', () => {
    const sources = [
      'src/data/home.ts',
      'src/data/faq.ts',
      'src/data/engines.ts',
      'src/pages/databases.astro',
    ] as const;
    for (const f of sources) {
      const text = readFileSync(f, 'utf8').toLowerCase();
      expect(text.includes('sixteen'), `${f} still says "sixteen"`).toBe(false);
      expect(text.includes(WORD), `${f} should name the count`).toBe(true);
    }
  });

  it('keeps every engine logo pointing at a file that exists', () => {
    for (const e of engines) {
      expect(existsSync(`public${e.logo}`), `${e.id}: missing public${e.logo}`).toBe(true);
    }
  });
});
