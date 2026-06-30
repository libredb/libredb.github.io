/**
 * Main-thread bridge for /playground. Spawns the db worker, exchanges
 * id-tagged messages, and renders results into the editor's grid/console.
 * Touches navigator/Worker only at import time on the client (never SSR).
 */
import type { WorkerRequest, WorkerResponse, RunResult, Mode } from './protocol';

/** What triggered a run — shown in the activity log. */
type Source = 'editor' | 'system';

interface ActivityEntry {
  command: string;
  summary: string;
  ms: number;
  ok: boolean;
  source: Source;
}

const MAX_LOG_ENTRIES = 50;

const pgRoot = document.querySelector<HTMLElement>('[data-pg-root]');
if (pgRoot) init(pgRoot);

function init(root: HTMLElement): void {
  const input = root.querySelector<HTMLTextAreaElement>('[data-pg-input]');
  const runBtn = root.querySelector<HTMLButtonElement>('[data-pg-run]');
  const resetBtn = root.querySelector<HTMLButtonElement>('[data-pg-reset]');
  const grid = root.querySelector<HTMLElement>('[data-pg-grid]');
  const status = root.querySelector<HTMLElement>('[data-pg-status]');
  const log = root.querySelector<HTMLElement>('[data-pg-log]');
  const badge = root.querySelector<HTMLElement>('[data-pg-badge]');
  const banner = root.querySelector<HTMLElement>('[data-pg-banner]');
  if (!input || !runBtn || !grid) return;

  const worker = new Worker(new URL('./db.worker.ts', import.meta.url), { type: 'module' });

  // Distributive omit so each request variant keeps its own fields (`Omit` over a
  // union would collapse to just the shared `op`, dropping `text`).
  type RequestBody = WorkerRequest extends infer T ? (T extends { id: number } ? Omit<T, 'id'> : never) : never;

  let seq = 0;
  const pending = new Map<number, (r: WorkerResponse) => void>();
  worker.addEventListener('message', (e: MessageEvent<WorkerResponse>) => {
    pending.get(e.data.id)?.(e.data);
    pending.delete(e.data.id);
  });
  function call(req: RequestBody): Promise<WorkerResponse> {
    const id = ++seq;
    return new Promise((resolve) => {
      pending.set(id, resolve);
      worker.postMessage({ ...req, id } as WorkerRequest);
    });
  }

  // Handshake: learn persistence mode, show badge/banner.
  void call({ op: 'ready' }).then((res) => {
    if (res.kind === 'ready') showMode(res.mode);
  });
  function showMode(mode: Mode): void {
    if (badge) {
      badge.textContent = mode === 'opfs' ? 'OPFS · persistent' : 'in-memory · this session';
      badge.dataset.mode = mode;
    }
    if (banner) banner.hidden = mode === 'opfs';
  }

  async function run(text: string, source: Source = 'editor'): Promise<void> {
    const t = text.trim();
    if (t === '') return;
    const started = performance.now();
    const res = await call({ op: 'run', text: t });
    const ms = performance.now() - started;
    if (res.kind === 'result') render(res.result, t, ms, source);
  }

  async function doReset(): Promise<void> {
    const res = await call({ op: 'reset' });
    if (res.kind === 'result') render(res.result, 'reset', 0, 'system');
    await run('prefix users:', 'system');
  }

  // Every run updates the grid/status AND appends one activity-log entry, so the
  // console is a complete history (not just the write commands).
  function render(result: RunResult, command: string, ms: number, source: Source): void {
    if (result.kind === 'rows') {
      const n = result.rows.length;
      const summary = `${n} ${n === 1 ? 'row' : 'rows'}`;
      setStatus(command, summary, ms);
      renderGrid(grid!, result.columns, result.rows);
      logActivity(log, { command, summary, ms, ok: true, source });
    } else if (result.kind === 'error') {
      setStatus(command, '✕ error', ms);
      logActivity(log, { command, summary: result.error, ms, ok: false, source });
    } else {
      setStatus(command, result.message, ms);
      logActivity(log, { command, summary: result.message, ms, ok: true, source });
    }
  }

  function setStatus(command: string, summary: string, ms: number): void {
    if (!status) return;
    status.hidden = false;
    status.replaceChildren();
    const cmd = document.createElement('span');
    cmd.className = 'text-fg';
    cmd.textContent = `▸ ${command}`;
    const meta = document.createElement('span');
    meta.className = 'text-faint';
    meta.textContent = `· ${summary} · ${ms < 1 ? '<1' : ms.toFixed(1)} ms`;
    status.append(cmd, meta);
    retrigger(status); // replay the fade even when the text is identical
  }

  runBtn.addEventListener('click', () => void run(input.value));
  input.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      void run(input.value);
    }
  });
  resetBtn?.addEventListener('click', () => void doReset());

  // Cheatsheet: clicking a command loads it into the editor and clears the
  // current result (but NOT the activity log — that's history), so you can
  // read/edit it before pressing Run.
  root.querySelectorAll<HTMLElement>('[data-cmd]').forEach((b) =>
    b.addEventListener('click', () => {
      const cmd = b.dataset.cmd ?? '';
      input.value = cmd;
      grid.replaceChildren();
      if (status) status.hidden = true; // stale timing/echo shouldn't linger before the run
      renderHint(grid, 'Press ▶ Run (or ⌘/Ctrl+Enter) to execute.');
      input.focus();
      input.setSelectionRange(cmd.length, cmd.length);
    }),
  );

  // Free the exclusive OPFS lock so a reload reacquires cleanly. The worker
  // closes the db and self-terminates on 'close'; we must NOT terminate() here,
  // or it would race (and usually win) before the worker runs db.close().
  // Skip on bfcache (persisted) so a back/forward restore keeps a live worker.
  window.addEventListener('pagehide', (e) => {
    if (e.persisted) return;
    void call({ op: 'close' });
  });

  // First view: scan the seeded users namespace.
  void run('prefix users:', 'system');
}

