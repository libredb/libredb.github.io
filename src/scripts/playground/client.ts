/**
 * Main-thread bridge for /playground. Spawns the db worker, exchanges
 * id-tagged messages, and renders results into the editor's grid/console.
 * Touches navigator/Worker only at import time on the client (never SSR).
 */
import type { WorkerRequest, WorkerResponse, RunResult, Mode } from './protocol';

const pgRoot = document.querySelector<HTMLElement>('[data-pg-root]');
if (pgRoot) init(pgRoot);

function init(root: HTMLElement): void {
  const input = root.querySelector<HTMLTextAreaElement>('[data-pg-input]');
  const runBtn = root.querySelector<HTMLButtonElement>('[data-pg-run]');
  const resetBtn = root.querySelector<HTMLButtonElement>('[data-pg-reset]');
  const grid = root.querySelector<HTMLElement>('[data-pg-grid]');
  const status = root.querySelector<HTMLElement>('[data-pg-status]');
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

  async function run(text: string): Promise<void> {
    const t = text.trim();
    if (t === '') return;
    const started = performance.now();
    const res = await call({ op: 'run', text: t });
    const ms = performance.now() - started;
    if (res.kind === 'result') render(res.result, t, ms);
  }

  async function doReset(): Promise<void> {
    const res = await call({ op: 'reset' });
    if (res.kind === 'result') render(res.result, 'reset', 0);
    await run('prefix users:');
  }

  function render(result: RunResult, command: string, ms: number): void {
    // The status strip echoes the command + outcome + timing so an instant query
    // is legible; it re-animates on every run, even an identical re-run.
    if (result.kind === 'rows') {
      const n = result.rows.length;
      setStatus(command, `${n} ${n === 1 ? 'row' : 'rows'}`, ms);
      renderGrid(grid!, result.columns, result.rows);
    } else if (result.kind === 'error') {
      setStatus(command, '✕ error', ms);
      renderConsole(`✕ ${result.error}`, 'error');
    } else {
      setStatus(command, result.message, ms);
      renderConsole(result.message, 'ok');
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
  // previous result, so you can read/edit it before pressing Run.
  const log = root.querySelector<HTMLElement>('[data-pg-log]');
  root.querySelectorAll<HTMLElement>('[data-cmd]').forEach((b) =>
    b.addEventListener('click', () => {
      const cmd = b.dataset.cmd ?? '';
      input.value = cmd;
      grid.replaceChildren();
      log?.replaceChildren();
      if (status) status.hidden = true; // stale timing/echo shouldn't linger before the run
      renderHint(grid, 'Press ▶ Run (or ⌘/Ctrl+Enter) to execute.');
      input.focus();
      input.setSelectionRange(cmd.length, cmd.length);
    }),
  );

  // Free the exclusive OPFS lock so a reload reacquires cleanly.
  window.addEventListener('pagehide', () => {
    void call({ op: 'close' });
    worker.terminate();
  });

  // First view: scan the seeded users namespace.
  void run('prefix users:');
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

/** Append a line to the inline console log. */
function renderConsole(message: string, kind: 'ok' | 'error'): void {
  const host = document.querySelector<HTMLElement>('[data-pg-log]');
  if (!host) return;
  const line = document.createElement('pre');
  line.className = kind === 'error' ? 'whitespace-pre-wrap text-bad' : 'whitespace-pre-wrap text-ok';
  line.textContent = message;
  host.prepend(line);
}
