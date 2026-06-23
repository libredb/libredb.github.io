import { sections, sectionById } from '../data/sections';
import type { ConsoleMessage, ConsoleKind } from './lib/console-copy';
import { NOTICES } from './lib/console-copy';
import { serialize, type Row } from './lib/export';

/**
 * Studio interaction layer (progressive enhancement).
 * - Adds `.js` to the shell → desktop switches to viewport-locked single-view.
 * - Explorer selection swaps the active section (desktop) / scrolls (mobile).
 * - URL hash routing keeps deep links + back/forward working.
 * - Mobile drawer open/close; explorer column (schema) expand/collapse.
 */

const studio = document.querySelector<HTMLElement>('[data-studio]');
const isDesktop = () => window.matchMedia('(min-width: 1024px)').matches;
const ids = new Set(sections.map((s) => s.id));

function setActive(id: string, opts: { scroll?: boolean } = {}) {
  if (!ids.has(id)) id = 'home';
  const meta = sectionById[id];

  // Toggle sections (desktop locked mode uses .is-active; CSS ignores it on mobile)
  document.querySelectorAll<HTMLElement>('[data-section]').forEach((el) => {
    el.classList.toggle('is-active', el.dataset.section === id);
  });

  // Reset the active result pane scroll to top on desktop swap
  if (isDesktop()) {
    const pane = document.querySelector<HTMLElement>(`[data-section="${id}"] .studio-results`);
    pane?.scrollTo({ top: 0 });
  }

  // Explorer active highlight (side + drawer) — single .active class, styled in CSS
  document.querySelectorAll<HTMLElement>('[data-section-link]').forEach((a) => {
    const on = a.dataset.sectionLink === id;
    a.closest<HTMLElement>('.exp-row')?.classList.toggle('active', on);
    a.setAttribute('aria-current', on ? 'true' : 'false');
  });

  // Status bar
  const tableEl = document.querySelector('[data-statusbar-table]');
  const rowsEl = document.querySelector('[data-statusbar-rows]');
  if (tableEl) tableEl.textContent = meta.table;
  if (rowsEl) rowsEl.textContent = String(meta.rows);

  if (opts.scroll && !isDesktop()) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function currentHash(): string {
  return (location.hash || '#home').slice(1);
}

function onLinkClick(e: Event, id: string) {
  if (isDesktop()) {
    e.preventDefault();
    if (location.hash !== `#${id}`) history.pushState(null, '', `#${id}`);
    setActive(id);
  } else {
    // mobile: let the anchor scroll naturally, just sync state + close drawer
    setActive(id);
    closeDrawer();
  }
}

/* ---- Mobile drawer ---- */
const drawerRoot = document.querySelector<HTMLElement>('[data-drawer-root]');
const drawerPanel = document.querySelector<HTMLElement>('[data-drawer-panel]');
const drawerOpenBtn = document.querySelector<HTMLElement>('[data-drawer-open]');

function openDrawer() {
  if (!drawerRoot || !drawerPanel) return;
  drawerRoot.classList.remove('hidden');
  requestAnimationFrame(() => drawerPanel.classList.remove('-translate-x-full'));
  drawerOpenBtn?.setAttribute('aria-expanded', 'true');
  document.body.style.overflow = 'hidden';
}
function closeDrawer() {
  if (!drawerRoot || !drawerPanel) return;
  drawerPanel.classList.add('-translate-x-full');
  drawerOpenBtn?.setAttribute('aria-expanded', 'false');
  document.body.style.overflow = '';
  setTimeout(() => drawerRoot.classList.add('hidden'), 200);
}

/* ---- Explorer schema (column) expand/collapse ---- */
function toggleColumns(id: string, btn: HTMLElement) {
  const cols = document.querySelectorAll<HTMLElement>(`[data-explorer-cols="${id}"]`);
  const expanded = btn.getAttribute('aria-expanded') === 'true';
  cols.forEach((c) => c.classList.toggle('hidden', expanded));
  // keep both side + drawer toggles in sync
  document.querySelectorAll<HTMLElement>(`[data-explorer-toggle="${id}"]`).forEach((t) => {
    t.setAttribute('aria-expanded', String(!expanded));
    const caret = t.querySelector('.caret-icon');
    if (caret) caret.classList.toggle('rotate-90', !expanded);
  });
}

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
  const prefix = document.createElement('span');
  prefix.className = `${prefixClass[msg.kind]} font-semibold`;
  prefix.textContent = prefixLabel[msg.kind];
  const msgSpan = document.createElement('span');
  msgSpan.className = 'text-fg';
  msgSpan.textContent = msg.text;
  line.appendChild(prefix);
  line.append(' ');
  line.appendChild(msgSpan);
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

const studioConsole = {
  push(msg: ConsoleMessage) {
    const root = document.querySelector('[data-console]');
    if (!root) return;
    const el = renderToast(msg);
    root.appendChild(el);
    while (root.children.length > 3) root.firstElementChild?.remove();
    let t = window.setTimeout(() => el.remove(), 6000);
    el.addEventListener('mouseenter', () => clearTimeout(t));
    el.addEventListener('mouseleave', () => { t = window.setTimeout(() => el.remove(), 2500); });
  },
  notice(text: string, cta?: ConsoleMessage['cta']) { this.push({ kind: 'notice', text, cta }); },
  error(text: string, hint?: string, cta?: ConsoleMessage['cta']) { this.push({ kind: 'error', text, hint, cta }); },
  ok(text: string) { this.push({ kind: 'ok', text }); },
  comment(text: string) { this.push({ kind: 'comment', text }); },
};

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
  let rows: Row[];
  try {
    rows = JSON.parse(payloadEl.textContent) as Row[];
  } catch {
    studioConsole.notice('export payload is malformed');
    return;
  }
  const format = (payloadEl.dataset.exportFormat as 'json' | 'csv') ?? 'json';
  const filename = payloadEl.dataset.exportFilename ?? `${id}.${format}`;
  const content = serialize(rows, format);
  downloadBlob(content, filename, format === 'csv' ? 'text/csv' : 'application/json');
  studioConsole.ok(`exported ${filename} (${rows.length} rows)`);
}

function init() {
  if (studio) studio.classList.add('js');

  // Wire explorer links
  document.querySelectorAll<HTMLElement>('[data-section-link]').forEach((a) => {
    a.addEventListener('click', (e) => onLinkClick(e, a.dataset.sectionLink!));
  });
  // Wire column toggles
  document.querySelectorAll<HTMLElement>('[data-explorer-toggle]').forEach((btn) => {
    btn.addEventListener('click', () => toggleColumns(btn.dataset.explorerToggle!, btn));
  });
  // Drawer
  drawerOpenBtn?.addEventListener('click', openDrawer);
  document.querySelectorAll<HTMLElement>('[data-drawer-close]').forEach((el) =>
    el.addEventListener('click', closeDrawer),
  );

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
    if (action === 'run') { e.preventDefault(); runQuery(); }
    if (action === 'copy-link') { e.preventDefault(); copyLink(); }
    if (action === 'export') { e.preventDefault(); exportSection(); }
  });

  // Hash routing — hashchange covers in-page link nav; popstate covers
  // browser back/forward after our pushState() desktop swaps.
  window.addEventListener('hashchange', () => setActive(currentHash()));
  window.addEventListener('popstate', () => setActive(currentHash()));

  window.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); runQuery(); }
  });

  setActive(currentHash());
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
