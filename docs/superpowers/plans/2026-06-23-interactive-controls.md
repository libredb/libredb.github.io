# Interactive Controls ("Zero Dead Clicks") Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every clickable-looking control in the IDE chrome either perform a real action or respond in-character (playful console message) — never a silent dead click.

**Architecture:** Pure logic lives in small unit-tested modules under `src/scripts/lib/` (console copy map, export serializers, fuzzy filter). DOM wiring lives in `src/scripts/studio.ts` via a single delegated `[data-action]` click handler. Two new Astro components (`Console`, `CommandPalette`) provide markup the script drives. The Explain panel is per-section inside `SectionShell`. Controls declare intent declaratively with `data-action` / `data-notice` attributes.

**Tech Stack:** Astro 6, Tailwind v4, TypeScript, `bun:test` (run with `bun test`). Build check: `bunx astro build` (NOT `bun run build` — that mutates tracked compose files).

## Global Constraints
- Design tokens only (no raw hex): surfaces `bg-canvas/panel/raised`, borders `edge/edge-strong/line`, text `fg/bright/muted/dim/faint`, accents `primary/ok/bad/warn/ai/keyword`. Mono everywhere. Sharp corners (6px max on chips/buttons).
- Tone of all console copy: **bold & playful** (verbatim strings in `console-copy.ts` Task 1).
- Demo URL: `https://app.libredb.org`. GitHub: `https://github.com/libredb/libredb-studio`. Docs: `https://github.com/libredb/libredb-studio#readme`.
- Progressive enhancement: with JS off, all section content stays present/navigable; new behaviors simply don't activate; nothing breaks.
- Respect `prefers-reduced-motion` for RUN shimmer and palette transitions.
- Verify with `bunx astro build` (must pass) after each DOM task; never run `bun run build`.
- Section ids/manifest: `src/data/sections.ts` (`sections`, `sectionById`, `SectionMeta`).

## File Structure
```
src/scripts/lib/console-copy.ts        NEW  redirect copy map + types (tested)
src/scripts/lib/console-copy.test.ts   NEW
src/scripts/lib/export.ts              NEW  toJSON/toCSV/serialize (tested)
src/scripts/lib/export.test.ts         NEW
src/scripts/lib/filter.ts              NEW  fuzzyMatch/filterItems (tested)
src/scripts/lib/filter.test.ts         NEW
src/components/studio/Console.astro     NEW  toast container (aria-live)
src/components/studio/CommandPalette.astro NEW ⌘K modal shell
src/scripts/studio.ts                  MOD  console API, palette, run/copy/export/explain, redirect dispatch, search filter
src/data/sections.ts                   MOD  + explain: string per section
src/components/studio/SectionShell.astro MOD + per-section Explain panel
src/components/studio/QueryChrome.astro  MOD data-action attrs + inert markup
src/components/studio/MobileQueryCard.astro MOD Explain action
src/components/studio/TopBar.astro       MOD ⌘K chip; Monitoring redirect; inert status
src/components/studio/StatusBar.astro    MOD inert (cursor/aria)
src/components/studio/Explorer.astro     MOD data-explorer-root on root
src/components/sections/*Section.astro   MOD emit embedded export JSON payload
src/styles/global.css                   MOD .is-rerunning shimmer; toast/palette helpers
src/pages/index.astro                    MOD mount <Console/> + <CommandPalette/>
```

---

### Task 1: Console copy map module

**Files:**
- Create: `src/scripts/lib/console-copy.ts`
- Test: `src/scripts/lib/console-copy.test.ts`

**Interfaces:**
- Produces: `type ConsoleKind = 'notice'|'error'|'ok'|'comment'`; `interface ConsoleCta { label: string; href: string }`; `interface ConsoleMessage { kind: ConsoleKind; text: string; hint?: string; cta?: ConsoleCta }`; `const NOTICES: Record<string, ConsoleMessage>`.

- [ ] **Step 1: Write the failing test**

```ts
// src/scripts/lib/console-copy.test.ts
import { test, expect } from 'bun:test';
import { NOTICES } from './console-copy';

const REQUIRED_KEYS = [
  'monitoring', 'query', 'save', 'begin', 'sandbox', 'edit', 'import',
  'format', 'clear', 'lines', 'history', 'saved', 'charts', 'autopilot',
  'pivot', 'diff', 'dashboard', 'newtab', 'closetab',
];
const VALID_KINDS = ['notice', 'error', 'ok', 'comment'];

test('every required control has a console message', () => {
  for (const k of REQUIRED_KEYS) expect(NOTICES[k]).toBeDefined();
});

test('messages are well-formed', () => {
  for (const [key, m] of Object.entries(NOTICES)) {
    expect(VALID_KINDS).toContain(m.kind);
    expect(m.text.length).toBeGreaterThan(0);
    if (m.cta) expect(m.cta.href.startsWith('http')).toBe(true);
    if (m.cta) expect(m.cta.label.length).toBeGreaterThan(0);
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/scripts/lib/console-copy.test.ts`
Expected: FAIL — `Cannot find module './console-copy'`.

- [ ] **Step 3: Write the module**