/**
 * Render rows as a table built entirely with DOM methods + textContent — never
 * innerHTML with interpolated data — so database values (arbitrary user input)
 * cannot inject markup. Only the static class strings are set as attributes.
 */
/** Replay a CSS animation on an element even if its content is unchanged. */
function retrigger(el: HTMLElement): void {
  el.classList.remove('pg-result-in');
  void el.offsetWidth; // force reflow so the animation restarts
  el.classList.add('pg-result-in');
}

/** Show a single guidance line in the result area (e.g. after loading a command). */
function renderHint(grid: HTMLElement, message: string): void {
  grid.replaceChildren();
  const p = document.createElement('p');
  p.className = 'p-4 text-[13px] text-faint';
  p.textContent = message;
  grid.append(p);
}

function renderGrid(grid: HTMLElement, columns: string[], rows: Array<Record<string, unknown>>): void {
  grid.replaceChildren();
  if (rows.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'p-4 text-[13px] text-faint pg-result-in';
    empty.textContent = 'No rows.';
    grid.append(empty);
    return;
  }

  const table = document.createElement('table');
  table.className = 'w-full border-collapse font-mono text-[12.5px] pg-result-in';

  const headRow = document.createElement('tr');
  for (const c of columns) {
    const th = document.createElement('th');
    th.className = 'border-b border-edge px-3 py-2 text-left font-medium text-muted';
    th.textContent = c;
    headRow.append(th);
  }
  const thead = document.createElement('thead');
  thead.append(headRow);
  table.append(thead);

  const tbody = document.createElement('tbody');
  for (const r of rows) {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-panel/60';
    for (const c of columns) {
      const td = document.createElement('td');
      td.className = 'border-b border-edge px-3 py-1.5 text-fg';
      td.textContent = String(r[c] ?? '');
      tr.append(td);
    }
    tbody.append(tr);
  }
  table.append(tbody);
  grid.append(table);
}

/**
 * Append one structured entry to the activity log — every run, not just writes.
 * Fields: time (HH:MM:SS, full datetime on hover), status, command, outcome
 * summary, duration, and the trigger source. Newest first, capped to keep the DOM small.
 */
function logActivity(host: HTMLElement | null, entry: ActivityEntry): void {
  if (!host) return;
  const now = new Date();

  const line = document.createElement('div');
  line.className = 'flex items-baseline gap-2 leading-relaxed';
  line.title = now.toLocaleString();

  const time = span('shrink-0 text-faint tabular-nums', now.toTimeString().slice(0, 8));
  const stat = span(entry.ok ? 'shrink-0 text-ok' : 'shrink-0 text-bad', entry.ok ? '✓' : '✗');
  const cmd = span('min-w-0 flex-1 truncate text-fg', entry.command);
  const summary = span('shrink-0 max-w-[40%] truncate text-faint', entry.summary);
  const dur = span('shrink-0 text-faint tabular-nums', `${entry.ms < 1 ? '<1' : entry.ms.toFixed(1)} ms`);
  const src = span('shrink-0 text-dim', entry.source);

  line.append(time, stat, cmd, summary, dur, src);
  host.prepend(line);

  while (host.childElementCount > MAX_LOG_ENTRIES) host.lastElementChild?.remove();
}

function span(className: string, text: string): HTMLSpanElement {
  const el = document.createElement('span');
  el.className = className;
  el.textContent = text;
  return el;
}
