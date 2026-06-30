/**
 * Engine: maps a parsed Command onto the LibreDB lenses and normalizes the
 * outcome into a RunResult. Pure of the DOM and the worker transport; uses the
 * browser entry's in-memory open() in tests and the OPFS-backed db at runtime.
 */
import { kv, doc, table, type Database, type TableSchema } from '@libredb/libredb/browser';
import type { Command, RunResult } from './protocol';

export const USERS_SCHEMA: TableSchema = {
  primaryKey: 'id',
  columns: { id: 'string', name: 'string', age: 'number', active: 'boolean' },
};

/** The one demo table. Keeps `select/insert/remove` from applying a schema to an unknown name. */
const TABLES: Record<string, TableSchema> = { users: USERS_SCHEMA };

export function isSeeded(db: Database): boolean {
  return kv(db).get('config:theme') !== undefined;
}

export function seed(db: Database): void {
  const store = kv(db);
  store.set('config:theme', 'dark');
  store.set('config:locale', 'en');
  store.set('config:engine', 'libredb');

  const articles = doc(db, 'articles');
  articles.put('a1', { title: 'Local-first databases', author: 'Ada', published: true });
  articles.put('a2', { title: 'OPFS in the browser', author: 'Linus', published: false });

  const users = table(db, 'users', USERS_SCHEMA);
  users.insert({ id: '1', name: 'Ada', age: 36, active: true });
  users.insert({ id: '2', name: 'Linus', age: 41, active: true });
  users.insert({ id: '3', name: 'Grace', age: 31, active: false });
}

const HELP = [
  'kv:    get <key> · put <key> <value> · delete <key> · prefix <p> · range <a> <b>',
  'doc:   doc.all <coll> · doc.get <coll> <id> · doc.put <coll> <id> <json> · doc.find <coll> <json> · doc.delete <coll> <id>',
  'table: select * from users [limit n] · insert into users <json> · delete from users <pk>',
  'meta:  help · reset',
].join('\n');

function kvRows(entries: readonly { key: string; value: string }[]): Array<Record<string, unknown>> {
  return entries.map((e) => ({ key: e.key, value: e.value }));
}

function rowsFromDocs(entries: { id: string; doc: Record<string, unknown> }[]): RunResult {
  const cols = new Set<string>(['id']);
  for (const e of entries) for (const k of Object.keys(e.doc)) cols.add(k);
  return {
    kind: 'rows',
    columns: [...cols],
    rows: entries.map((e) => ({ id: e.id, ...e.doc })),
  };
}

/** Execute a parsed command. Total: lens throws (validation, unknown table) become error results. */
export function execute(db: Database, cmd: Command): RunResult {
  try {
    switch (cmd.op) {
      case 'error':
        return { kind: 'error', error: cmd.error };
      case 'help':
        return { kind: 'message', message: HELP };
      case 'get': {
        const v = kv(db).get(cmd.key);
        return {
          kind: 'message',
          message: v === undefined ? `(nil) — no value at "${cmd.key}"` : `${cmd.key} = ${v}`,
        };
      }
      case 'put': {
        const r = kv(db).set(cmd.key, cmd.value);
        return { kind: 'message', message: `OK — set "${cmd.key}" (${r.changed} changed)` };
      }
      case 'delete': {
        const r = kv(db).delete(cmd.key);
        return { kind: 'message', message: `OK — deleted "${cmd.key}" (${r.changed} changed)` };
      }
      case 'prefix':
        return { kind: 'rows', columns: ['key', 'value'], rows: kvRows(kv(db).prefix(cmd.prefix).toArray()) };
      case 'range':
        return {
          kind: 'rows',
          columns: ['key', 'value'],
          rows: kvRows(kv(db).range(cmd.start, cmd.end).toArray()),
        };
      case 'docget': {
        const d = doc(db, cmd.collection).get(cmd.id);
        return {
          kind: 'message',
          message: d === undefined ? `(nil) — no document ${cmd.collection}:${cmd.id}` : JSON.stringify(d, null, 2),
        };
      }
      case 'docput': {
        const r = doc(db, cmd.collection).put(cmd.id, cmd.json);
        return { kind: 'message', message: `OK — put ${cmd.collection}:${cmd.id} (${r.changed} changed)` };
      }
      case 'docdel': {
        const r = doc(db, cmd.collection).delete(cmd.id);
        return { kind: 'message', message: `OK — deleted ${cmd.collection}:${cmd.id} (${r.changed} changed)` };
      }
      case 'docall':
        return rowsFromDocs(doc(db, cmd.collection).all().toArray());
      case 'docfind':
        return rowsFromDocs(doc(db, cmd.collection).find(cmd.predicate).toArray());
      case 'select': {
        const schema = TABLES[cmd.table];
        if (!schema) return { kind: 'error', error: `unknown table: ${cmd.table}. try "users".` };
        let rows = table(db, cmd.table, schema).all().toArray() as Array<Record<string, unknown>>;
        if (cmd.limit !== undefined) rows = rows.slice(0, cmd.limit);
        return { kind: 'rows', columns: Object.keys(schema.columns), rows };
      }
      case 'insert': {
        const schema = TABLES[cmd.table];
        if (!schema) return { kind: 'error', error: `unknown table: ${cmd.table}. try "users".` };
        const r = table(db, cmd.table, schema).insert(cmd.row);
        return { kind: 'message', message: `OK — inserted into ${cmd.table} (${r.changed} changed)` };
      }
      case 'remove': {
        const schema = TABLES[cmd.table];
        if (!schema) return { kind: 'error', error: `unknown table: ${cmd.table}. try "users".` };
        const r = table(db, cmd.table, schema).delete(cmd.pk);
        return { kind: 'message', message: `OK — deleted ${cmd.table}:${cmd.pk} (${r.changed} changed)` };
      }
    }
  } catch (e) {
    return { kind: 'error', error: (e as Error).message };
  }
}