```ts
// src/scripts/lib/console-copy.ts
export type ConsoleKind = 'notice' | 'error' | 'ok' | 'comment';
export interface ConsoleCta { label: string; href: string; }
export interface ConsoleMessage {
  kind: ConsoleKind;
  text: string;
  hint?: string;
  cta?: ConsoleCta;
}

const DEMO = 'https://app.libredb.org';
const demo = (label = 'Open demo'): ConsoleCta => ({ label, href: DEMO });

/** Playful, bold in-character responses for non-functional chrome controls. */
export const NOTICES: Record<string, ConsoleMessage> = {
  monitoring: { kind: 'comment', text: "nothing's on fire here. live monitoring runs in the app", cta: demo() },
  query:      { kind: 'notice',  text: 'the visual query builder is a live-app superpower', cta: demo() },
  save:       { kind: 'error',   text: 'ERROR 42501: permission denied — must be superuser', hint: 'superusers save queries in the live demo', cta: demo('Become one') },
  begin:      { kind: 'notice',  text: 'BEGIN…COMMIT — real transactions, real database. In the app', cta: demo() },
  sandbox:    { kind: 'notice',  text: 'SANDBOX runs scary queries safely. Try it in the app', cta: demo() },
  edit:       { kind: 'comment', text: 'read-only out here; full edit mode lives in the app', cta: demo() },
  import:     { kind: 'notice',  text: 'drop a .sql / .csv and IMPORT it — in the live app', cta: demo() },
  format:     { kind: 'notice',  text: 'one-keystroke SQL formatting ships in the app', cta: demo() },
  clear:      { kind: 'comment', text: 'nothing to clear on a landing page ;)' },
  lines:      { kind: 'comment', text: 'line numbers are bolted on around here' },
  history:    { kind: 'notice',  text: '↺ every query you run is logged per-workspace — in the app', cta: demo() },
  saved:      { kind: 'notice',  text: '⭐ star a query to save it — saved queries live in the app', cta: demo() },
  charts:     { kind: 'notice',  text: '◔ turn any result set into a chart, one click — in the app', cta: demo() },
  autopilot:  { kind: 'notice',  text: 'Autopilot hunts slow queries and writes the fix. In the app', cta: demo() },
  pivot:      { kind: 'notice',  text: '▥ pivot any result like a spreadsheet — only works in production', cta: demo() },
  diff:       { kind: 'notice',  text: '⇄ diff two schemas or result sets side-by-side — in the app', cta: demo() },
  dashboard:  { kind: 'notice',  text: '▦ pin queries into a live dashboard — build yours in the app', cta: demo() },
  newtab:     { kind: 'notice',  text: 'more tabs unlock in the app', cta: demo() },
  closetab:   { kind: 'comment', text: "you can't close the one thing selling you on us ;)" },
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/scripts/lib/console-copy.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/scripts/lib/console-copy.ts src/scripts/lib/console-copy.test.ts
git commit -m "feat: console copy map for in-character control redirects"
```

---

### Task 2: Export serializers

**Files:**
- Create: `src/scripts/lib/export.ts`
- Test: `src/scripts/lib/export.test.ts`

**Interfaces:**
- Produces: `type Row = Record<string, unknown>`; `toJSON(rows: Row[]): string`; `toCSV(rows: Row[]): string`; `serialize(rows: Row[], format: 'json'|'csv'): string`.

- [ ] **Step 1: Write the failing test**

```ts
// src/scripts/lib/export.test.ts
import { test, expect } from 'bun:test';
import { toJSON, toCSV, serialize } from './export';

test('toJSON pretty-prints rows', () => {
  expect(toJSON([{ a: 1 }])).toBe('[\n  {\n    "a": 1\n  }\n]');
});

test('toCSV writes header then rows', () => {
  const csv = toCSV([{ name: 'pg', type: 'relational' }, { name: 'redis', type: 'kv' }]);
  expect(csv).toBe('name,type\npg,relational\nredis,kv');
});

test('toCSV quotes cells containing comma, quote, or newline', () => {
  const csv = toCSV([{ a: 'x,y', b: 'he said "hi"' }]);
  expect(csv).toBe('a,b\n"x,y","he said ""hi"""');
});

test('toCSV on empty array is empty string', () => {
  expect(toCSV([])).toBe('');
});

test('serialize dispatches by format', () => {
  expect(serialize([{ a: 1 }], 'csv')).toBe('a\n1');
  expect(serialize([{ a: 1 }], 'json')).toBe(toJSON([{ a: 1 }]));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/scripts/lib/export.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the module**

```ts
// src/scripts/lib/export.ts
export type Row = Record<string, unknown>;

export function toJSON(rows: Row[]): string {
  return JSON.stringify(rows, null, 2);
}

function csvCell(v: unknown): string {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCSV(rows: Row[]): string {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(',')];
  for (const r of rows) lines.push(headers.map((h) => csvCell(r[h])).join(','));
  return lines.join('\n');
}

