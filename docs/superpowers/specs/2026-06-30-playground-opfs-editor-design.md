# /playground — in-browser, zero-backend LibreDB editor (OPFS-backed)

**Issue:** [libredb/libredb.github.io#19](https://github.com/libredb/libredb.github.io/issues/19)
**Date:** 2026-06-30
**Repo:** libredb-website (libredb.github.io)
**Engine guide (authoritative):** `libredb-database/docs/BROWSER.md`

## Goal

Add a public route `/playground` that runs a **real LibreDB database entirely in the
browser**, backed by OPFS persistence shipped in `@libredb/libredb@0.1.3`. A visitor
lands on a working database preloaded with a sample dataset and a clickable command
cheatsheet, and can operate the database without typing anything and without signing in.

This is a **separate route**, not a change to the marketing homepage. The homepage hero
"SQL editor" stays a stylized mock; `/playground` is the "use it for real, right now"
surface.

## Decisions (locked in brainstorming)

- **Editor approach:** native editor built on the site's existing IDE-shell components.
  The "real Studio Monaco editor" lives in the separate `libredb-studio` repo and is not
  packaged for browser use — out of scope for this repo. We reuse `StudioShell`,
  `Explorer`, `Console`, `CommandPalette`, `StatusBar`, and the `Sql.astro` highlighter.
- **Route name:** `/playground`.
- **Scope:** full feature set (OPFS worker + 3-lens seed + clickable cheatsheet + Reset
  sandbox + in-memory fallback + `db.close()` teardown + SSR-safe island).

## Constraints (from BROWSER.md / issue)

- Import the **browser entry**: `@libredb/libredb/browser` (no `node:` in its import graph).
- `open()` (no path) → in-memory, works anywhere. `open({ path, fs })` → durable, needs `fs`.
- **OPFS sync access handles exist only inside a dedicated Web Worker, secure context only**
  (HTTPS or `localhost`). Acquire the handle async once, then `open` is synchronous.
- **Single-writer:** `createSyncAccessHandle()` takes an exclusive lock; a second tab cannot
  open the same file. For a public demo, fall back to in-memory on contention.
- **No LibreDB code during SSR** — Astro renders on Node where `window`/`navigator.storage`/
  `Worker` don't exist. All engine code runs in client-only `<script>` / the Worker.
- Call `db.close()` on teardown so the exclusive lock frees for the next reload.

## Architecture

```
/playground (Astro page, SSR-safe — no engine code at build/SSR time)
 └─ StudioShell (reused chrome)
     └─ Playground island  ← plain client <script> (no React)
         ├─ Editor pane: textarea + Sql-style highlight + Run + result grid
         ├─ Cheatsheet sidebar: clickable ready-to-run commands per lens
         └─ Toolbar: Reset sandbox · persistence badge (OPFS | in-memory)
              │  postMessage({id, op, args})   ▲ onmessage({id, result|error})
              ▼                                 │
         db.worker.ts (Web Worker, type: module)
           - navigator.storage.getDirectory()
           - getFileHandle("playground.libredb", {create:true})
           - createSyncAccessHandle()                       (Worker-only, exclusive)
           - open({ path, fs: opfsFileSystem(handle) })     durable path
           - on any failure → open()                        in-memory fallback
           - seed sample data on first open (kv + doc + table)
           - runs commands, returns rows/result
           - db.close() on "close" op
```

The Worker is loaded the bundler-friendly way:
`new Worker(new URL("./db.worker.ts", import.meta.url), { type: "module" })` — Vite (Astro's
bundler) understands this in dev and production builds.

## Files

### New

| File | Purpose |
| --- | --- |
| `src/pages/playground.astro` | The route. Wraps `Playground.astro` in `StudioShell`, sets SEO title/description. |
| `src/components/studio/Playground.astro` | Editor pane markup: command input, Run button, result grid container, persistence badge, Reset button, mounts `Cheatsheet`. Includes the client `<script>`. |
| `src/components/studio/Cheatsheet.astro` | Clickable command list grouped per lens (kv / document / relational / meta). Each button carries `data-cmd`. |
| `src/scripts/playground/protocol.ts` | **Pure, testable.** Message types (`WorkerRequest`/`WorkerResponse`), command parser/grammar, result-row shaping. No DOM, no engine import. |
| `src/scripts/playground/seed.ts` | Sample dataset definition + a `seed(db)` function (imported by the worker). |
| `src/scripts/playground/db.worker.ts` | The Worker. Owns the OPFS handle, opens db (durable→memory fallback), seeds on first open, dispatches parsed commands to lenses, returns results, `db.close()` on teardown. |
| `src/scripts/playground/client.ts` | Main-thread bridge: spawns worker, `call()` request/response with ids, wires Run button + cheatsheet clicks + Reset, renders result grid, shows fallback banner, posts `close` + `terminate()` on `pagehide`. |
| `src/scripts/playground/protocol.test.ts` | `bun:test` unit tests for the parser/grammar. |

### Reused as-is

`StudioShell`, `Console` + `studioConsole` toast API (`src/scripts/lib/console-copy.ts`),
`Sql.astro` highlighter, Tailwind design tokens (`bg-panel`, `border-edge`, `text-fg`,
`text-primary`, `bg-ok`, …).

### Modified

| File | Change |
| --- | --- |
| `package.json` | Add dependency `@libredb/libredb@0.1.3`. |
| `src/data/sections.ts` *(if needed for nav)* | Optionally add a `/playground` entry; otherwise link from TopBar only. Decide during implementation — keep homepage unaffected. |

## Command grammar (mirrors Studio's `LibreDBProvider` exactly)

LibreDB is an ordered key-value store; documents and relational tables are **conventions over
the keyspace** (`<table>:<pk>`, `<collection>:<id>`) recorded in the catalog — **not** separate
command dialects (see `libredb-studio/docs/providers/libredb.md` §1, §3.5). The playground exposes
**one** grammar — the five kv-lens verbs — never a SQL/document translator. Parsed in `protocol.ts`,
executed by `engine.ts` in the worker:

```
get <key>              read one key → key/value row (JSON value pretty-printed); missing → (nil)
put <key> <value>      write; quote-aware value tail → "OK · changed N"
delete <key>           remove → "OK · changed N"
prefix <prefix>        scan all keys under a prefix → rows
range <start> <end>    half-open [start,end) keyspace scan → rows
```

Plus the CLI's database-level commands (`libredb-database/docs/CLI.md`), which the
browser build fully supports:

```
inspect                list catalogued namespaces + kind + relational schema (reads catalog(db))
stats                  file size (OPFS handle.getSize()) + namespace counts by kind
import <json-object>   bulk-set a JSON object of string values in ONE atomic db.transact()
```

`inspect`/`stats` read `catalog(db)`; `import` commits through `db.transact()` (byte-level
`tx.set` with UTF-8 encoding) and refuses reserved keys via `isReservedKey`. These appear in a
separate **Manage** group in the cheatsheet with a use-case line each. (CLI file concepts — a
`<path>` argument, `.lock` files, `--force` — have no browser analog: the worker owns the OPFS
exclusive sync-access handle, and a second tab falls back to in-memory.) The CLI verbs `scan`/`set`
are intentionally NOT aliased — the playground keeps Studio's `prefix`/`put` names as canonical.

Parser rules (mirroring the provider's `tokenize`):
- Verbs case-insensitive. Quote-aware tokenization: single/double quotes preserve internal
  whitespace; an unmatched quote is a friendly error; consecutive unquoted whitespace collapses.
- Blank and `#`-comment lines are skipped; the first real line runs (a commented cheatsheet buffer
  is directly runnable).
- Empty / unknown verb / wrong arg count → `{ op: "error" }` (never throws across the worker boundary).
- `prefix`/`range` results hide the reserved catalog namespace via the package's `isReservedKey`.
- Results normalize to `{ kind:"rows", columns, rows }` for the grid, or `{ kind:"message" }` for
  writes / `(nil)` reads.

**Reset** is a host (sandbox) action, not a LibreDB verb: the toolbar button wipes the OPFS file and
reseeds. The seed still writes through the `doc()` and `table()` lenses so the catalog is real; the
visitor operates those namespaces through the same five kv verbs (`prefix users:`, `get users:1`,
`put users:4 {…}`, …). The `Cheatsheet` groups buttons by namespace (`users:*` relational, `articles:*`
document, `config:*` kv); clicking one fills the editor and runs it → **zero-typing**.

## Data flow

1. Page loads → client `<script>` runs only in browser → spawns Worker.
2. Worker acquires OPFS handle (or falls back), opens db, seeds if empty, posts `{ready, mode}`.
3. Client shows persistence badge from `mode` (`"opfs"` | `"memory"`); if `memory`, shows a
   one-line banner: "Persistence disabled for this session — running in-memory."
4. Visitor clicks a cheatsheet command (or types + Run) → client `call(op:"run", {text})`.
5. Worker parses, executes against the right lens, posts `{id, result}` or `{id, error}`.
6. Client renders rows in the grid; errors → red console toast.
7. Reset → `call(op:"reset")` → worker truncates the relevant keys/tables and reseeds.
8. `pagehide` → `call(op:"close")` then `worker.terminate()`.

## Error handling & edge cases

- **OPFS unavailable** (no `getDirectory`, no `createSyncAccessHandle`, insecure context,
  unsupported browser) → `try/catch` around handle acquisition → `open()` in-memory →
  `mode:"memory"`.
- **Second-tab single-writer lock** → `createSyncAccessHandle()` throws → same in-memory
  fallback path → badge + banner explain it.
- **Bad command / bad JSON** → worker returns `{error}`; the grid is left unchanged; a red
  toast appears. The worker never throws across `postMessage`.
- **Teardown** → `db.close()` on `close` op frees the exclusive lock so a quick reload
  reacquires OPFS cleanly.
- **Eviction** → acceptable for a demo; reseed on next visit (seed runs when the db is empty).

## Testing

- **Unit (`bun:test`)** — `protocol.test.ts`: each command parses to the right op+args;
  garbage rejected with a friendly error; JSON tail parsed safely; `select … limit N` parsed.
- **Gate** — `bun run gate` (typecheck + format + lint + knip + test) must pass.
- **Playwright (real browser, local `astro preview` or `dist` server)**:
  1. Navigate to `/playground`; assert seed `users` rows render in the grid.
  2. Click a cheatsheet `insert into users {…}` → new row appears.
  3. Reload → the inserted row persists (OPFS durable path on Chromium/`localhost`).
  4. Click **Reset sandbox** → grid returns to the seed set.
  5. Assert the persistence badge reads OPFS on a secure context.
  6. Confirm no `node:`/`node_fs` reference in the emitted `/playground` client bundle.

## Acceptance criteria (from issue #19)

- [ ] Public route serves a real editor with no login.
- [ ] Queries execute client-side against an OPFS-backed LibreDB in a Web Worker; no backend.
- [ ] Sample dataset (kv + document + relational) preloaded on first visit.
- [ ] Clickable command palette runs insert/get/update/delete/scan without typing.
- [ ] Data persists across reloads, is per-visitor isolated, and can be reset.
- [ ] Browser bundle does not pull `node:fs`; homepage/marketing build unaffected.
- [ ] Graceful in-memory fallback + notice where OPFS/sync handles unavailable or on
      second-tab lock contention.
- [ ] Worker releases the handle (`db.close()`) on teardown.
- [ ] No LibreDB code runs during SSR (client-only island; engine touched only after mount).

## Non-goals

- Not replacing the homepage hero editor.
- Not the full multi-provider IDE (no Postgres/MySQL over the network).
- Not the cross-repo Monaco bundle from libredb-studio.
- Not cloud persistence or accounts.
