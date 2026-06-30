import { test, expect } from 'bun:test';
import { open } from '@libredb/libredb/browser';
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

test('seed populates all three lenses and isSeeded flips', () => {
  const db = open();
  expect(isSeeded(db)).toBe(false);
  seed(db);
  expect(isSeeded(db)).toBe(true);
});

test('kv get / put / prefix', () => {
  const db = seeded();
  expect(run(db, 'get config:theme')).toEqual({ kind: 'message', message: 'config:theme = dark' });
  expect(run(db, 'put config:locale tr')).toMatchObject({ kind: 'message' });
  expect(run(db, 'get config:locale')).toEqual({ kind: 'message', message: 'config:locale = tr' });
  const prefixed = run(db, 'prefix config:');
  expect(prefixed.kind).toBe('rows');
  if (prefixed.kind === 'rows') {
    expect(prefixed.columns).toEqual(['key', 'value']);
    expect(prefixed.rows.length).toBeGreaterThanOrEqual(3);
  }
});

test('relational select / insert / remove round-trips', () => {
  const db = seeded();
  const before = run(db, 'select * from users');
  expect(before.kind).toBe('rows');
  if (before.kind === 'rows') expect(before.rows.length).toBe(3);

  run(db, 'insert into users {"id":"4","name":"Lin","age":29,"active":true}');
  const after = run(db, 'select * from users');
  if (after.kind === 'rows') expect(after.rows.length).toBe(4);

  const limited = run(db, 'select * from users limit 2');
  if (limited.kind === 'rows') expect(limited.rows.length).toBe(2);

  run(db, 'delete from users 4');
  const final = run(db, 'select * from users');
  if (final.kind === 'rows') expect(final.rows.length).toBe(3);
});

test('document all / find / put', () => {
  const db = seeded();
  const all = run(db, 'doc.all articles');
  expect(all.kind).toBe('rows');
  if (all.kind === 'rows') expect(all.rows.length).toBe(2);
  const published = run(db, 'doc.find articles {"published":true}');
  if (published.kind === 'rows') expect(published.rows.length).toBe(1);
});

test('unknown table is a friendly error, not a throw', () => {
  const db = seeded();
  expect(run(db, 'select * from ghosts').kind).toBe('error');
});

test('insert validation errors surface as error result, never throw', () => {
  const db = seeded();
  expect(run(db, 'insert into users {"id":"x"}').kind).toBe('error');
});

test('help returns a message listing commands', () => {
  const db = seeded();
  const r = run(db, 'help');
  expect(r.kind).toBe('message');
  if (r.kind === 'message') expect(r.message).toContain('get');
});