export function serialize(rows: Row[], format: 'json' | 'csv'): string {
  return format === 'csv' ? toCSV(rows) : toJSON(rows);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/scripts/lib/export.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/scripts/lib/export.ts src/scripts/lib/export.test.ts
git commit -m "feat: JSON/CSV export serializers"
```

---

### Task 3: Fuzzy filter

**Files:**
- Create: `src/scripts/lib/filter.ts`
- Test: `src/scripts/lib/filter.test.ts`

**Interfaces:**
- Produces: `fuzzyMatch(query: string, text: string): number | null` (null = no match; lower number = better); `filterItems<T>(query: string, items: T[], keyFn: (it: T) => string): T[]`.

- [ ] **Step 1: Write the failing test**

```ts
// src/scripts/lib/filter.test.ts
import { test, expect } from 'bun:test';
import { fuzzyMatch, filterItems } from './filter';

test('empty query matches everything with score 0', () => {
  expect(fuzzyMatch('', 'features')).toBe(0);
});

test('subsequence matches, non-subsequence does not', () => {
  expect(fuzzyMatch('ftr', 'features')).not.toBeNull();
  expect(fuzzyMatch('xyz', 'features')).toBeNull();
});

test('contiguous match scores better (lower) than gapped', () => {
  const contiguous = fuzzyMatch('feat', 'features')!;
  const gapped = fuzzyMatch('fts', 'features')!;
  expect(contiguous).toBeLessThan(gapped);
});

test('filterItems returns matches ordered by score, empty query returns all', () => {
  const items = ['home', 'features', 'deploy', 'faq'];
  expect(filterItems('', items, (s) => s)).toEqual(items);
  expect(filterItems('fa', items, (s) => s)).toEqual(['faq', 'features']);
  expect(filterItems('zzz', items, (s) => s)).toEqual([]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/scripts/lib/filter.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the module**

```ts
// src/scripts/lib/filter.ts
/** Case-insensitive subsequence match. Returns null if not a subsequence,
 *  else a score (sum of gap sizes; lower = tighter = better). */
export function fuzzyMatch(query: string, text: string): number | null {
  const q = query.toLowerCase().trim();
  const t = text.toLowerCase();
  if (q === '') return 0;
  let qi = 0;
  let score = 0;
  let last = -1;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      if (last >= 0) score += ti - last - 1;
      last = ti;
      qi++;
    }
  }
  return qi === q.length ? score : null;
}

export function filterItems<T>(query: string, items: T[], keyFn: (it: T) => string): T[] {
  if (query.trim() === '') return items;
  return items
    .map((item) => ({ item, score: fuzzyMatch(query, keyFn(item)) }))
    .filter((r): r is { item: T; score: number } => r.score !== null)
    .sort((a, b) => a.score - b.score)
    .map((r) => r.item);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/scripts/lib/filter.test.ts`
Expected: PASS (4 tests). (`filterItems('fa', …)` → `faq` score 0 beats `features` which has a gap.)

- [ ] **Step 5: Commit**

```bash
git add src/scripts/lib/filter.ts src/scripts/lib/filter.test.ts
git commit -m "feat: fuzzy subsequence filter for palette + explorer search"
```

---

### Task 4: Console toast component + JS API

**Files:**
- Create: `src/components/studio/Console.astro`
- Modify: `src/pages/index.astro` (mount the component)
- Modify: `src/scripts/studio.ts` (add `studioConsole` API)
- Modify: `src/styles/global.css` (toast prefix colors via tokens — only if not expressible with utilities; otherwise none)

**Interfaces:**
- Consumes: `ConsoleMessage`, `NOTICES` from Task 1.
- Produces: `studioConsole.push(msg: ConsoleMessage)`, `.notice(text, cta?)`, `.error(text, hint?, cta?)`, `.ok(text)`, `.comment(text)` — used by Tasks 5,7,8,9.

- [ ] **Step 1: Create the container component**

```astro
---
// src/components/studio/Console.astro
// Toast/console output. Populated by studioConsole in studio.ts.
---
<div
  data-console
  aria-live="polite"
  aria-label="Console output"
  class="pointer-events-none fixed inset-x-3 bottom-3 z-40 flex flex-col items-center gap-2 sm:items-end lg:inset-x-auto lg:right-5 lg:bottom-5"
></div>
```

- [ ] **Step 2: Mount it in the page**

In `src/pages/index.astro`, add the import with the other studio imports:
```astro
import Console from '../components/studio/Console.astro';
```
And add it just before the closing `</div>` of `.studio` (after `<div class="hidden lg:block"><StatusBar /></div>`):
```astro
    <Console />
  </div>
```

- [ ] **Step 3: Add the `studioConsole` API to `studio.ts`**

At the top of `src/scripts/studio.ts`, add the import:
```ts
import type { ConsoleMessage, ConsoleKind } from './lib/console-copy';
```
Add this block above `function init()`:
```ts
/* ---- Console toast output ---- */
const prefixClass: Record<ConsoleKind, string> = {
  notice: 'text-primary',
  error: 'text-bad',
  ok: 'text-ok',
  comment: 'text-faint',
};
const prefixLabel: Record<ConsoleKind, string> = {
  notice: 'NOTICE',
  error: 'ERROR',
  ok: '✓',
  comment: '--',
};

function renderToast(msg: ConsoleMessage): HTMLElement {
  const el = document.createElement('div');
  el.className =
    'pointer-events-auto flex w-[min(92vw,440px)] items-start gap-2 border border-edge bg-panel px-3 py-2 text-[12.5px] leading-relaxed shadow-lg';
  el.setAttribute('role', 'status');

  const body = document.createElement('div');
  body.className = 'flex-1';
  const line = document.createElement('div');
  line.innerHTML =
    `<span class="${prefixClass[msg.kind]} font-semibold">${prefixLabel[msg.kind]}</span> ` +
    `<span class="text-fg">${escapeHtml(msg.text)}</span>`;
  body.appendChild(line);
  if (msg.hint) {
    const hint = document.createElement('div');
    hint.className = 'text-faint';
    hint.textContent = `HINT: ${msg.hint}`;
    body.appendChild(hint);
  }
  if (msg.cta) {
    const cta = document.createElement('a');
    cta.href = msg.cta.href;
    cta.target = '_blank';
    cta.rel = 'noopener noreferrer';
    cta.className = 'mt-1 inline-block border border-edge-strong px-2 py-0.5 text-primary hover:bg-raised';
    cta.textContent = `${msg.cta.label} →`;
    body.appendChild(cta);
  }
  el.appendChild(body);

  const close = document.createElement('button');
  close.type = 'button';
  close.setAttribute('aria-label', 'Dismiss');
  close.className = 'shrink-0 text-faint hover:text-fg';
  close.textContent = '✕';
  close.addEventListener('click', () => el.remove());
  el.appendChild(close);
  return el;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const studioConsole = {
  push(msg: ConsoleMessage) {
    const root = document.querySelector('[data-console]');
    if (!root) return;
    const el = renderToast(msg);
    root.appendChild(el);
    while (root.children.length > 3) root.firstElementChild?.remove();
    const t = window.setTimeout(() => el.remove(), 6000);
    el.addEventListener('mouseenter', () => clearTimeout(t));
  },
  notice(text: string, cta?: ConsoleMessage['cta']) { this.push({ kind: 'notice', text, cta }); },
  error(text: string, hint?: string, cta?: ConsoleMessage['cta']) { this.push({ kind: 'error', text, hint, cta }); },
  ok(text: string) { this.push({ kind: 'ok', text }); },
  comment(text: string) { this.push({ kind: 'comment', text }); },
};
```

- [ ] **Step 4: Build + browser verify**

Run: `bunx astro build`
Expected: PASS (5 pages).
Then in dev (`bun run dev`, port 4321) open the browser console and run:
```js
// temporary smoke check
document.querySelector('[data-console]') !== null
```
Expected: `true` (container present). The API is exercised by later tasks.

- [ ] **Step 5: Commit**

```bash
git add src/components/studio/Console.astro src/pages/index.astro src/scripts/studio.ts
git commit -m "feat: console toast container + studioConsole output API"
```

---

### Task 5: Playful redirect dispatch (the biggest coverage win)

**Files:**
- Modify: `src/components/studio/QueryChrome.astro` (add `data-action="notice"` + `data-notice` to redirect controls; make them `<button>`)
- Modify: `src/components/studio/TopBar.astro` (Monitoring → notice button)
- Modify: `src/scripts/studio.ts` (delegated `[data-action]` handler → notice)

**Interfaces:**
- Consumes: `NOTICES` (Task 1), `studioConsole` (Task 4).
- Produces: a global `click` delegate keyed on `data-action`; later tasks add more `case`s.

- [ ] **Step 1: Wire the delegated handler in `studio.ts`**

Add the import at top:
```ts
import { NOTICES } from './lib/console-copy';
```
Add inside `init()` (after the existing explorer/drawer wiring, before hash routing):
```ts
  // Single delegated handler for all chrome controls.
  document.addEventListener('click', (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-action]');
    if (!el) return;
    const action = el.dataset.action;
    if (action === 'notice') {
      e.preventDefault();
      const msg = NOTICES[el.dataset.notice ?? ''];
      if (msg) studioConsole.push(msg);
    }
  });
```

- [ ] **Step 2: Convert QueryChrome redirect controls to buttons with attributes**

In `src/components/studio/QueryChrome.astro`, replace the **query toolbar** decorative spans. Change the `Query`/`Save` block:
```astro
    <div class="flex items-center gap-4">
      <button type="button" class="flex items-center gap-1.5 text-muted hover:text-fg" data-action="notice" data-notice="query">▾ Query</button>
      <button type="button" class="flex items-center gap-1.5 text-muted hover:text-fg" data-action="notice" data-notice="save">▤ Save</button>
    </div>
```
Change the right-side `BEGIN/SANDBOX/EDIT/IMPORT` block (remove `aria-hidden`, make buttons):
```astro
    <div class="flex items-center gap-4 text-faint">
      <button type="button" class="hover:text-fg" data-action="notice" data-notice="begin">BEGIN</button>
      <button type="button" class="hover:text-fg" data-action="notice" data-notice="sandbox">⬡ SANDBOX</button>
      <button type="button" class="hover:text-fg" data-action="notice" data-notice="edit">✎ EDIT</button>
      <button type="button" class="hover:text-fg" data-action="notice" data-notice="import">↑ IMPORT</button>
    </div>
```
Change the **sub-toolbar** left block (`Format/Copy/Clear/Lines/AI`) — note Copy/AI/Explain become real in later tasks; for now wire the redirects and leave Copy/AI/Explain as placeholders to be wired in Tasks 8/11/10 (give them `data-action` now so markup is final):
```astro
    <div class="flex items-center gap-4 text-faint">
      <button type="button" class="hover:text-fg" data-action="notice" data-notice="format">≡ Format</button>
      <button type="button" class="hover:text-fg" data-action="copy-link">⧉ Copy</button>
      <button type="button" class="hover:text-fg" data-action="notice" data-notice="clear">✕ Clear</button>
      <button type="button" class="hover:text-fg" data-action="notice" data-notice="lines"># Lines</button>
      <button type="button" class="text-ai hover:brightness-125" data-action="palette">✦ AI</button>
    </div>
```
Change the sub-toolbar right block (`✦ Explain` + `⌘+Enter`):
```astro
    <div class="flex items-center gap-3">
      <button type="button" class="text-primary hover:brightness-125" data-action="explain" aria-expanded="false">✦ Explain</button>
      <span class="rounded border border-edge-strong px-1.5 py-0.5 text-[11px]" aria-hidden="true">⌘+Enter</span>
    </div>
```
Change the **result tabs** row: `Results` stays the selected tab (give it `data-action="run-scroll"` is unnecessary — leave as a plain active span); wire the rest. Replace the `resultTabs.map(...)` span loop with explicit buttons:
```astro
    <div class="flex items-center gap-4 overflow-x-auto py-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <span class="whitespace-nowrap font-semibold text-fg shadow-[inset_0_-2px_0_var(--color-primary)] pb-0.5">▦ Results</span>
      <button type="button" class="whitespace-nowrap text-faint hover:text-fg" data-action="explain">⚡ Explain</button>
      <button type="button" class="whitespace-nowrap text-faint hover:text-fg" data-action="notice" data-notice="history">↺ History</button>
      <button type="button" class="whitespace-nowrap text-faint hover:text-fg" data-action="notice" data-notice="saved">⭐ Saved</button>
      <button type="button" class="whitespace-nowrap text-faint hover:text-fg" data-action="notice" data-notice="charts">◔ Charts</button>
      <button type="button" class="whitespace-nowrap text-faint hover:text-fg" data-action="palette">✦ NL2SQL</button>
      <button type="button" class="whitespace-nowrap text-faint hover:text-fg" data-action="notice" data-notice="autopilot">✈ Autopilot</button>
      <button type="button" class="whitespace-nowrap text-faint hover:text-fg" data-action="notice" data-notice="pivot">▥ Pivot</button>
      <a class="whitespace-nowrap text-faint hover:text-fg" href="https://github.com/libredb/libredb-studio#readme" target="_blank" rel="noopener noreferrer">▤ Docs</a>
      <button type="button" class="whitespace-nowrap text-faint hover:text-fg" data-action="notice" data-notice="diff">⇄ Diff</button>
      <button type="button" class="whitespace-nowrap text-faint hover:text-fg" data-action="notice" data-notice="dashboard">▦ Dashboard</button>
    </div>
```
And the result-tabs right side `↑ Export`:
```astro
    <div class="flex shrink-0 items-center gap-3 py-2.5 text-faint">
      <span>{section.rows} rows • {section.execMs}ms</span>
      <button type="button" class="text-muted hover:text-fg" data-action="export">↑ Export</button>
    </div>
```
Change the **tab bar** `README.md`, `✕` (close), `＋` (new):
```astro
    <a class="flex items-center gap-1.5 border-r border-edge px-4 py-2.5 text-faint hover:text-fg" href="https://github.com/libredb/libredb-studio#readme" target="_blank" rel="noopener noreferrer">▤ README.md</a>
```
For the active `{section.table}.sql` tab keep as-is, but change its `✕` to a button:
```astro
      <button type="button" class="text-faint hover:text-fg" data-action="notice" data-notice="closetab" aria-label="Close tab">✕</button>
```
And the `＋`:
```astro
    <button type="button" class="px-3 py-2.5 text-faint hover:text-fg" data-action="notice" data-notice="newtab" aria-label="New tab">＋</button>
```

- [ ] **Step 3: Monitoring → notice in TopBar**

In `src/components/studio/TopBar.astro`, replace the Monitoring span:
```astro
    <button type="button" class="flex items-center gap-1.5 text-muted hover:text-fg" data-action="notice" data-notice="monitoring">◷ Monitoring</button>
```

- [ ] **Step 4: Build + browser verify**

Run: `bunx astro build` → PASS.
In dev, click `Save` → a toast appears: `ERROR ERROR 42501… / HINT: superusers… / Become one →`. Click `Autopilot` → NOTICE toast with `Open demo →`. Click `Docs` / `README.md` → opens GitHub in a new tab. Verify in the browser via Playwright:
```js
document.querySelector('[data-notice="save"]').click();
document.querySelectorAll('[data-console] [role="status"]').length // 1
```
Expected: `1` (toast rendered).

- [ ] **Step 5: Commit**

```bash
git add src/components/studio/QueryChrome.astro src/components/studio/TopBar.astro src/scripts/studio.ts
git commit -m "feat: in-character console redirects for non-functional chrome controls"
```

---

### Task 6: Honestly-inert ambient status

**Files:**
- Modify: `src/components/studio/TopBar.astro`, `StatusBar.astro`, `QueryChrome.astro`, `MobileQueryCard.astro` (mark decorative status non-interactive)

**Interfaces:** none (visual/markup only).

- [ ] **Step 1: Mark inert elements**

Add `cursor-default select-none` and (where purely decorative) `aria-hidden="true"` to: TopBar `PRODUCTION • ONLINE` span, `● Online` span, version span, the `▤ ＋` brand-adjacent glyph group; the result-meta strip in `QueryChrome.astro` (`● N rows | C columns | EXEC TIME` row — add `cursor-default select-none`); the traffic-light dot groups in `QueryChrome.astro` and `MobileQueryCard.astro` (already `aria-hidden`; add `select-none`); the whole `StatusBar.astro` footer (add `cursor-default select-none` to the root `<footer>`).

Example (TopBar version + status):
```astro
    <span class="flex items-center gap-1.5 text-ok cursor-default select-none">
      <span class="h-2 w-2 rounded-full bg-ok animate-pulse-dot" aria-hidden="true"></span> Online
    </span>
    ...
    <span class="text-faint cursor-default select-none" aria-hidden="true">v0.9.29</span>
```
Example (StatusBar root):
```astro
<footer class="flex h-7 shrink-0 cursor-default select-none items-center justify-between border-t border-edge bg-panel px-4 text-[11.5px] text-dim">
```

- [ ] **Step 2: Build + browser verify**

Run: `bunx astro build` → PASS.
In the browser, hover the version label and status bar: cursor stays the default arrow (not a pointer); text isn't selectable-highlighted on drag. The `Live Demo` and `★ GitHub` links still show a pointer.

- [ ] **Step 3: Commit**

```bash
git add src/components/studio/TopBar.astro src/components/studio/StatusBar.astro src/components/studio/QueryChrome.astro src/components/studio/MobileQueryCard.astro
git commit -m "style: mark ambient status chrome as non-interactive"
```

---

### Task 7: RUN re-run animation

**Files:**
- Modify: `src/scripts/studio.ts` (`runQuery`, ⌘+Enter binding, dispatch case)
- Modify: `src/components/studio/QueryChrome.astro` (RUN button gets `data-action="run"`)
- Modify: `src/styles/global.css` (`.is-rerunning` shimmer)

**Interfaces:**
- Consumes: `sectionById`, `currentHash` (existing in studio.ts), `studioConsole` (Task 4).

- [ ] **Step 1: Add the shimmer CSS**

In `src/styles/global.css`, after the `.exp-row` rules:
```css
/* RUN re-run shimmer on the active result pane */
@keyframes rerun-fade { 0% { opacity: 0.35; } 100% { opacity: 1; } }
.studio-results.is-rerunning { animation: rerun-fade 0.5s ease; }
@media (prefers-reduced-motion: reduce) {
  .studio-results.is-rerunning { animation: none; }
}
```

- [ ] **Step 2: Wire RUN button**

In `QueryChrome.astro`, the RUN button already has `data-run`; add `data-action="run"` to it:
```astro
    <button type="button" class="flex items-center gap-1.5 rounded-md bg-primary px-4 py-1.5 font-semibold text-white hover:bg-primary-bright" data-action="run" data-run>
      <span aria-hidden="true">▶</span> RUN
    </button>
```

- [ ] **Step 3: Add `runQuery` + dispatch case + keybinding in `studio.ts`**

Add the function near `studioConsole`:
```ts
function runQuery() {
  const id = currentHash();
  const meta = sectionById[id] ?? sectionById['home'];
  const pane = document.querySelector<HTMLElement>(`[data-section="${id}"] .studio-results`);
  if (pane) {
    pane.classList.remove('is-rerunning');
    void pane.offsetWidth; // restart animation
    pane.classList.add('is-rerunning');
    pane.addEventListener('animationend', () => pane.classList.remove('is-rerunning'), { once: true });
  }
  studioConsole.ok(`${meta.rows} rows (${meta.execMs}ms)`);
}
```
Add a `case` to the delegated handler from Task 5:
```ts
    if (action === 'run') { e.preventDefault(); runQuery(); }
```
Add the keyboard binding inside `init()` (near hash routing):
```ts
  window.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); runQuery(); }
  });
```

- [ ] **Step 4: Build + browser verify**

Run: `bunx astro build` → PASS.
In dev, click `▶ RUN`: the result content briefly fades in and a `✓ 1 rows (3ms)` toast appears (counts match the active section). Press `⌘/Ctrl+Enter`: same effect.

- [ ] **Step 5: Commit**

```bash
git add src/scripts/studio.ts src/components/studio/QueryChrome.astro src/styles/global.css
git commit -m "feat: RUN re-runs the active query with a shimmer + result toast"
```

---

### Task 8: Copy deep link

**Files:**
- Modify: `src/scripts/studio.ts` (`copyLink` + dispatch case). (Copy button already wired `data-action="copy-link"` in Task 5.)

**Interfaces:**
- Consumes: `currentHash`, `studioConsole`.

- [ ] **Step 1: Add `copyLink` + dispatch case**

Add to `studio.ts`:
```ts
async function copyLink() {
  const id = currentHash();
  const url = `${location.origin}/#${id}`;
  try {
    await navigator.clipboard.writeText(url);
    studioConsole.ok(`copied link to #${id}`);
  } catch {
    studioConsole.notice(`copy this: ${url}`);
  }
}
```
Add the `case` to the delegated handler:
```ts
    if (action === 'copy-link') { e.preventDefault(); copyLink(); }
```

- [ ] **Step 2: Build + browser verify**

Run: `bunx astro build` → PASS.
In dev, navigate to `#compare`, click `⧉ Copy`: a `✓ copied link to #compare` toast appears; clipboard holds `http://localhost:4321/#compare`. Verify:
```js
document.querySelector('[data-action="copy-link"]').click();
await navigator.clipboard.readText(); // ends with "/#compare"
```

- [ ] **Step 3: Commit**

```bash
git add src/scripts/studio.ts
git commit -m "feat: Copy puts a deep link to the current section on the clipboard"
```

---

### Task 9: Export section data

**Files:**
- Modify: each `src/components/sections/*Section.astro` (emit embedded JSON payload)
- Modify: `src/scripts/studio.ts` (`exportSection`, `downloadBlob`, dispatch case)

**Interfaces:**
- Consumes: `serialize` (Task 2), `currentHash`, `studioConsole`.
- Payload contract: `<script type="application/json" data-export-payload="{id}" data-export-filename="{file}" data-export-format="json|csv">[…rows…]</script>` — the same data the section already renders.

- [ ] **Step 1: Emit payloads from each section**

`HomeSection.astro` — after the markup, using the existing `stats` array:
```astro
<script type="application/json" data-export-payload="home" data-export-filename="home.json" data-export-format="json" set:html={JSON.stringify(stats)} />
```
`FeaturesSection.astro` (uses `features`):
```astro
<script type="application/json" data-export-payload="features" data-export-filename="features.json" data-export-format="json" set:html={JSON.stringify(features)} />
```
`DatabasesSection.astro` (uses `databases`):
```astro
<script type="application/json" data-export-payload="databases" data-export-filename="databases.json" data-export-format="json" set:html={JSON.stringify(databases)} />
```
`TechStackSection.astro` (uses `layers`):
```astro
<script type="application/json" data-export-payload="tech_stack" data-export-filename="tech_stack.json" data-export-format="json" set:html={JSON.stringify(layers)} />
```
`GetStartedSection.astro` (uses `steps`):
```astro
<script type="application/json" data-export-payload="get_started" data-export-filename="get_started.json" data-export-format="json" set:html={JSON.stringify(steps)} />
```
`FaqSection.astro` (uses `faqs`):
```astro
<script type="application/json" data-export-payload="faq" data-export-filename="faq.json" data-export-format="json" set:html={JSON.stringify(faqs)} />
```
`CompareSection.astro` — build a flat CSV-friendly array in the frontmatter and emit as CSV:
```astro
---
// add after `rows` is defined:
const exportRows = rows.map((r) => ({
  tool: r.tool,
  recommended: r.recommended ?? false,
  zero_install: r.scores[0],
  mobile: r.scores[1],
  ai_native: r.scores[2],
  sso_oidc: r.scores[3],
  free: r.scores[4],
  price: r.price,
}));
---
```
```astro
<script type="application/json" data-export-payload="compare" data-export-filename="compare.csv" data-export-format="csv" set:html={JSON.stringify(exportRows)} />
```
`DeploySection.astro` — emit the real targets as CSV. In frontmatter:
```astro
---
// deployTargets already imported; add:
const exportRows = deployTargets.map((t) => ({ platform: t.name, slug: t.slug, category: t.category, status: t.status }));
---
```
```astro
<script type="application/json" data-export-payload="deploy" data-export-filename="deploy.csv" data-export-format="csv" set:html={JSON.stringify(exportRows)} />
```

- [ ] **Step 2: Add `exportSection` + `downloadBlob` + dispatch case in `studio.ts`**

Add the import:
```ts
import { serialize, type Row } from './lib/export';
```
Add the functions:
```ts
function downloadBlob(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function exportSection() {
  const id = currentHash();
  const payloadEl = document.querySelector<HTMLElement>(`[data-export-payload="${id}"]`);
  if (!payloadEl?.textContent) { studioConsole.notice('nothing to export from this view'); return; }
  const rows = JSON.parse(payloadEl.textContent) as Row[];
  const format = (payloadEl.dataset.exportFormat as 'json' | 'csv') ?? 'json';
  const filename = payloadEl.dataset.exportFilename ?? `${id}.${format}`;
  const content = serialize(rows, format);
  downloadBlob(content, filename, format === 'csv' ? 'text/csv' : 'application/json');
  studioConsole.ok(`exported ${filename} (${rows.length} rows)`);
}
```
Add the `case`:
```ts
    if (action === 'export') { e.preventDefault(); exportSection(); }
```

- [ ] **Step 3: Build + browser verify**

Run: `bunx astro build` → PASS.
In dev, on `#features` click `↑ Export`: `features.json` downloads (17 objects) and a `✓ exported features.json (17 rows)` toast shows. On `#deploy`, Export downloads `deploy.csv` with a `platform,slug,category,status` header and 39 rows. Verify payload presence:
```js
JSON.parse(document.querySelector('[data-export-payload="features"]').textContent).length // 17
```

- [ ] **Step 4: Commit**

```bash
git add src/components/sections src/scripts/studio.ts
git commit -m "feat: Export downloads the current section's data as JSON/CSV"
```

---

### Task 10: Explain panel

**Files:**
- Modify: `src/data/sections.ts` (add `explain` to `SectionMeta` + each section)
- Modify: `src/components/studio/SectionShell.astro` (render the panel)
- Modify: `src/components/studio/MobileQueryCard.astro` (Explain button)
- Modify: `src/scripts/studio.ts` (`toggleExplain` + dispatch case)

**Interfaces:**
- Consumes: `SectionMeta`, per-section `explain` string.
- Produces: `data-action="explain"` toggles the nearest `[data-explain="{id}"]` panel.

- [ ] **Step 1: Add `explain` to the manifest**

In `src/data/sections.ts`, add `explain: string;` to the `SectionMeta` interface, and an `explain` value to each section:
```ts
// home
explain: 'Returns the LibreDB Studio overview: a modern, AI-powered, browser-based SQL IDE with SSO across 7+ engines — free and open source under MIT.',
// features
explain: 'Lists 17 capabilities grouped by area — from the Monaco SQL editor and NL2SQL Copilot to data masking and the DBA toolkit.',
// databases
explain: 'The 7 supported engines and their drivers — PostgreSQL, MySQL, Oracle, SQL Server, SQLite, MongoDB, Redis — behind one unified interface.',
// compare
explain: 'Scores LibreDB Studio against DataGrip, DBeaver, pgAdmin and TablePlus on zero-install, mobile, AI, SSO and price — ordered by how free and open each is.',
// tech_stack
explain: 'The production stack in four layers: frontend (Next.js 16, React 19), editor & data (Monaco, TanStack, ReactFlow), AI & auth (Gemini, OIDC), and devops (Docker, Bun).',
// get_started
explain: 'Three steps to run locally — clone & install, configure env, launch — plus a one-command Docker alternative.',
// faq
explain: 'The nine most common questions: pricing, self-hosting, AI providers, security & SSO, supported databases, and how it compares to legacy tools.',
// deploy
explain: 'Every place LibreDB Studio runs — 39 targets across registries, self-hosted PaaS, Kubernetes, managed PaaS and cloud — from one open-source image.',
```

- [ ] **Step 2: Render the panel in `SectionShell.astro`**

Add the import (already imports types) and insert the panel between `<QueryChrome … />` and `<div class="studio-results">`:
```astro
  <div data-explain={section.id} hidden class="border-b border-edge bg-panel/60 px-4 py-3 lg:px-8">
    <div class="mx-auto max-w-5xl text-[13px] leading-relaxed">
      <span class="font-semibold text-ai">✦ AI · Query explanation</span>
      <p class="mt-1 text-muted">{section.explain}</p>
    </div>
  </div>
```

- [ ] **Step 3: Add Explain button to `MobileQueryCard.astro`**

The card header already shows `✦ Explain` as a span; make it a button:
```astro
    <button type="button" class="text-ai" data-action="explain" aria-expanded="false">✦ Explain</button>
```

- [ ] **Step 4: Add `toggleExplain` + dispatch case in `studio.ts`**

```ts
function toggleExplain(trigger: HTMLElement) {
  const section = trigger.closest<HTMLElement>('[data-section]');
  const id = section?.dataset.section ?? currentHash();
  const panel = document.querySelector<HTMLElement>(`[data-explain="${id}"]`);
  if (!panel) return;
  const open = panel.hasAttribute('hidden');
  panel.toggleAttribute('hidden', !open);
  document
    .querySelectorAll<HTMLElement>(`[data-section="${id}"] [data-action="explain"], [data-explain="${id}"] ~ * [data-action="explain"]`)
    .forEach((b) => b.setAttribute('aria-expanded', String(open)));
}
```
Add the `case`:
```ts
    if (action === 'explain') { e.preventDefault(); toggleExplain(el); }
```

- [ ] **Step 5: Build + browser verify**

Run: `bunx astro build` → PASS.
In dev, click `✦ Explain` (sub-toolbar) or `⚡ Explain` (result tab): the AI explanation panel for the active section toggles open/closed; `aria-expanded` flips. On mobile, the card's `✦ Explain` toggles that section's panel.

- [ ] **Step 6: Commit**

```bash
git add src/data/sections.ts src/components/studio/SectionShell.astro src/components/studio/MobileQueryCard.astro src/scripts/studio.ts
git commit -m "feat: AI-styled Explain panel per section"
```

---

### Task 11: Command palette (⌘K)

**Files:**
- Create: `src/components/studio/CommandPalette.astro`
- Modify: `src/pages/index.astro` (mount it)
- Modify: `src/components/studio/TopBar.astro` (⌘K hint chip → `data-action="palette"`)
- Modify: `src/scripts/studio.ts` (palette controller; `palette` dispatch case; ⌘K keybinding)

**Interfaces:**
- Consumes: `sections` (manifest), `filterItems` (Task 3), `currentHash`, `copyLink`/`exportSection` (Tasks 8/9).
- Produces: `openPalette()` / `closePalette()`.

- [ ] **Step 1: Create the palette shell**

```astro
---
// src/components/studio/CommandPalette.astro
---
<div data-palette-root hidden class="fixed inset-0 z-50">
  <div class="absolute inset-0 bg-black/60" data-palette-close></div>
  <div
    role="dialog"
    aria-modal="true"
    aria-label="Command palette"
    class="absolute left-1/2 top-24 w-[min(92vw,560px)] -translate-x-1/2 border border-edge-strong bg-panel shadow-2xl"
  >
    <input
      data-palette-input
      type="text"
      placeholder="Type a command or search sections…"
      class="w-full border-b border-edge bg-canvas px-4 py-3 text-[14px] text-fg placeholder:text-faint focus:outline-none"
      aria-label="Command palette input"
    />
    <ul data-palette-list class="max-h-[50vh] overflow-y-auto py-1 text-[13px]"></ul>
  </div>
</div>
```

- [ ] **Step 2: Mount in `index.astro`**

Add import:
```astro
import CommandPalette from '../components/studio/CommandPalette.astro';
```
Add next to `<Console />`:
```astro
    <CommandPalette />
```

- [ ] **Step 3: Add ⌘K chip to TopBar**

In `TopBar.astro`, before the `Live Demo` link:
```astro
    <button type="button" class="hidden items-center gap-1.5 rounded-md border border-edge-strong px-2 py-1 text-[11.5px] text-faint hover:text-fg xl:flex" data-action="palette" aria-label="Open command palette">⌘K</button>
```

- [ ] **Step 4: Palette controller in `studio.ts`**

Add import:
```ts
import { filterItems } from './lib/filter';
```
Add the controller (uses `sections` already imported):
```ts
/* ---- Command palette ---- */
interface PaletteItem { label: string; hint: string; run: () => void; }

function paletteItems(): PaletteItem[] {
  const jumps: PaletteItem[] = sections.map((s) => ({
    label: `Jump to ${s.table}`,
    hint: `${s.rows} rows`,
    run: () => { location.hash = `#${s.id}`; },
  }));
  const actions: PaletteItem[] = [
    { label: 'Copy link to current section', hint: 'clipboard', run: () => copyLink() },
    { label: 'Export current section', hint: 'download', run: () => exportSection() },
    { label: 'Open live demo', hint: 'app.libredb.org', run: () => window.open('https://app.libredb.org', '_blank') },
    { label: 'Open GitHub', hint: 'repo', run: () => window.open('https://github.com/libredb/libredb-studio', '_blank') },
    { label: 'View README / docs', hint: 'github', run: () => window.open('https://github.com/libredb/libredb-studio#readme', '_blank') },
  ];
  return [...jumps, ...actions];
}

