import { sections, sectionById } from '../data/sections';
import type { ConsoleMessage, ConsoleKind } from './lib/console-copy';
import { NOTICES } from './lib/console-copy';
import { serialize, type Row } from './lib/export';
import { filterItems, fuzzyMatch } from './lib/filter';

/**
 * Studio interaction layer (progressive enhancement).
 * - Adds `.js` to the shell → desktop switches to viewport-locked single-view.
 * - Explorer links are real URLs; navigating renders exactly one section per page.
 * - `syncActive()` highlights the active Explorer row + updates StatusBar from the URL.
 * - `astro:page-load` lifecycle re-runs `syncActive()` on every navigation.
 */

const studio = document.querySelector<HTMLElement>('[data-studio]');

/* ---- Slug ↔ id helpers ---- */
const slugToId = Object.fromEntries(sections.map((s) => [s.slug, s.id]));
const href = (slug: string) => (slug === '' ? '/' : `/${slug}`);

function currentId(): string {
  const seg = location.pathname.replace(/^\/+|\/+$/g, '').split('/')[0] ?? '';
  return slugToId[seg] ?? 'home';
}

function syncActive() {
  const id = currentId();
  document.querySelectorAll<HTMLElement>('[data-section-link]').forEach((a) => {
    const on = a.dataset.sectionLink === id;
    a.closest<HTMLElement>('.exp-row')?.classList.toggle('active', on);
    a.setAttribute('aria-current', on ? 'true' : 'false');
  });
  // Top-bar nav links (the bar is transition:persist'd, so reflect active here on
  // every page-load rather than at SSR time, which would go stale across VT nav).
  document.querySelectorAll<HTMLElement>('[data-topbar-link]').forEach((a) => {
    const on = a.dataset.topbarLink === id;
    a.classList.toggle('text-primary', on);
    a.classList.toggle('text-muted', !on);
    a.setAttribute('aria-current', on ? 'page' : 'false');
  });
}

/* ---- Mobile drawer ---- */
function openDrawer() {
  const drawerRoot = document.querySelector<HTMLElement>('[data-drawer-root]');
  const drawerPanel = document.querySelector<HTMLElement>('[data-drawer-panel]');
  if (!drawerRoot || !drawerPanel) return;
  drawerRoot.classList.remove('hidden');
  requestAnimationFrame(() => drawerPanel.classList.remove('-translate-x-full'));
  document.querySelector<HTMLElement>('[data-drawer-open]')?.setAttribute('aria-expanded', 'true');
  document.body.style.overflow = 'hidden';
}
function closeDrawer() {
  const drawerRoot = document.querySelector<HTMLElement>('[data-drawer-root]');
  const drawerPanel = document.querySelector<HTMLElement>('[data-drawer-panel]');
  if (!drawerRoot || !drawerPanel) return;
  drawerPanel.classList.add('-translate-x-full');
  document.querySelector<HTMLElement>('[data-drawer-open]')?.setAttribute('aria-expanded', 'false');
  document.body.style.overflow = '';
  setTimeout(() => drawerRoot.classList.add('hidden'), 200);
}

/* ---- Explain panel toggle ---- */
function toggleExplain(trigger: HTMLElement) {
  const section = trigger.closest<HTMLElement>('[data-section]');
  const id = section?.dataset.section ?? currentId();
  const panel = document.querySelector<HTMLElement>(`[data-explain="${id}"]`);
  if (!panel) return;
  const open = panel.hasAttribute('hidden');
  panel.toggleAttribute('hidden', !open);
  document
    .querySelectorAll<HTMLElement>(`[data-section="${id}"] [data-action="explain"]`)
    .forEach((b) => b.setAttribute('aria-expanded', String(open)));
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
    // pause auto-dismiss while hovered OR keyboard-focused (toasts can carry a CTA link)
    el.addEventListener('mouseenter', () => clearTimeout(t));
    el.addEventListener('focusin', () => clearTimeout(t));
    const resume = () => {
      t = window.setTimeout(() => el.remove(), 2500);
    };
    el.addEventListener('mouseleave', resume);
    el.addEventListener('focusout', resume);
  },
  notice(text: string, cta?: ConsoleMessage['cta']) {
    this.push({ kind: 'notice', text, cta });
  },
  error(text: string, hint?: string, cta?: ConsoleMessage['cta']) {
    this.push({ kind: 'error', text, hint, cta });
  },
  ok(text: string) {
    this.push({ kind: 'ok', text });
  },
  comment(text: string) {
    this.push({ kind: 'comment', text });
  },
};

