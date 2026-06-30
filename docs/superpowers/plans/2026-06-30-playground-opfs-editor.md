# /playground OPFS Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a public `/playground` route that runs a real OPFS-backed LibreDB entirely in the browser — preloaded sample data, a clickable command cheatsheet, reset, and graceful in-memory fallback — with no backend and no login.

**Architecture:** A SSR-safe Astro page reuses the site's `StudioShell` chrome and mounts a client-only island. The engine runs in a Web Worker (OPFS sync-access handles are Worker-only); the UI talks to it over `postMessage`. Pure, testable modules (`protocol`, `engine`) hold the command grammar and lens dispatch; the worker and client are thin shells around them.

**Tech Stack:** Astro 7 (static, no React), TypeScript (strict), Tailwind 4, `@libredb/libredb@0.1.3` (`/browser` entry), `bun:test`, Playwright (MCP) for browser verification.

## Global Constraints

- Import the engine **only** from `@libredb/libredb/browser` (its import graph reaches no `node:` module). Never import the bare `@libredb/libredb`.
- **No engine/DOM/Worker code may run during SSR.** All engine code lives in the Worker or in client `<script>` blocks that touch `navigator`/`Worker` only after load — never in Astro frontmatter.
- The Worker is the **single owner** of the OPFS sync-access handle. OPFS file name: `playground.libredb`.
- On any failure acquiring the handle (unsupported browser, insecure context, second-tab exclusive-lock contention) → fall back to in-memory `open()` and report `mode: "memory"`.
- Call `db.close()` on worker teardown so the exclusive lock frees for the next reload.
- Homepage / marketing build must stay unaffected. The route name is exactly `/playground`.
- The repo's build mutates two tracked `docker-compose.example.yml` files via `scripts/sync-docker-compose.mjs`; revert them after any `bun run build` so the branch stays clean.
- Verify with `bun run gate` (typecheck + format + lint + knip + test) before claiming done.

## Verified `@libredb/libredb/browser` API (0.1.3)

```ts
import { open, opfsFileSystem, kv, doc, table } from "@libredb/libredb/browser";
import type { Database, TableSchema, Row, Doc, SyncAccessHandle } from "@libredb/libredb/browser";

open(): Database                                  // in-memory, works anywhere (incl. bun)
open({ path, fs }): Database                      // durable; fs REQUIRED with path
opfsFileSystem(handle: SyncAccessHandle): FileSystem
db.close(): void

kv(db).get(key): string | undefined
kv(db).set(key, value): { changed: number }
kv(db).delete(key): { changed: number }
kv(db).prefix(p): { toArray(): { key: string; value: string }[] }   // throws if p === ""
kv(db).range(start, end): { toArray(): { key: string; value: string }[] }

doc(db, coll).put(id, docObj): { changed }
doc(db, coll).get(id): Doc | undefined
doc(db, coll).delete(id): { changed }
doc(db, coll).all(): { toArray(): { id: string; doc: Doc }[] }
doc(db, coll).find(predicate): { toArray(): { id: string; doc: Doc }[] }

table(db, name, schema).insert(row): { changed }   // throws on invalid/unknown field
table(db, name, schema).get(pk): Row | undefined
table(db, name, schema).delete(pk): { changed }
table(db, name, schema).all(): { toArray(): Row[] }
// TableSchema = { primaryKey: string; columns: Record<string,"string"|"number"|"boolean"|"object"> }
// primaryKey column must be type "string".
```

## File Structure

| File | Responsibility |
| --- | --- |
| `src/scripts/playground/protocol.ts` | **Pure.** Message types (`WorkerRequest`/`WorkerResponse`/`Mode`/`RunResult`), `Command` union, `parseCommand(text): Command`. No DOM, no engine import. |
| `src/scripts/playground/protocol.test.ts` | `bun:test` for `parseCommand`. |
| `src/scripts/playground/engine.ts` | Lens dispatch: `USERS_SCHEMA`, `seed(db)`, `isSeeded(db)`, `execute(db, cmd): RunResult`. Imports `@libredb/libredb/browser`. |
| `src/scripts/playground/engine.test.ts` | `bun:test` against an in-memory `open()` db. |
| `src/scripts/playground/db.worker.ts` | Worker shell: boot (OPFS→memory fallback), seed-if-empty, message loop (`run`/`reset`/`close`/`ready`), `db.close()` teardown. |
| `src/scripts/playground/client.ts` | Main-thread bridge: spawn worker, `call()` with ids, wire editor/cheatsheet/reset, render grid + console, persistence badge/banner, `pagehide` teardown. |
| `src/components/studio/Cheatsheet.astro` | Clickable command list grouped per lens; each button has `data-cmd`. |
| `src/components/studio/Playground.astro` | Editor pane markup (command input, Run, result grid, badge/banner, Reset) + mounts `Cheatsheet`; includes the client `<script>`. |
| `src/pages/playground.astro` | Route; wraps `Playground` in `StudioShell`; SEO title/description. |
| `package.json` | Add `@libredb/libredb@0.1.3` (already installed during planning). |
| `src/components/studio/TopBar.astro` | Add a `/playground` nav link (homepage/sections nav data untouched). |

---

## Task 1: Command protocol & parser (pure, TDD)

**Files:**
- Create: `src/scripts/playground/protocol.ts`
- Test: `src/scripts/playground/protocol.test.ts`

**Interfaces:**
- Produces: `parseCommand(text: string): Command`; types `Command`, `RunResult`, `WorkerRequest`, `WorkerResponse`, `Mode`.