let paletteHighlight = 0;
let paletteFiltered: PaletteItem[] = [];
let paletteLastFocus: HTMLElement | null = null;

function renderPalette(query: string) {
  const list = document.querySelector<HTMLElement>('[data-palette-list]');
  if (!list) return;
  paletteFiltered = filterItems(query, paletteItems(), (it) => it.label + ' ' + it.hint);
  paletteHighlight = 0;
  list.innerHTML = '';
  paletteFiltered.forEach((it, i) => {
    const li = document.createElement('li');
    li.className = `flex cursor-pointer items-center justify-between px-4 py-2 ${i === 0 ? 'bg-raised text-bright' : 'text-fg'}`;
    li.innerHTML = `<span>${it.label}</span><span class="text-[11px] text-faint">${it.hint}</span>`;
    li.addEventListener('mousemove', () => setHighlight(i));
    li.addEventListener('click', () => { it.run(); closePalette(); });
    list.appendChild(li);
  });
}

function setHighlight(i: number) {
  paletteHighlight = i;
  const list = document.querySelector('[data-palette-list]');
  if (!list) return;
  [...list.children].forEach((li, idx) => {
    li.className = `flex cursor-pointer items-center justify-between px-4 py-2 ${idx === i ? 'bg-raised text-bright' : 'text-fg'}`;
  });
}

