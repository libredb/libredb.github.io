import { sections, sectionById } from '../data/sections';

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

  // Explorer active highlight (side + drawer)
  document.querySelectorAll<HTMLElement>('[data-section-link]').forEach((a) => {
    const on = a.dataset.sectionLink === id;
    const row = a.closest<HTMLElement>('div');
    if (row) {
      row.classList.toggle('bg-raised', on);
      row.classList.toggle('text-bright', on);
      row.classList.toggle('shadow-[inset_2px_0_0_var(--color-primary)]', on);
    }
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

  // Hash routing — hashchange covers in-page link nav; popstate covers
  // browser back/forward after our pushState() desktop swaps.
  window.addEventListener('hashchange', () => setActive(currentHash()));
  window.addEventListener('popstate', () => setActive(currentHash()));
  window.addEventListener('resize', () => setActive(currentHash()));

  setActive(currentHash());
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