- [ ] **Step 1: Write the failing test** — `src/scripts/playground/protocol.test.ts`

```ts
import { test, expect } from "bun:test";
import { parseCommand } from "./protocol";

test("get parses key", () => {
  expect(parseCommand("get config:theme")).toEqual({ op: "get", key: "config:theme" });
});

test("put captures the whole value tail", () => {
  expect(parseCommand("put config:theme dark mode")).toEqual({
    op: "put", key: "config:theme", value: "dark mode",
  });
});

test("delete / prefix / range", () => {
  expect(parseCommand("delete config:theme")).toEqual({ op: "delete", key: "config:theme" });
  expect(parseCommand("prefix config:")).toEqual({ op: "prefix", prefix: "config:" });
  expect(parseCommand("range a z")).toEqual({ op: "range", start: "a", end: "z" });
});

test("doc family", () => {
  expect(parseCommand("doc.all articles")).toEqual({ op: "docall", collection: "articles" });
  expect(parseCommand("doc.get articles a1")).toEqual({ op: "docget", collection: "articles", id: "a1" });
  expect(parseCommand("doc.delete articles a1")).toEqual({ op: "docdel", collection: "articles", id: "a1" });
  expect(parseCommand('doc.put articles a3 {"title":"Hi"}')).toEqual({
    op: "docput", collection: "articles", id: "a3", json: { title: "Hi" },
  });
  expect(parseCommand('doc.find articles {"published":true}')).toEqual({
    op: "docfind", collection: "articles", predicate: { published: true },
  });
});

test("relational family", () => {
  expect(parseCommand("select * from users")).toEqual({ op: "select", table: "users" });
  expect(parseCommand("select * from users limit 2")).toEqual({ op: "select", table: "users", limit: 2 });
  expect(parseCommand('insert into users {"id":"4","name":"Lin","age":29,"active":true}')).toEqual({
    op: "insert", table: "users", row: { id: "4", name: "Lin", age: 29, active: true },
  });
  expect(parseCommand("delete from users 4")).toEqual({ op: "remove", table: "users", pk: "4" });
});

test("help", () => {
  expect(parseCommand("help")).toEqual({ op: "help" });
});

test("empty input is an error", () => {
  expect(parseCommand("   ")).toEqual({ op: "error", error: "empty command — type 'help'." });
});

test("unknown verb is a friendly error", () => {
  expect(parseCommand("frobnicate x")).toMatchObject({ op: "error" });
});

test("invalid JSON tail is a friendly error, never a throw", () => {
  expect(parseCommand("doc.put articles a3 {not json}")).toMatchObject({ op: "error" });
  expect(parseCommand('insert into users ["not","an","object"]')).toMatchObject({ op: "error" });
});

test("prefix requires a non-empty argument", () => {
  expect(parseCommand("prefix")).toMatchObject({ op: "error" });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/scripts/playground/protocol.test.ts`
Expected: FAIL — `Cannot find module "./protocol"`.

- [ ] **Step 3: Write the implementation** — `src/scripts/playground/protocol.ts`