function openPalette() {
  const root = document.querySelector<HTMLElement>('[data-palette-root]');
  const input = document.querySelector<HTMLInputElement>('[data-palette-input]');
  if (!root || !input) return;
  paletteLastFocus = document.activeElement as HTMLElement;
  root.removeAttribute('hidden');
  input.value = '';
  renderPalette('');
  input.focus();
}

function closePalette() {
  const root = document.querySelector<HTMLElement>('[data-palette-root]');
  root?.setAttribute('hidden', '');
  paletteLastFocus?.focus();
}
```
Add the `palette` dispatch case and the close/keyboard wiring inside `init()`:
```ts
    if (action === 'palette') { e.preventDefault(); openPalette(); }
```
```ts
  // Palette open/close + keyboard
  document.querySelector('[data-palette-close]')?.addEventListener('click', closePalette);
  const paletteInput = document.querySelector<HTMLInputElement>('[data-palette-input]');
  paletteInput?.addEventListener('input', () => renderPalette(paletteInput.value));
  window.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); openPalette(); return; }
    const root = document.querySelector('[data-palette-root]');
    if (!root || root.hasAttribute('hidden')) return;
    if (e.key === 'Escape') { e.preventDefault(); closePalette(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight(Math.min(paletteHighlight + 1, paletteFiltered.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlight(Math.max(paletteHighlight - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); paletteFiltered[paletteHighlight]?.run(); closePalette(); }
  });
```

- [ ] **Step 5: Build + browser verify**

Run: `bunx astro build` → PASS.
In dev: press `⌘/Ctrl+K` → palette opens, input focused. Type `dep` → list filters to `Jump to deploy` first; `Enter` → navigates to `#deploy` and palette closes. `Esc` closes and restores focus. Clicking `✦ AI` / `✦ NL2SQL` also opens the palette.

- [ ] **Step 6: Commit**

```bash
git add src/components/studio/CommandPalette.astro src/pages/index.astro src/components/studio/TopBar.astro src/scripts/studio.ts
git commit -m "feat: ⌘K command palette (jump to sections + actions)"
```

---

### Task 12: Explorer search live-filter

**Files:**
- Modify: `src/components/studio/Explorer.astro` (add `data-explorer-root` to root)
- Modify: `src/scripts/studio.ts` (`wireExplorerSearch`)

**Interfaces:**
- Consumes: `fuzzyMatch` (Task 3).

- [ ] **Step 1: Tag the explorer root**

In `Explorer.astro`, add `data-explorer-root` to the outer `<div class="flex h-full flex-col text-[13px]">`:
```astro
<div data-explorer-root class="flex h-full flex-col text-[13px]">
```

- [ ] **Step 2: Wire search in `studio.ts`**

Add the import:
```ts
import { fuzzyMatch } from './lib/filter';
```
Add the function and call it in `init()`:
```ts
function wireExplorerSearch() {
  document.querySelectorAll<HTMLInputElement>('[data-explorer-search]').forEach((input) => {
    const scope = input.closest<HTMLElement>('[data-explorer-root]');
    if (!scope) return;
    const items = [...scope.querySelectorAll<HTMLElement>('[data-explorer-item]')];
    const apply = () => {
      const q = input.value;
      items.forEach((li) => {
        const name = li.dataset.explorerItem ?? '';
        li.hidden = fuzzyMatch(q, name) === null;
      });
    };
    input.addEventListener('input', apply);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const first = items.find((li) => !li.hidden);
        const id = first?.dataset.explorerItem;
        if (id) { location.hash = `#${id}`; input.blur(); }
      }
    });
  });
}
```
Call inside `init()`:
```ts
  wireExplorerSearch();