function runQuery() {
  const id = currentId();
  const meta = sectionById[id] ?? sectionById['home'];
  const pane = document.querySelector<HTMLElement>(`[data-section="${id}"] .studio-results`);
  const allowMotion = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (pane && allowMotion) {
    pane.classList.remove('is-rerunning');
    void pane.offsetWidth; // restart animation
    pane.classList.add('is-rerunning');
    pane.addEventListener('animationend', () => pane.classList.remove('is-rerunning'), {
      once: true,
    });
  }
  studioConsole.ok(`${meta.rows} rows (${meta.execMs}ms)`);
}

async function copyLink() {
  const id = currentId();
  const url = location.origin + href(sectionById[id]?.slug ?? '');
  try {
    await navigator.clipboard.writeText(url);
    studioConsole.ok(`copied link to ${url}`);
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
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportSection() {
  const id = currentId();
  const payloadEl = document.querySelector<HTMLElement>(`[data-export-payload="${id}"]`);
  if (!payloadEl?.textContent) {
    studioConsole.notice('nothing to export from this view');
    return;
  }
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

/* ---- Command palette ---- */
interface PaletteItem {
  label: string;
  hint: string;
  run: () => void;
}

function paletteItems(): PaletteItem[] {
  const jumps: PaletteItem[] = sections.map((s) => ({
    label: `Jump to ${s.table}`,
    hint: `${s.rows} rows`,
    run: () => {
      location.href = href(s.slug);
    },
  }));
  const actions: PaletteItem[] = [
    { label: 'Copy link to current section', hint: 'clipboard', run: () => copyLink() },
    { label: 'Export current section', hint: 'download', run: () => exportSection() },
    {
      label: 'Open live demo',
      hint: 'app.libredb.org',
      run: () => window.open('https://app.libredb.org', '_blank'),
    },
    {
      label: 'Open GitHub',
      hint: 'repo',
      run: () => window.open('https://github.com/libredb/libredb-studio', '_blank'),
    },
    {
      label: 'View README / docs',
      hint: 'github',
      run: () => window.open('https://github.com/libredb/libredb-studio#readme', '_blank'),
    },
    {
      label: 'Live monitoring',
      hint: 'in the app',
      run: () => {
        const msg = NOTICES['monitoring'];
        if (msg) studioConsole.push(msg);
      },
    },
  ];
  return [...jumps, ...actions];
}

let paletteHighlight = 0;
let paletteFiltered: PaletteItem[] = [];
let paletteLastFocus: HTMLElement | null = null;

function renderPalette(query: string) {
  const list = document.querySelector<HTMLElement>('[data-palette-list]');
  const input = document.querySelector<HTMLElement>('[data-palette-input]');
  if (!list) return;
  paletteFiltered = filterItems(query, paletteItems(), (it) => it.label + ' ' + it.hint);
  paletteHighlight = 0;
  list.innerHTML = '';
  paletteFiltered.forEach((it, i) => {
    const li = document.createElement('li');
    li.id = `palette-opt-${i}`;
    li.setAttribute('role', 'option');
    li.setAttribute('aria-selected', String(i === 0));
    li.className = `flex cursor-pointer items-center justify-between px-4 py-2 ${i === 0 ? 'bg-raised text-bright' : 'text-fg'}`;
    const labelSpan = document.createElement('span');
    labelSpan.textContent = it.label;
    const hintSpan = document.createElement('span');
    hintSpan.className = 'text-[11px] text-faint';
    hintSpan.textContent = it.hint;
    li.appendChild(labelSpan);
    li.appendChild(hintSpan);
    li.addEventListener('mousemove', () => setHighlight(i));
    li.addEventListener('click', () => {
      it.run();
      closePalette();
    });
    list.appendChild(li);
  });
  if (paletteFiltered.length > 0) {
    input?.setAttribute('aria-activedescendant', 'palette-opt-0');
  } else {
    input?.removeAttribute('aria-activedescendant');
  }
}

function setHighlight(i: number) {
  paletteHighlight = i;
  const list = document.querySelector('[data-palette-list]');
  if (!list) return;
  [...list.children].forEach((li, idx) => {
    li.className = `flex cursor-pointer items-center justify-between px-4 py-2 ${idx === i ? 'bg-raised text-bright' : 'text-fg'}`;
    (li as HTMLElement).setAttribute('aria-selected', String(idx === i));
  });
  const input = document.querySelector<HTMLElement>('[data-palette-input]');
  input?.setAttribute('aria-activedescendant', `palette-opt-${i}`);
}

function openPalette() {
  const root = document.querySelector<HTMLElement>('[data-palette-root]');
  const input = document.querySelector<HTMLInputElement>('[data-palette-input]');
  if (!root || !input) return;
  paletteLastFocus = document.activeElement as HTMLElement;
  root.removeAttribute('hidden');
  input.value = '';
  input.setAttribute('aria-expanded', 'true');
  renderPalette('');
  input.focus();
}

function closePalette() {
  const root = document.querySelector<HTMLElement>('[data-palette-root]');
  const input = document.querySelector<HTMLElement>('[data-palette-input]');
  root?.setAttribute('hidden', '');
  input?.setAttribute('aria-expanded', 'false');
  input?.removeAttribute('aria-activedescendant');
  paletteLastFocus?.focus();
}

/* ---- Delegated action click handler ---- */
function closeChromeMenus(except?: Element | null) {
  document.querySelectorAll<HTMLDetailsElement>('details[data-chrome-menu][open]').forEach((d) => {
    if (!except || !d.contains(except)) d.removeAttribute('open');
  });
}

function onActionClick(e: Event) {
  const target = e.target;
  if (!(target instanceof Element)) return;

  // A click outside an open chrome dropdown closes it
  closeChromeMenus(target);

  // Chrome delegations: palette-close, drawer open/close, explorer column toggles
  if (target.closest('[data-palette-close]')) {
    e.preventDefault();
    closePalette();
    return;
  }
  if (target.closest('[data-drawer-open]')) {
    e.preventDefault();
    openDrawer();
    return;
  }
  if (target.closest('[data-drawer-close]')) {
    e.preventDefault();
    closeDrawer();
    return;
  }
  const toggleBtn = target.closest<HTMLElement>('[data-explorer-toggle]');
  if (toggleBtn) {
    e.preventDefault();
    const id = toggleBtn.dataset.explorerToggle!;
    toggleColumns(id, toggleBtn);
    return;
  }

  const el = target.closest<HTMLElement>('[data-action]');
  if (!el) return;
  const action = el.dataset.action;
  // An action chosen from a chrome dropdown also closes that dropdown
  el.closest<HTMLDetailsElement>('details[data-chrome-menu]')?.removeAttribute('open');
  if (action === 'notice') {
    e.preventDefault();
    const msg = NOTICES[el.dataset.notice ?? ''];
    if (msg) studioConsole.push(msg);
  }
  if (action === 'explain') {
    e.preventDefault();
    toggleExplain(el);
  }
  if (action === 'run') {
    e.preventDefault();
    runQuery();
  }
  if (action === 'copy-link') {
    e.preventDefault();
    copyLink();
  }
  if (action === 'export') {
    e.preventDefault();
    exportSection();
  }
  if (action === 'palette') {
    e.preventDefault();
    openPalette();
  }
  if (action === 'video') {
    e.preventDefault();
    const wrap = el.closest<HTMLElement>('[data-video]');
    const id = wrap?.dataset.video;
    if (wrap && id) {
      const iframe = document.createElement('iframe');
      iframe.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?autoplay=1&rel=0`;
      iframe.title = wrap.dataset.videoTitle ?? 'Video';
      iframe.setAttribute('allow', 'autoplay; encrypted-media; picture-in-picture');
      iframe.setAttribute('allowfullscreen', '');
      iframe.className = 'absolute inset-0 h-full w-full border-0';
      wrap.replaceChildren(iframe);
      iframe.focus();
    }
  }
  if (action === 'results') {
    e.preventDefault();
    const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document
      .querySelector(`[data-section="${currentId()}"] .studio-results`)
      ?.scrollTo({ top: 0, behavior: smooth ? 'smooth' : 'auto' });
  }
}

/* ---- Keyboard handler ---- */
function onKeydown(e: KeyboardEvent) {
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
    e.preventDefault();
    runQuery();
    return;
  }
  if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
    e.preventDefault();
    openPalette();
    return;
  }
  const root = document.querySelector('[data-palette-root]');
  if (!root || root.hasAttribute('hidden')) {
    if (e.key === 'Escape') closeChromeMenus();
    return;
  }
  if (e.key === 'Escape') {
    e.preventDefault();
    closePalette();
  } else if (e.key === 'Tab') {
    e.preventDefault();
    (document.querySelector('[data-palette-input]') as HTMLElement | null)?.focus();
  } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    if (paletteFiltered.length === 0) {
      e.preventDefault();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight(Math.min(paletteHighlight + 1, paletteFiltered.length - 1));
    } else {
      e.preventDefault();
      setHighlight(Math.max(paletteHighlight - 1, 0));
    }
  } else if (e.key === 'Enter') {
    e.preventDefault();
    paletteFiltered[paletteHighlight]?.run();
    closePalette();
  }
}

/* ---- Explorer search filter helper ---- */
function filterExplorer(input: HTMLInputElement) {
  const scope = input.closest<HTMLElement>('[data-explorer-root]');
  if (!scope) return;
  const q = input.value;
  scope.querySelectorAll<HTMLElement>('[data-explorer-item]').forEach((li) => {
    const name = li.dataset.explorerItem ?? '';
    li.hidden = fuzzyMatch(q, name) === null;
  });
}

/* ---- Lifecycle ---- */
let wiredOnce = false;

function wireOnce() {
  if (wiredOnce) return;
  wiredOnce = true;
  studio?.classList.add('js');
  document.addEventListener('click', onActionClick);
  window.addEventListener('keydown', onKeydown);

  document.addEventListener('astro:before-swap', () => {
    // force-close the persisted drawer so it doesn't carry over to the next page
    const root = document.querySelector('[data-drawer-root]');
    const panel = document.querySelector('[data-drawer-panel]');
    panel?.classList.add('-translate-x-full');
    root?.classList.add('hidden');
    document.body.style.overflow = '';
    document.querySelector('[data-drawer-open]')?.setAttribute('aria-expanded', 'false');
  });

  // Delegated input: explorer search filter + palette input
  document.addEventListener('input', (e) => {
    const target = e.target;
    if (!(target instanceof Element)) return;
    const searchInput = target.closest<HTMLInputElement>('[data-explorer-search]');
    if (searchInput) {
      filterExplorer(searchInput);
      return;
    }
    const paletteInput = target.closest<HTMLInputElement>('[data-palette-input]');
    if (paletteInput) {
      renderPalette(paletteInput.value);
    }
  });

  // Delegated keydown: explorer search Enter-to-jump
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const target = e.target;
    if (!(target instanceof Element)) return;
    const searchInput = target.closest<HTMLInputElement>('[data-explorer-search]');
    if (!searchInput) return;
    const scope = searchInput.closest<HTMLElement>('[data-explorer-root]');
    if (!scope) return;
    const first = scope.querySelector<HTMLElement>('[data-explorer-item]:not([hidden])');
    const id = first?.dataset.explorerItem;
    if (id) {
      const slug = sectionById[id]?.slug ?? id;
      location.href = href(slug);
      searchInput.blur();
    }
  });
}

function onPage() {
  document.querySelector('[data-studio]')?.classList.add('js');
  syncActive();
}

function start() {
  wireOnce();
  onPage();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
else start();

document.addEventListener('astro:page-load', () => {
  wireOnce();
  onPage();
});