```ts
/**
 * Command grammar + worker message protocol for the /playground editor.
 * Pure: no DOM, no engine import. Imports only types from the browser entry.
 */
import type { Doc, Row } from "@libredb/libredb/browser";

export type Mode = "opfs" | "memory";

/** A parsed, executable command (or a friendly parse error). */
export type Command =
  | { op: "get"; key: string }
  | { op: "put"; key: string; value: string }
  | { op: "delete"; key: string }
  | { op: "prefix"; prefix: string }
  | { op: "range"; start: string; end: string }
  | { op: "docget"; collection: string; id: string }
  | { op: "docput"; collection: string; id: string; json: Doc }
  | { op: "docdel"; collection: string; id: string }
  | { op: "docall"; collection: string }
  | { op: "docfind"; collection: string; predicate: Doc }
  | { op: "select"; table: string; limit?: number }
  | { op: "insert"; table: string; row: Row }
  | { op: "remove"; table: string; pk: string }
  | { op: "help" }
  | { op: "error"; error: string };

/** Normalized result a command produces, shaped for the grid or a console line. */
export type RunResult =
  | { kind: "rows"; columns: string[]; rows: Array<Record<string, unknown>> }
  | { kind: "message"; message: string }
  | { kind: "error"; error: string };

export type WorkerRequest =
  | { id: number; op: "ready" }
  | { id: number; op: "run"; text: string }
  | { id: number; op: "reset" }
  | { id: number; op: "close" };

export type WorkerResponse =
  | { id: number; kind: "ready"; mode: Mode }
  | { id: number; kind: "result"; result: RunResult }
  | { id: number; kind: "closed" };

const err = (error: string): Command => ({ op: "error", error });

/** Parse a JSON object tail; non-objects/arrays/garbage become a friendly error. */
function parseObject(tail: string): Record<string, unknown> | { error: string } {
  let value: unknown;
  try {
    value = JSON.parse(tail);
  } catch {
    return { error: `invalid JSON: ${tail}` };
  }
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return { error: "expected a JSON object, e.g. {\"key\":\"value\"}" };
  }
  return value as Record<string, unknown>;
}

/**
 * Parse one command line. Total: never throws; unrecognized or malformed input
 * returns `{ op: "error" }` so the worker boundary stays clean.
 */
export function parseCommand(text: string): Command {
  const line = text.trim();
  if (line === "") return err("empty command — type 'help'.");

  // doc.<verb> <collection> ...
  if (line.startsWith("doc.")) {
    const [verb, ...rest] = line.split(/\s+/);
    const collection = rest[0];
    if (!collection) return err(`${verb} needs a collection — type 'help'.`);
    switch (verb) {
      case "doc.all":
        return { op: "docall", collection };
      case "doc.get": {
        const id = rest[1];
        return id ? { op: "docget", collection, id } : err("doc.get needs an id.");
      }
      case "doc.delete": {
        const id = rest[1];
        return id ? { op: "docdel", collection, id } : err("doc.delete needs an id.");
      }
      case "doc.put": {
        const id = rest[1];
        if (!id) return err("doc.put needs an id and a JSON document.");
        const json = parseObject(line.slice(line.indexOf(id) + id.length).trim());
        return "error" in json ? err(json.error) : { op: "docput", collection, id, json };
      }
      case "doc.find": {
        const predicate = parseObject(line.slice(line.indexOf(collection) + collection.length).trim());
        return "error" in predicate ? err(predicate.error) : { op: "docfind", collection, predicate };
      }
      default:
        return err(`unknown command: ${verb} — type 'help'.`);
    }
  }

  // select * from <table> [limit <n>]
  const select = /^select\s+\*\s+from\s+(\S+)(?:\s+limit\s+(\d+))?\s*$/i.exec(line);
  if (select) {
    const table = select[1];
    return select[2] ? { op: "select", table, limit: Number(select[2]) } : { op: "select", table };
  }

  // insert into <table> <json>
  const insert = /^insert\s+into\s+(\S+)\s+(.+)$/i.exec(line);
  if (insert) {
    const row = parseObject(insert[2]);
    return "error" in row ? err(row.error) : { op: "insert", table: insert[1], row };
  }

  // delete from <table> <pk>
  const remove = /^delete\s+from\s+(\S+)\s+(\S+)\s*$/i.exec(line);
  if (remove) return { op: "remove", table: remove[1], pk: remove[2] };

  // single-keyword and kv verbs
  const [verb, ...rest] = line.split(/\s+/);
  switch (verb) {
    case "help":
      return { op: "help" };
    case "get":
      return rest[0] ? { op: "get", key: rest[0] } : err("get needs a key.");
    case "delete":
      return rest[0] ? { op: "delete", key: rest[0] } : err("delete needs a key.");
    case "prefix":
      return rest[0] ? { op: "prefix", prefix: rest[0] } : err("prefix needs a non-empty argument.");
    case "range":
      return rest[0] && rest[1]
        ? { op: "range", start: rest[0], end: rest[1] }
        : err("range needs a start and an end key.");
    case "put": {
      const key = rest[0];
      if (!key) return err("put needs a key and a value.");
      const value = line.slice(line.indexOf(key) + key.length).trim();
      return value ? { op: "put", key, value } : err("put needs a value.");
    }
    default:
      return err(`unknown command: ${verb} — type 'help'.`);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/scripts/playground/protocol.test.ts`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
git add src/scripts/playground/protocol.ts src/scripts/playground/protocol.test.ts
git commit -m "feat(playground): command grammar + worker protocol parser (#19)"
```

---

## Task 2: Engine — seed, isSeeded, execute (TDD against in-memory db)

**Files:**
- Create: `src/scripts/playground/engine.ts`
- Test: `src/scripts/playground/engine.test.ts`

**Interfaces:**
- Consumes: `Command`, `RunResult` from `./protocol`.
- Produces: `USERS_SCHEMA`, `seed(db: Database): void`, `isSeeded(db: Database): boolean`, `execute(db: Database, cmd: Command): RunResult`.

- [ ] **Step 1: Write the failing test** — `src/scripts/playground/engine.test.ts`

```ts
import { test, expect } from "bun:test";
import { open } from "@libredb/libredb/browser";
import { seed, isSeeded, execute, USERS_SCHEMA } from "./engine";
import { parseCommand } from "./protocol";

function seeded() {
  const db = open(); // in-memory; works under bun (no node: imports)
  seed(db);
  return db;
}
const run = (db: ReturnType<typeof open>, text: string) => execute(db, parseCommand(text));

test("schema primary key is a string column", () => {
  expect(USERS_SCHEMA.primaryKey).toBe("id");
  expect(USERS_SCHEMA.columns.id).toBe("string");
});

test("seed populates all three lenses and isSeeded flips", () => {
  const db = open();
  expect(isSeeded(db)).toBe(false);
  seed(db);
  expect(isSeeded(db)).toBe(true);
});

test("kv get / put / prefix", () => {
  const db = seeded();
  expect(run(db, "get config:theme")).toEqual({ kind: "message", message: "config:theme = dark" });
  expect(run(db, "put config:locale tr")).toMatchObject({ kind: "message" });
  expect(run(db, "get config:locale")).toEqual({ kind: "message", message: "config:locale = tr" });
  const prefixed = run(db, "prefix config:");
  expect(prefixed.kind).toBe("rows");
  if (prefixed.kind === "rows") {
    expect(prefixed.columns).toEqual(["key", "value"]);
    expect(prefixed.rows.length).toBeGreaterThanOrEqual(3);
  }
});

test("relational select / insert / remove round-trips", () => {
  const db = seeded();
  const before = run(db, "select * from users");
  expect(before.kind).toBe("rows");
  if (before.kind === "rows") expect(before.rows.length).toBe(3);

  run(db, 'insert into users {"id":"4","name":"Lin","age":29,"active":true}');
  const after = run(db, "select * from users");
  if (after.kind === "rows") expect(after.rows.length).toBe(4);

  const limited = run(db, "select * from users limit 2");
  if (limited.kind === "rows") expect(limited.rows.length).toBe(2);

  run(db, "delete from users 4");
  const final = run(db, "select * from users");
  if (final.kind === "rows") expect(final.rows.length).toBe(3);
});

