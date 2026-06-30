/**
 * Command grammar + worker message protocol for the /playground editor.
 *
 * The grammar is LibreDB's real one — the five kv-lens verbs, mirroring Studio's
 * LibreDBProvider (docs/providers/libredb.md §5). LibreDB is an ordered key-value
 * store; "tables" and "document collections" are conventions over the keyspace
 * (`<table>:<pk>`, `<collection>:<id>`) recorded in the catalog — NOT separate
 * command dialects. So there is one grammar, not a SQL/document translator.
 *
 * Pure: no DOM, no engine import.
 */

export type Mode = 'opfs' | 'memory';

/** A parsed, executable command (or a friendly parse error). */
export type Command =
  | { op: 'get'; key: string }
  | { op: 'put'; key: string; value: string }
  | { op: 'delete'; key: string }
  | { op: 'prefix'; prefix: string }
  | { op: 'range'; start: string; end: string }
  | { op: 'inspect' }
  | { op: 'stats' }
  | { op: 'import'; entries: Record<string, string> }
  | { op: 'error'; error: string };

/** Normalized result a command produces, shaped for the grid or a console line. */
export type RunResult =
  | { kind: 'rows'; columns: string[]; rows: Array<Record<string, unknown>> }
  | { kind: 'message'; message: string; level?: 'ok' | 'warn' } // 'warn' = a destructive write (overwrite/delete)
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

const VERBS = 'get, put, delete, prefix, range, inspect, stats, import';
const err = (error: string): Command => ({ op: 'error', error });

/** Parse an `import` JSON tail into a validated object of string values (mirrors the CLI). */
function parseImport(tail: string): Command {
  let parsed: unknown;
  try {
    parsed = JSON.parse(tail);
  } catch {
    return err('import expects a JSON object of string values, e.g. import {"k":"v"}');
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return err('import expects a JSON object, e.g. import {"k":"v"}');
  }
  // Null-prototype accumulator: a literal "__proto__" key is an OWN property
  // assignment here (not the Object.prototype setter), so it imports instead of
  // silently no-op'ing.
  const entries: Record<string, string> = Object.create(null);
  for (const [k, v] of Object.entries(parsed)) {
    if (typeof v !== 'string') return err(`import value for "${k}" must be a string`);
    entries[k] = v;
  }
  return { op: 'import', entries };
}

/**
 * Quote-aware tokenizer (mirrors Studio's `tokenize`): single/double quotes
 * preserve internal whitespace, an unmatched quote is rejected, and consecutive
 * unquoted whitespace collapses to one boundary.
 */
function tokenize(line: string): { ok: true; tokens: string[] } | { ok: false; error: string } {
  const tokens: string[] = [];
  const n = line.length;
  let i = 0;
  const isSpace = (c: string) => c === ' ' || c === '\t';
  while (i < n) {
    while (i < n && isSpace(line[i])) i++;
    if (i >= n) break;
    const ch = line[i];
    let tok = '';
    if (ch === '"' || ch === "'") {
      i++;
      let closed = false;
      while (i < n) {
        if (line[i] === ch) {
          closed = true;
          i++;
          break;
        }
        tok += line[i++];
      }
      if (!closed) return { ok: false, error: 'Unmatched quote in command.' };
    } else {
      while (i < n && !isSpace(line[i])) tok += line[i++];
    }
    tokens.push(tok);
  }
  return { ok: true, tokens };
}

/** First non-blank, non-`#`-comment line — lets a commented cheatsheet buffer run its first command. */
function firstCommandLine(text: string): string | undefined {
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (line === '' || line.startsWith('#')) continue;
    return line;
  }
  return undefined;
}

/**
 * Parse one command. Total: never throws; unrecognized or malformed input
 * returns `{ op: "error" }` so the worker boundary stays clean.
 */
export function parseCommand(text: string): Command {
  const line = firstCommandLine(text);
  if (line === undefined) return err(`Empty command. Supported: ${VERBS}.`);

  // `import` takes a raw JSON tail (quotes/braces), so handle it before tokenizing.
  const imp = /^import\s+([\s\S]+)$/i.exec(line);
  if (imp) return parseImport(imp[1]);

  const t = tokenize(line);
  if (!t.ok) return err(t.error);
  const { tokens } = t;
  const verb = (tokens[0] ?? '').toLowerCase();

  switch (verb) {
    case 'inspect':
      return tokens.length === 1 ? { op: 'inspect' } : err('Usage: inspect');
    case 'stats':
      return tokens.length === 1 ? { op: 'stats' } : err('Usage: stats');
    case 'get':
      return tokens.length === 2 ? { op: 'get', key: tokens[1] } : err('Usage: get <key>');
    case 'delete':
      return tokens.length === 2 ? { op: 'delete', key: tokens[1] } : err('Usage: delete <key>');
    case 'prefix':
      return tokens.length === 2 ? { op: 'prefix', prefix: tokens[1] } : err('Usage: prefix <prefix>');
    case 'range':
      return tokens.length === 3
        ? { op: 'range', start: tokens[1], end: tokens[2] }
        : err('Usage: range <start> <end>');
    case 'put':
      return tokens.length >= 3
        ? { op: 'put', key: tokens[1], value: tokens.slice(2).join(' ') }
        : err('Usage: put <key> <value>');
    default:
      return err(`Unknown command "${tokens[0] ?? ''}". Supported: ${VERBS}.`);
  }
}
