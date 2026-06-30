/**
 * Engine: runs a parsed Command against the LibreDB kv lens and normalizes the
 * outcome into a RunResult. Mirrors Studio's LibreDBProvider (docs/providers/
 * libredb.md): one grammar over the raw keyspace, reserved (catalog) keys hidden
 * from scans via the package's `isReservedKey`, and JSON values pretty-printed.
 *
 * The seed writes through the document and relational lenses so the catalog is
 * real — but the engine reads/writes everything through the kv lens, exactly as
 * the visitor's commands do: a "table" row is just the key `users:<pk>`.
 */
import { kv, doc, table, isReservedKey, type Database, type TableSchema } from '@libredb/libredb/browser';
import type { Command, RunResult } from './protocol';

export const USERS_SCHEMA: TableSchema = {
  primaryKey: 'id',
  columns: { id: 'string', name: 'string', age: 'number', active: 'boolean' },
};

export function isSeeded(db: Database): boolean {
  return kv(db).get('config:theme') !== undefined;
}

export function seed(db: Database): void {
  // kv lens — raw key/value config.
  const store = kv(db);
  store.set('config:theme', 'dark');
  store.set('config:locale', 'en');
  store.set('config:engine', 'libredb');

  // document lens — cataloged as kind "document"; rows live at articles:<id>.
  const articles = doc(db, 'articles');
  articles.put('a1', { title: 'Local-first databases', author: 'Ada', published: true });
  articles.put('a2', { title: 'OPFS in the browser', author: 'Linus', published: false });

  // relational lens — cataloged as kind "relational" + schema; rows live at users:<pk>.
  const users = table(db, 'users', USERS_SCHEMA);
  users.insert({ id: '1', name: 'Ada', age: 36, active: true });
  users.insert({ id: '2', name: 'Linus', age: 41, active: true });
  users.insert({ id: '3', name: 'Grace', age: 31, active: false });
}

/** Pretty-print JSON values for the grid; leave non-JSON strings as-is (mirrors Studio's renderValue). */
function renderValue(value: string): string {
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}

/** Scan rows → grid rows, hiding the reserved (catalog) namespace and pretty-printing values. */
function scanRows(entries: readonly { key: string; value: string }[]): Array<Record<string, unknown>> {
  return entries.filter((e) => !isReservedKey(e.key)).map((e) => ({ key: e.key, value: renderValue(e.value) }));
}

/** Execute a parsed command. Total: a lens throw (e.g. empty prefix) becomes an error result. */
export function execute(db: Database, cmd: Command): RunResult {
  try {
    switch (cmd.op) {
      case 'error':
        return { kind: 'error', error: cmd.error };
      case 'get': {
        const v = kv(db).get(cmd.key);
        return v === undefined
          ? { kind: 'message', message: `(nil) — no key "${cmd.key}"` }
          : { kind: 'rows', columns: ['key', 'value'], rows: [{ key: cmd.key, value: renderValue(v) }] };
      }
      case 'put': {
        const r = kv(db).set(cmd.key, cmd.value);
        return { kind: 'message', message: `OK · changed ${r.changed}` };
      }
      case 'delete': {
        const r = kv(db).delete(cmd.key);
        return { kind: 'message', message: `OK · changed ${r.changed}` };
      }
      case 'prefix':
        return { kind: 'rows', columns: ['key', 'value'], rows: scanRows(kv(db).prefix(cmd.prefix).toArray()) };
      case 'range':
        return { kind: 'rows', columns: ['key', 'value'], rows: scanRows(kv(db).range(cmd.start, cmd.end).toArray()) };
    }
  } catch (e) {
    return { kind: 'error', error: (e as Error).message };
  }
}
