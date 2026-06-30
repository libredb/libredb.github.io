import { test, expect } from 'bun:test';
import { open, isReservedKey } from '@libredb/libredb/browser';
import { seed, isSeeded, execute, USERS_SCHEMA } from './engine';
import { parseCommand } from './protocol';

function seeded() {
  const db = open(); // in-memory; works under bun (no node: imports)
  seed(db);
  return db;
}
const run = (db: ReturnType<typeof open>, text: string) => execute(db, parseCommand(text));

test('schema primary key is a string column', () => {
  expect(USERS_SCHEMA.primaryKey).toBe('id');
  expect(USERS_SCHEMA.columns.id).toBe('string');
});

test('seed populates the catalog lenses and isSeeded flips', () => {
  const db = open();
  expect(isSeeded(db)).toBe(false);
  seed(db);
  expect(isSeeded(db)).toBe(true);
});

test('get returns a key/value row; missing key is a (nil) message', () => {
  const db = seeded();
  const hit = run(db, 'get config:theme');
  expect(hit).toEqual({ kind: 'rows', columns: ['key', 'value'], rows: [{ key: 'config:theme', value: 'dark' }] });
  expect(run(db, 'get config:nope').kind).toBe('message');
});

test('get on a relational key returns its JSON row, pretty-printed', () => {
  const db = seeded();
  const r = run(db, 'get users:1');
  expect(r.kind).toBe('rows');
  if (r.kind === 'rows') {
    expect(r.rows[0].key).toBe('users:1');
    expect(String(r.rows[0].value)).toContain('"name": "Ada"'); // 2-space pretty-print
  }
});

test('put / delete report changed count', () => {
  const db = seeded();
  expect(run(db, 'put config:locale tr')).toEqual({ kind: 'message', message: 'OK · changed 1' });
  expect(run(db, 'get config:locale')).toMatchObject({ rows: [{ key: 'config:locale', value: 'tr' }] });
  expect(run(db, 'delete config:locale')).toEqual({ kind: 'message', message: 'OK · changed 1' });
});

test('prefix scans a namespace — table rows live at users:<pk>', () => {
  const db = seeded();
  const r = run(db, 'prefix users:');
  expect(r.kind).toBe('rows');
  if (r.kind === 'rows') {
    expect(r.rows.map((x) => x.key)).toEqual(['users:1', 'users:2', 'users:3']);
  }
});

test('prefix articles: sees the document collection at articles:<id>', () => {
  const db = seeded();
  const r = run(db, 'prefix articles:');
  if (r.kind === 'rows') expect(r.rows.map((x) => x.key)).toEqual(['articles:a1', 'articles:a2']);
});

test('range is a full-keyspace scan and hides the reserved catalog namespace', () => {
  const db = seeded();
  // Full keyspace via the lowest..highest code points.
  const r = execute(db, { op: 'range', start: ' ', end: '\u{10FFFF}' });
  expect(r.kind).toBe('rows');
  if (r.kind === 'rows') {
    const keys = r.rows.map((x) => String(x.key));
    expect(keys.some((k) => isReservedKey(k))).toBe(false); // no catalog/reserved keys leak
    expect(keys).toContain('users:1');
    expect(keys).toContain('articles:a1');
    expect(keys).toContain('config:theme');
  }
});

test('empty prefix surfaces the lens error as an error result, never throws', () => {
  const db = seeded();
  expect(execute(db, { op: 'prefix', prefix: '' }).kind).toBe('error');
});

test('an unknown verb (e.g. SQL) is a friendly error', () => {
  const db = seeded();
  expect(run(db, 'select * from users').kind).toBe('error');
});

test('inspect lists catalogued namespaces with kind + relational schema', () => {
  const db = seeded();
  const r = run(db, 'inspect');
  expect(r.kind).toBe('rows');
  if (r.kind === 'rows') {
    const byName = Object.fromEntries(r.rows.map((x) => [x.namespace, x]));
    expect(byName['users'].kind).toBe('relational');
    expect(String(byName['users'].schema)).toContain('primaryKey');
    expect(byName['articles'].kind).toBe('document');
    expect(byName['articles'].schema).toBe(''); // documents are schemaless
  }
});

test('stats counts namespaces by kind (kv is uncatalogued → 0)', () => {
  const db = seeded();
  const r = run(db, 'stats');
  expect(r.kind).toBe('rows');
  if (r.kind === 'rows') {
    expect(r.rows[0]).toMatchObject({ namespaces: 2, kv: 0, document: 1, relational: 1, size: 'in-memory' });
  }
});

test('import sets every key in one commit, readable afterwards', () => {
  const db = seeded();
  const r = run(db, 'import {"color":"teal","mode":"dark"}');
  expect(r.kind).toBe('message');
  expect(run(db, 'get color')).toMatchObject({ rows: [{ key: 'color', value: 'teal' }] });
  expect(run(db, 'get mode')).toMatchObject({ rows: [{ key: 'mode', value: 'dark' }] });
});

test('import refuses reserved-namespace keys', () => {
  const db = seeded();
  const reservedKey = String.fromCharCode(0) + 'libredb:catalog:hack';
  expect(isReservedKey(reservedKey)).toBe(true);
  expect(execute(db, { op: 'import', entries: { [reservedKey]: 'x' } }).kind).toBe('error');
});

test('put and delete also refuse reserved-namespace keys (parity with import)', () => {
  const db = seeded();
  const reservedKey = String.fromCharCode(0) + 'libredb:catalog:theme';
  expect(execute(db, { op: 'put', key: reservedKey, value: 'x' }).kind).toBe('error');
  expect(execute(db, { op: 'delete', key: reservedKey }).kind).toBe('error');
});

test('stats reports a byte size when the worker supplies one', () => {
  const db = seeded();
  const r = execute(db, { op: 'stats' }, 412);
  if (r.kind === 'rows') expect(r.rows[0].size).toBe('412 bytes');
});