```

- [ ] **Step 3: Build + browser verify**

Run: `bunx astro build` → PASS.
In dev (desktop), type `comp` in the Explorer search → only `compare` row remains visible; press `Enter` → navigates to `#compare`. Clearing the box restores all rows.

- [ ] **Step 4: Commit**

```bash
git add src/components/studio/Explorer.astro src/scripts/studio.ts
git commit -m "feat: live-filter the explorer tree + Enter to jump"
```

---

### Task 13: Final QA pass

**Files:** none (verification + fixes only).

- [ ] **Step 1: Full build**

Run: `bunx astro build`
Expected: PASS (5 pages), no type errors.

- [ ] **Step 2: Run all unit tests**

Run: `bun test src/scripts/lib/`
Expected: all PASS (console-copy, export, filter).

- [ ] **Step 3: Browser smoke matrix (dev :4321)**

Verify each row produces an action (no silent click), at 1440px and 390px:
- Save / BEGIN / SANDBOX / EDIT / IMPORT / Format / Clear / Lines / Query / Monitoring / History / Saved / Charts / Autopilot / Pivot / Diff / Dashboard / newtab(＋) / closetab(✕) → console toast appears.
- RUN, ⌘+Enter → shimmer + `✓ rows` toast. Copy → clipboard + toast. Export → file downloads. Explain → panel toggles. AI / NL2SQL / ⌘K → palette. Docs / README → new tab. Explorer search → filters + Enter jumps.
- Inert: version, status bar, result-meta, traffic dots → default cursor, no toast.

