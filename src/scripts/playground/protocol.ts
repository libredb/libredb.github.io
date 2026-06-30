/**
 * Command grammar + worker message protocol for the /playground editor.
 * Pure: no DOM, no engine import. Imports only types from the browser entry.
 */
import type { Doc, Row } from '@libredb/libredb/browser';

export type Mode = 'opfs' | 'memory';

/** A parsed, executable command (or a friendly parse error). */
export type Command =
  | { op: 'get'; key: string }
  | { op: 'put'; key: string; value: string }
  | { op: 'delete'; key: string }
  | { op: 'prefix'; prefix: string }
  | { op: 'range'; start: string; end: string }
  | { op: 'docget'; collection: string; id: string }
  | { op: 'docput'; collection: string; id: string; json: Doc }
  | { op: 'docdel'; collection: string; id: string }
  | { op: 'docall'; collection: string }
  | { op: 'docfind'; collection: string; predicate: Doc }
  | { op: 'select'; table: string; limit?: number }
  | { op: 'insert'; table: string; row: Row }
  | { op: 'remove'; table: string; pk: string }
  | { op: 'help' }
  | { op: 'error'; error: string };

/** Normalized result a command produces, shaped for the grid or a console line. */
export type RunResult =
  | { kind: 'rows'; columns: string[]; rows: Array<Record<string, unknown>> }
  | { kind: 'message'; message: string }
  | { kind: 'error'; error: string };

export type WorkerRequest =
  | { id: number; op: 'ready' }
  | { id: number; op: 'run'; text: string }
  | { id: number; op: 'reset' }
  | { id: number; op: 'close' };

export type WorkerResponse =
  | { id: number; kind: 'ready'; mode: Mode }
  | { id: number; kind: 'result'; result: RunResult }
  | { id: number; kind: 'closed' };

const err = (error: string): Command => ({ op: 'error', error });

/** Parse a JSON object tail; non-objects/arrays/garbage become a friendly error. */
function parseObject(tail: string): Record<string, unknown> | { error: string } {
  let value: unknown;
  try {
    value = JSON.parse(tail);
  } catch {
    return { error: `invalid JSON: ${tail}` };
  }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return { error: 'expected a JSON object, e.g. {"key":"value"}' };
  }
  return value as Record<string, unknown>;
}

/**
 * Parse one command line. Total: never throws; unrecognized or malformed input
 * returns `{ op: "error" }` so the worker boundary stays clean.
 */
export function parseCommand(text: string): Command {
  const line = text.trim();
  if (line === '') return err("empty command — type 'help'.");

  // doc.<verb> <collection> ...
  if (line.startsWith('doc.')) {
    const [verb, ...rest] = line.split(/\s+/);
    const collection = rest[0];
    if (!collection) return err(`${verb} needs a collection — type 'help'.`);
    switch (verb) {
      case 'doc.all':
        return { op: 'docall', collection };
      case 'doc.get': {
        const id = rest[1];
        return id ? { op: 'docget', collection, id } : err('doc.get needs an id.');
      }
      case 'doc.delete': {
        const id = rest[1];
        return id ? { op: 'docdel', collection, id } : err('doc.delete needs an id.');
      }
      case 'doc.put': {
        const id = rest[1];
        if (!id) return err('doc.put needs an id and a JSON document.');
        const json = parseObject(line.slice(line.indexOf(id) + id.length).trim());
        return 'error' in json ? err(json.error) : { op: 'docput', collection, id, json };
      }
      case 'doc.find': {
        const predicate = parseObject(line.slice(line.indexOf(collection) + collection.length).trim());
        return 'error' in predicate ? err(predicate.error) : { op: 'docfind', collection, predicate };
      }
      default:
        return err(`unknown command: ${verb} — type 'help'.`);
    }
  }

  // select * from <table> [limit <n>]
  const select = /^select\s+\*\s+from\s+(\S+)(?:\s+limit\s+(\d+))?\s*$/i.exec(line);
  if (select) {
    const table = select[1];
    return select[2] ? { op: 'select', table, limit: Number(select[2]) } : { op: 'select', table };
  }

  // insert into <table> <json>
  const insert = /^insert\s+into\s+(\S+)\s+(.+)$/i.exec(line);
  if (insert) {
    const row = parseObject(insert[2]);
    return 'error' in row ? err(row.error) : { op: 'insert', table: insert[1], row };
  }

  // delete from <table> <pk>
  const remove = /^delete\s+from\s+(\S+)\s+(\S+)\s*$/i.exec(line);
  if (remove) return { op: 'remove', table: remove[1], pk: remove[2] };

  // single-keyword and kv verbs
  const [verb, ...rest] = line.split(/\s+/);
  switch (verb) {
    case 'help':
      return { op: 'help' };
    case 'get':
      return rest[0] ? { op: 'get', key: rest[0] } : err('get needs a key.');
    case 'delete':
      return rest[0] ? { op: 'delete', key: rest[0] } : err('delete needs a key.');
    case 'prefix':
      return rest[0] ? { op: 'prefix', prefix: rest[0] } : err('prefix needs a non-empty argument.');
    case 'range':
      return rest[0] && rest[1]
        ? { op: 'range', start: rest[0], end: rest[1] }
        : err('range needs a start and an end key.');
    case 'put': {
      const key = rest[0];
      if (!key) return err('put needs a key and a value.');
      const value = line.slice(line.indexOf(key) + key.length).trim();
      return value ? { op: 'put', key, value } : err('put needs a value.');
    }
    default:
      return err(`unknown command: ${verb} — type 'help'.`);
  }
}