test("document all / find / put", () => {
  const db = seeded();
  const all = run(db, "doc.all articles");
  expect(all.kind).toBe("rows");
  if (all.kind === "rows") expect(all.rows.length).toBe(2);
  const published = run(db, 'doc.find articles {"published":true}');
  if (published.kind === "rows") expect(published.rows.length).toBe(1);
});

test("unknown table is a friendly error, not a throw", () => {
  const db = seeded();
  expect(run(db, "select * from ghosts").kind).toBe("error");
});

test("insert validation errors surface as error result, never throw", () => {
  const db = seeded();
  expect(run(db, 'insert into users {"id":"x"}').kind).toBe("error");
});

test("help returns a message listing commands", () => {
  const db = seeded();
  const r = run(db, "help");
  expect(r.kind).toBe("message");
  if (r.kind === "message") expect(r.message).toContain("get");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/scripts/playground/engine.test.ts`
Expected: FAIL — `Cannot find module "./engine"`.

- [ ] **Step 3: Write the implementation** — `src/scripts/playground/engine.ts`

```ts
/**
 * Engine: maps a parsed Command onto the LibreDB lenses and normalizes the
 * outcome into a RunResult. Pure of the DOM and the worker transport; uses the
 * browser entry's in-memory open() in tests and the OPFS-backed db at runtime.
 */
import { kv, doc, table, type Database, type TableSchema } from "@libredb/libredb/browser";
import type { Command, RunResult } from "./protocol";

export const USERS_SCHEMA: TableSchema = {
  primaryKey: "id",
  columns: { id: "string", name: "string", age: "number", active: "boolean" },
};

/** The one demo table. Keeps `select/insert/remove` from applying a schema to an unknown name. */
const TABLES: Record<string, TableSchema> = { users: USERS_SCHEMA };

export function isSeeded(db: Database): boolean {
  return kv(db).get("config:theme") !== undefined;
}

export function seed(db: Database): void {
  const store = kv(db);
  store.set("config:theme", "dark");
  store.set("config:locale", "en");
  store.set("config:engine", "libredb");

  const articles = doc(db, "articles");
  articles.put("a1", { title: "Local-first databases", author: "Ada", published: true });
  articles.put("a2", { title: "OPFS in the browser", author: "Linus", published: false });

  const users = table(db, "users", USERS_SCHEMA);
  users.insert({ id: "1", name: "Ada", age: 36, active: true });
  users.insert({ id: "2", name: "Linus", age: 41, active: true });
  users.insert({ id: "3", name: "Grace", age: 31, active: false });
}

const HELP = [
  "kv:    get <key> · put <key> <value> · delete <key> · prefix <p> · range <a> <b>",
  "doc:   doc.all <coll> · doc.get <coll> <id> · doc.put <coll> <id> <json> · doc.find <coll> <json> · doc.delete <coll> <id>",
  "table: select * from users [limit n] · insert into users <json> · delete from users <pk>",
  "meta:  help · reset",
].join("\n");

function rowsFromDocs(entries: { id: string; doc: Record<string, unknown> }[]): RunResult {
  const cols = new Set<string>(["id"]);
  for (const e of entries) for (const k of Object.keys(e.doc)) cols.add(k);
  return {
    kind: "rows",
    columns: [...cols],
    rows: entries.map((e) => ({ id: e.id, ...e.doc })),
  };
}

/** Execute a parsed command. Total: lens throws (validation, unknown table) become error results. */
export function execute(db: Database, cmd: Command): RunResult {
  try {
    switch (cmd.op) {
      case "error":
        return { kind: "error", error: cmd.error };
      case "help":
        return { kind: "message", message: HELP };
      case "get": {
        const v = kv(db).get(cmd.key);
        return { kind: "message", message: v === undefined ? `(nil) — no value at "${cmd.key}"` : `${cmd.key} = ${v}` };
      }
      case "put": {
        const r = kv(db).set(cmd.key, cmd.value);
        return { kind: "message", message: `OK — set "${cmd.key}" (${r.changed} changed)` };
      }
      case "delete": {
        const r = kv(db).delete(cmd.key);
        return { kind: "message", message: `OK — deleted "${cmd.key}" (${r.changed} changed)` };
      }
      case "prefix":
        return { kind: "rows", columns: ["key", "value"], rows: kv(db).prefix(cmd.prefix).toArray() };
      case "range":
        return { kind: "rows", columns: ["key", "value"], rows: kv(db).range(cmd.start, cmd.end).toArray() };
      case "docget": {
        const d = doc(db, cmd.collection).get(cmd.id);
        return { kind: "message", message: d === undefined ? `(nil) — no document ${cmd.collection}:${cmd.id}` : JSON.stringify(d, null, 2) };
      }
      case "docput": {
        const r = doc(db, cmd.collection).put(cmd.id, cmd.json);
        return { kind: "message", message: `OK — put ${cmd.collection}:${cmd.id} (${r.changed} changed)` };
      }
      case "docdel": {
        const r = doc(db, cmd.collection).delete(cmd.id);
        return { kind: "message", message: `OK — deleted ${cmd.collection}:${cmd.id} (${r.changed} changed)` };
      }
      case "docall":
        return rowsFromDocs(doc(db, cmd.collection).all().toArray());
      case "docfind":
        return rowsFromDocs(doc(db, cmd.collection).find(cmd.predicate).toArray());
      case "select": {
        const schema = TABLES[cmd.table];
        if (!schema) return { kind: "error", error: `unknown table: ${cmd.table}. try "users".` };
        let rows = table(db, cmd.table, schema).all().toArray() as Array<Record<string, unknown>>;
        if (cmd.limit !== undefined) rows = rows.slice(0, cmd.limit);
        return { kind: "rows", columns: Object.keys(schema.columns), rows };
      }
      case "insert": {
        const schema = TABLES[cmd.table];
        if (!schema) return { kind: "error", error: `unknown table: ${cmd.table}. try "users".` };
        const r = table(db, cmd.table, schema).insert(cmd.row);
        return { kind: "message", message: `OK — inserted into ${cmd.table} (${r.changed} changed)` };
      }
      case "remove": {
        const schema = TABLES[cmd.table];
        if (!schema) return { kind: "error", error: `unknown table: ${cmd.table}. try "users".` };
        const r = table(db, cmd.table, schema).delete(cmd.pk);
        return { kind: "message", message: `OK — deleted ${cmd.table}:${cmd.pk} (${r.changed} changed)` };
      }
    }
  } catch (e) {
    return { kind: "error", error: (e as Error).message };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/scripts/playground/engine.test.ts`
Expected: PASS. (If `open()` cannot run under bun, fall back to testing only the schema/`parseCommand` glue and verify `execute` behavior in the Playwright step instead — but it is expected to pass since the browser entry imports no `node:` module.)

- [ ] **Step 5: Commit**

```bash
git add src/scripts/playground/engine.ts src/scripts/playground/engine.test.ts
git commit -m "feat(playground): lens-dispatch engine + sample seed (#19)"
```

---

## Task 3: Web Worker shell (boot, fallback, seed, reset, teardown)

**Files:**
- Create: `src/scripts/playground/db.worker.ts`

**Interfaces:**
- Consumes: `seed`, `isSeeded`, `execute` from `./engine`; `parseCommand` from `./protocol`; `WorkerRequest`, `WorkerResponse`, `Mode` from `./protocol`.
- Produces: a module Worker that answers `WorkerRequest` with `WorkerResponse`. No unit test (Worker + OPFS env); verified by Playwright in Task 6.

- [ ] **Step 1: Write the implementation** — `src/scripts/playground/db.worker.ts`

```ts
/**
 * The /playground database worker. Sole owner of the OPFS sync-access handle.
 * Durable when OPFS is available; otherwise transparently in-memory. Never
 * throws across postMessage — every failure becomes a structured response.
 */
import { open, opfsFileSystem, type Database } from "@libredb/libredb/browser";
import { seed, isSeeded, execute } from "./engine";
import { parseCommand } from "./protocol";
import type { WorkerRequest, WorkerResponse, Mode } from "./protocol";

const FILE = "playground.libredb";

let db: Database;
let mode: Mode = "memory";

/** Acquire the OPFS handle (Worker-only, secure context, exclusive lock) or fall back to in-memory. */
async function boot(): Promise<void> {
  try {
    const root = await navigator.storage.getDirectory();
    const file = await root.getFileHandle(FILE, { create: true });
    const handle = await file.createSyncAccessHandle();
    db = open({ path: FILE, fs: opfsFileSystem(handle) });
    mode = "opfs";
  } catch {
    db = open();
    mode = "memory";
  }
  if (!isSeeded(db)) seed(db);
}

/** Wipe the durable file (or the in-memory db) and reseed. */
async function reset(): Promise<void> {
  try {
    db.close();
  } catch {
    /* already closed */
  }
  if (mode === "opfs") {
    try {
      const root = await navigator.storage.getDirectory();
      await root.removeEntry(FILE).catch(() => {});
    } catch {
      /* ignore */
    }
  }
  await boot();
}

let ready = boot();

const reply = (msg: WorkerResponse) => self.postMessage(msg);

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  await ready;
  const msg = event.data;
  try {
    switch (msg.op) {
      case "ready":
        reply({ id: msg.id, kind: "ready", mode });
        return;
      case "run":
        reply({ id: msg.id, kind: "result", result: execute(db, parseCommand(msg.text)) });
        return;
      case "reset":
        ready = reset();
        await ready;
        reply({ id: msg.id, kind: "result", result: { kind: "message", message: "Sandbox reset to sample data." } });
        return;
      case "close":
        try {
          db.close();
        } catch {
          /* already closed */
        }
        reply({ id: msg.id, kind: "closed" });
        return;
    }
  } catch (e) {
    reply({ id: msg.id, kind: "result", result: { kind: "error", error: (e as Error).message } });
  }
};
```

- [ ] **Step 2: Typecheck**

Run: `bunx astro check 2>&1 | tail -20` (worker file is type-checked; expect no errors in `db.worker.ts`).
Expected: no TypeScript errors referencing `db.worker.ts`. (`navigator.storage.getDirectory` / `createSyncAccessHandle` resolve via the DOM lib bundled in TS; if the WebWorker lib types are missing, add a minimal local declaration rather than `any`.)

- [ ] **Step 3: Commit**

```bash
git add src/scripts/playground/db.worker.ts
git commit -m "feat(playground): OPFS worker with in-memory fallback + reset (#19)"
```

---

## Task 4: Client bridge (main-thread transport + DOM)

**Files:**
- Create: `src/scripts/playground/client.ts`

**Interfaces:**
- Consumes: `WorkerRequest`, `WorkerResponse`, `RunResult`, `Mode` from `./protocol`.
- Produces: a default side-effecting module that, on import, wires the `[data-pg-*]` DOM (defined in Task 5) to the worker. Expects these hooks in the DOM: `[data-pg-root]`, `[data-pg-input]`, `[data-pg-run]`, `[data-pg-reset]`, `[data-pg-grid]`, `[data-pg-badge]`, `[data-pg-banner]`, and cheatsheet buttons `[data-cmd]`.

- [ ] **Step 1: Write the implementation** — `src/scripts/playground/client.ts`

```ts
/**
 * Main-thread bridge for /playground. Spawns the db worker, exchanges
 * id-tagged messages, and renders results into the editor's grid/console.
 * Touches navigator/Worker only at import time on the client (never SSR).
 */
import type { WorkerRequest, WorkerResponse, RunResult, Mode } from "./protocol";

const root = document.querySelector<HTMLElement>("[data-pg-root]");
if (root) init(root);

function init(root: HTMLElement): void {
  const input = root.querySelector<HTMLTextAreaElement>("[data-pg-input]");
  const runBtn = root.querySelector<HTMLButtonElement>("[data-pg-run]");
  const resetBtn = root.querySelector<HTMLButtonElement>("[data-pg-reset]");
  const grid = root.querySelector<HTMLElement>("[data-pg-grid]");
  const badge = root.querySelector<HTMLElement>("[data-pg-badge]");
  const banner = root.querySelector<HTMLElement>("[data-pg-banner]");
  if (!input || !runBtn || !grid) return;

  const worker = new Worker(new URL("./db.worker.ts", import.meta.url), { type: "module" });

  let seq = 0;
  const pending = new Map<number, (r: WorkerResponse) => void>();
  worker.addEventListener("message", (e: MessageEvent<WorkerResponse>) => {
    pending.get(e.data.id)?.(e.data);
    pending.delete(e.data.id);
  });
  function call(req: Omit<WorkerRequest, "id">): Promise<WorkerResponse> {
    const id = ++seq;
    return new Promise((resolve) => {
      pending.set(id, resolve);
      worker.postMessage({ ...req, id } as WorkerRequest);
    });
  }

  // Handshake: learn persistence mode, show badge/banner.
  void call({ op: "ready" }).then((res) => {
    if (res.kind === "ready") showMode(res.mode);
  });
  function showMode(mode: Mode): void {
    if (badge) {
      badge.textContent = mode === "opfs" ? "OPFS · persistent" : "in-memory · this session";
      badge.dataset.mode = mode;
    }
    if (banner) banner.hidden = mode === "opfs";
  }

  async function run(text: string): Promise<void> {
    const t = text.trim();
    if (t === "") return;
    if (t.toLowerCase() === "reset") return void doReset();
    const res = await call({ op: "run", text: t });
    if (res.kind === "result") render(res.result);
  }

  async function doReset(): Promise<void> {
    const res = await call({ op: "reset" });
    if (res.kind === "result") render(res.result);
    await run("select * from users");
  }

  function render(result: RunResult): void {
    if (result.kind === "rows") return renderGrid(grid!, result.columns, result.rows);
    if (result.kind === "error") return renderConsole(`✕ ${result.error}`, "error");
    renderConsole(result.message, "ok");
  }

  runBtn.addEventListener("click", () => void run(input.value));
  input.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      void run(input.value);
    }
  });
  resetBtn?.addEventListener("click", () => void doReset());

  // Cheatsheet: clicking a command fills the editor and runs it (zero typing).
  root.querySelectorAll<HTMLElement>("[data-cmd]").forEach((b) =>
    b.addEventListener("click", () => {
      const cmd = b.dataset.cmd ?? "";
      input.value = cmd;
      void run(cmd);
    }),
  );

  // Free the exclusive OPFS lock so a reload reacquires cleanly. The worker
  // runs db.close() then self.close() on 'close'; we must NOT terminate() here
  // (it races and usually wins before the worker releases the handle). Skip
  // bfcache (event.persisted) so a back/forward restore keeps a live worker.
  window.addEventListener("pagehide", (e) => {
    if (e.persisted) return;
    void call({ op: "close" });
  });

  // First view: show the seeded users table.
  void run("select * from users");
}