- [ ] **Step 4: Accessibility + reduced-motion checks**

- Tab to the palette trigger, open with Enter, confirm focus lands in the input, `Esc` restores focus.
- Confirm toast container is `aria-live="polite"`; redirect controls are `<button>` with text labels.
- With OS "reduce motion" on, RUN does not animate (no fade).

- [ ] **Step 5: Commit any fixes + final**

```bash
git add -A
git commit -m "test: QA pass for interactive controls (build, units, a11y, reduced-motion)"
```

---

## Self-Review (completed by plan author)
- **Spec coverage:** Every control in spec §9 maps to a task — redirects (Task 5), inert (Task 6), RUN (7), Copy (8), Export (9), Explain (10), palette + AI/NL2SQL (11), Docs/README (anchors in Task 5), search (12). Console mechanism (4), copy map (1), serializers (2), filter (3).
- **Placeholder scan:** none — every code step has complete code; copy strings are verbatim.
- **Type consistency:** `studioConsole`, `currentHash`, `sectionById`, `sections`, `serialize`, `Row`, `fuzzyMatch`, `filterItems`, `NOTICES`, `openPalette`, `copyLink`, `exportSection` used consistently across tasks; `data-action` values (`notice|run|copy-link|export|explain|palette`) match between markup (Task 5/7/9/10/11) and dispatch (Tasks 5,7,8,9,10,11).