function renderGrid(grid: HTMLElement, columns: string[], rows: Array<Record<string, unknown>>): void {
  if (rows.length === 0) {
    grid.innerHTML = `<p class="p-4 text-[13px] text-faint">No rows.</p>`;
    return;
  }
  const cell = (v: unknown) => String(v ?? "");
  const head = columns.map((c) => `<th class="border-b border-edge px-3 py-2 text-left font-medium text-muted">${escapeHtml(c)}</th>`).join("");
  const body = rows
    .map(
      (r) =>
        `<tr class="hover:bg-panel/60">${columns
          .map((c) => `<td class="border-b border-edge px-3 py-1.5 text-fg">${escapeHtml(cell(r[c]))}</td>`)
          .join("")}</tr>`,
    )
    .join("");
  grid.innerHTML = `<table class="w-full border-collapse font-mono text-[12.5px]"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

/** Reuse the studio console toast if present; otherwise inline-line fallback. */
function renderConsole(message: string, kind: "ok" | "error"): void {
  const host = document.querySelector<HTMLElement>("[data-pg-log]");
  if (!host) return;
  const line = document.createElement("pre");
  line.className = kind === "error" ? "text-bad whitespace-pre-wrap" : "text-ok whitespace-pre-wrap";
  line.textContent = message;
  host.prepend(line);
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
```

- [ ] **Step 2: Commit** (typecheck happens in Task 5 once the DOM exists)

```bash
git add src/scripts/playground/client.ts
git commit -m "feat(playground): main-thread worker bridge + grid renderer (#19)"
```

---

## Task 5: UI — Cheatsheet, Playground pane, route, nav link

**Files:**
- Create: `src/components/studio/Cheatsheet.astro`
- Create: `src/components/studio/Playground.astro`
- Create: `src/pages/playground.astro`
- Modify: `src/components/studio/TopBar.astro` (add `/playground` link)

**Interfaces:**
- Consumes: `StudioShell` from `../components/studio/StudioShell.astro`; client hooks named in Task 4.
- Produces: a rendered `/playground` page with all `[data-pg-*]` hooks and `[data-cmd]` buttons.

- [ ] **Step 1: Create `src/components/studio/Cheatsheet.astro`**

```astro
---
// Clickable, ready-to-run commands grouped per lens. Each button carries the
// exact command in data-cmd; client.ts fills the editor and runs it on click.
interface Group {
  label: string;
  badge: string;
  badgeClass: string;
  commands: string[];
}
const groups: Group[] = [
  {
    label: "Key–Value",
    badge: "kv",
    badgeClass: "bg-primary/15 text-primary",
    commands: ["get config:theme", "put config:theme light", "prefix config:", "range a z", "delete config:theme"],
  },
  {
    label: "Document",
    badge: "doc",
    badgeClass: "bg-ok/15 text-ok",
    commands: [
      "doc.all articles",
      "doc.get articles a1",
      'doc.put articles a3 {"title":"Local-first","published":true}',
      'doc.find articles {"published":true}',
      "doc.delete articles a2",
    ],
  },
  {
    label: "Relational",
    badge: "table",
    badgeClass: "bg-warn/15 text-warn",
    commands: [
      "select * from users",
      "select * from users limit 2",
      'insert into users {"id":"4","name":"Lin","age":29,"active":true}',
      "delete from users 4",
    ],
  },
];
---

<aside class="w-full shrink-0 overflow-y-auto border-l border-edge bg-canvas lg:w-72" aria-label="Command cheatsheet">
  <div class="border-b border-edge px-4 py-3">
    <p class="text-[11px] tracking-wider text-faint uppercase">Cheatsheet</p>
    <p class="mt-1 text-[12px] text-dim">Click any command to run it — no typing needed.</p>
  </div>
  {
    groups.map((g) => (
      <div class="border-b border-edge px-3 py-3">
        <p class="mb-2 flex items-center gap-2 px-1 text-[12.5px] text-muted">
          {g.label}
          <span class:list={["rounded px-1.5 text-[10px] tracking-wide uppercase", g.badgeClass]}>{g.badge}</span>
        </p>
        <ul class="space-y-1">
          {g.commands.map((cmd) => (
            <li>
              <button
                type="button"
                data-cmd={cmd}
                class="block w-full truncate border border-edge bg-panel px-2.5 py-1.5 text-left font-mono text-[12px] text-fg hover:border-primary hover:text-primary focus:border-primary focus:outline-none"
                title={cmd}
              >
                {cmd}
              </button>
            </li>
          ))}
        </ul>
      </div>
    ))
  }
</aside>
```

- [ ] **Step 2: Create `src/components/studio/Playground.astro`**

```astro
---
import Cheatsheet from "./Cheatsheet.astro";
---

<div data-pg-root class="flex min-h-0 flex-1 flex-col lg:flex-row">
  <section class="flex min-w-0 flex-1 flex-col">
    <!-- Toolbar -->
    <div class="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-edge bg-canvas px-4 py-2.5">
      <div class="flex items-center gap-2 text-[12.5px]">
        <span class="text-primary" aria-hidden="true">#</span>
        <span class="text-fg">playground.libredb</span>
        <span
          data-pg-badge
          class="rounded border border-edge px-1.5 py-0.5 text-[10.5px] tracking-wide text-faint uppercase"
          >detecting…</span
        >
      </div>
      <div class="flex items-center gap-2">
        <button
          type="button"
          data-pg-reset
          class="border border-edge bg-panel px-3 py-1.5 text-[12px] text-muted hover:border-bad hover:text-bad focus:outline-none"
          >↺ Reset sandbox</button
        >
      </div>
    </div>

    <!-- Fallback banner (hidden when OPFS is available) -->
    <p
      data-pg-banner
      hidden
      class="shrink-0 border-b border-warn/40 bg-warn/10 px-4 py-2 text-[12px] text-warn"
    >
      Persistence is disabled for this session (OPFS unavailable or this is a second tab) — running in-memory. Your
      changes will not survive a reload.
    </p>

    <!-- Editor -->
    <div class="shrink-0 border-b border-edge bg-panel">
      <label class="sr-only" for="pg-input">Command input</label>
      <textarea
        id="pg-input"
        data-pg-input
        rows="2"
        spellcheck="false"
        autocapitalize="off"
        autocomplete="off"
        placeholder="Type a command and press ⌘/Ctrl+Enter — or click one on the right. Try: select * from users"
        class="w-full resize-y bg-transparent px-4 py-3 font-mono text-[13px] text-fg placeholder:text-faint focus:outline-none"
      ></textarea>
      <div class="flex items-center justify-between border-t border-edge px-4 py-2">
        <span class="text-[11.5px] text-faint">Runs entirely in your browser · no backend · no signup</span>
        <button
          type="button"
          data-pg-run
          class="bg-primary px-4 py-1.5 text-[12.5px] font-medium text-white hover:opacity-90 focus:outline-none"
          >▶ Run</button
        >
      </div>
    </div>

    <!-- Result grid -->
    <div data-pg-grid class="min-h-0 flex-1 overflow-auto" aria-live="polite" aria-label="Query results"></div>

    <!-- Inline console log -->
    <div
      data-pg-log
      class="max-h-32 shrink-0 space-y-1 overflow-auto border-t border-edge bg-canvas px-4 py-2 font-mono text-[12px]"
      aria-live="polite"
      aria-label="Console"
    >
    </div>
  </section>

  <Cheatsheet />
</div>

<script>
  import "../../scripts/playground/client.ts";
</script>
```

- [ ] **Step 3: Create `src/pages/playground.astro`**

```astro
---
import Layout from "../layouts/Layout.astro";
import StudioShell from "../components/studio/StudioShell.astro";
import Playground from "../components/studio/Playground.astro";
---

<Layout
  title="Playground — run LibreDB in your browser | LibreDB"
  description="Run a real LibreDB database entirely in your browser, backed by OPFS. Preloaded sample data, clickable commands, zero backend, no signup."
>
  <StudioShell active="home">
    <Playground />
  </StudioShell>
</Layout>
```

- [ ] **Step 4: Add the nav link in `src/components/studio/TopBar.astro`**

Read the file first. Find the existing top-bar link/menu markup and add, following the surrounding pattern, a link whose `href="/playground"` labeled `Playground`. Do **not** modify `src/data/sections.ts` (that drives the schema explorer rows and homepage nav). Keep the change to a single anchor consistent with the existing nav items.

- [ ] **Step 5: Verify it builds and renders**

Run: `bun run build 2>&1 | tail -25`
Expected: build succeeds; `dist/playground/index.html` exists.
Then revert the build-mutated compose files:
Run: `git checkout -- src/data/docker-compose.example.yml public/docker-compose.example.yml 2>/dev/null; git status --short`
Expected: only the new/intended files show as changes.

- [ ] **Step 6: Commit**

```bash
git add src/components/studio/Cheatsheet.astro src/components/studio/Playground.astro src/pages/playground.astro src/components/studio/TopBar.astro
git commit -m "feat(playground): editor pane, cheatsheet, route, nav link (#19)"
```

---

## Task 6: Gate + browser verification (Playwright)

**Files:** none created — verification only.

- [ ] **Step 1: Run the full gate**

Run: `bun run gate 2>&1 | tail -30`
Expected: typecheck, format, lint, knip, and all `bun:test` pass. Fix any failures (likely knip on unused exports — ensure every new export is consumed; prettier — run `bun run format:fix`).

- [ ] **Step 2: Serve the production build with caching disabled**

Run (background): `bunx http-server dist -p 8081 -c-1`
(Use a cache-disabled static server per the repo's VT runtime-testing note.)

- [ ] **Step 3: Playwright — load and assert seed renders**

Navigate to `http://localhost:8081/playground`. Take a snapshot. Assert:
- The result grid shows the 3 seeded users (Ada, Linus, Grace).
- The persistence badge reads `OPFS · persistent` (Chromium on localhost is a secure context with OPFS).

- [ ] **Step 4: Playwright — click-to-run, persist, reset**

- Click the cheatsheet button `insert into users {"id":"4","name":"Lin","age":29,"active":true}`, then `select * from users` → assert a 4th row `Lin` appears.
- Reload the page → assert `Lin` is still present (OPFS persistence across reload).
- Click `↺ Reset sandbox` → assert the grid returns to exactly the 3 seed rows.
- Click `prefix config:` → assert key/value rows for `config:*` render.

- [ ] **Step 5: Confirm no `node:` in the client bundle**

Run: `grep -rl "node:fs\|require(\"fs\")\|node_fs" dist/assets/*.js | head` (or scan the playground chunk).
Expected: no matches — the browser entry pulled no `node:` module into the client bundle.

- [ ] **Step 6: Final commit (if any verification fixes were needed)**

```bash
git add -A && git commit -m "test(playground): gate fixes + browser-verified OPFS demo (#19)"
```

---

## Self-Review

- **Spec coverage:** Public no-login route (Task 5) ✓ · client-side OPFS Worker, no backend (Tasks 3,6) ✓ · 3-lens seed (Task 2) ✓ · clickable palette (Tasks 4,5) ✓ · persist + isolate + reset (Tasks 3,6) ✓ · no `node:fs`, marketing build unaffected (Task 6, TopBar-only nav change) ✓ · in-memory fallback + notice (Tasks 3,4,5) ✓ · `db.close()` teardown (Tasks 3,4) ✓ · no SSR engine code (Task 5 client-only `<script>`, Task 4 import-time guard) ✓.
- **Type consistency:** `WorkerResponse` uses a `kind` discriminator (`"ready"|"result"|"closed"`) consistently across protocol, worker, and client. `RunResult` discriminator `kind` (`"rows"|"message"|"error"`) consistent. `Mode` (`"opfs"|"memory"`) consistent. Command op names (`docget/docput/docdel/docall/docfind/select/insert/remove`) identical in parser (Task 1) and engine switch (Task 2).
- **Placeholder scan:** none — all code blocks are complete; the only prose step (TopBar Task 5 Step 4) is a read-then-follow-pattern instruction because the exact surrounding markup must be matched in-file.
- **Tailwind tokens:** uses existing tokens (`text-bad`, `text-warn`, `bg-ok`, `text-faint`, `border-edge`, `bg-panel`). Task 5 Step 5 must confirm these exist in `global.css`; if `text-bad`/`text-warn` differ, map to the actual token names found there.
