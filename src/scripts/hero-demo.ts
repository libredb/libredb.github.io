/** Drives the hero product tour: which bundle it loads, expanding it, and one
 *  workaround for a bug in the bundle itself.
 *
 *  The two bundles are authored at different sizes — 1920x1080 and 422x950 —
 *  and each scales itself to fit its viewport. Loading the desktop one on a
 *  phone put it on screen at 17% scale, so the choice has to be made at runtime.
 *  Only the chosen bundle is ever fetched; `src` is deliberately absent from the
 *  server-rendered markup (a <noscript> copy covers a reader without JS).
 */
/** The iframe can fire `load` twice — once for the loader, once after it
 *  rewrites the document — and only one observer per document is wanted. */
const patched = new WeakSet<Document>();

const frame = document.querySelector<HTMLIFrameElement>('[data-demo]');
const stage = document.querySelector<HTMLElement>('[data-demo-stage]');
const expand = document.querySelector<HTMLButtonElement>('[data-demo-expand]');

if (frame) {
  const desktop = frame.dataset.demoDesktop;
  const mobile = frame.dataset.demoMobile;
  const phone = window.matchMedia('(max-width: 1023px)');

  const apply = () => {
    const next = phone.matches ? mobile : desktop;
    // Re-assigning the same src would restart the tour on every resize tick.
    if (next && !frame.src.endsWith(next)) frame.src = next;
  };

  apply();
  // Only fires when the breakpoint is actually crossed — a real phone never
  // crosses it, but resizing a desktop window (or DevTools) swaps the bundle.
  phone.addEventListener('change', apply);

  frame.addEventListener('load', () => keepOneCursor(frame));
}

if (stage && expand) {
  const label = expand.querySelector('.hero__expand-label');

  expand.addEventListener('click', () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void stage.requestFullscreen?.().catch(() => {});
  });

  document.addEventListener('fullscreenchange', () => {
    const open = document.fullscreenElement === stage;
    expand.setAttribute('aria-label', open ? 'Close the product tour' : 'Expand the product tour');
    if (label) label.textContent = open ? 'Close' : 'Expand';
  });
}

/**
 * WORKAROUND for a reconciliation bug inside the desktop bundle.
 *
 * The tour's template declares exactly one cursor arrow, but its runtime leaves
 * the old node in the DOM when a chapter transition rebuilds the subtree around
 * it. Measured on the shipped bundle: one arrow for the first ~22 seconds, then
 * a second at ~26s, a third at ~30s, a fourth at ~34s — each frozen wherever it
 * was orphaned, while only the newest one keeps moving.
 *
 * That last part is the handle: a live arrow gets `style` mutations, an orphan
 * never does again. So stamp arrows as they move and drop the stale ones. This
 * lives here rather than in the bundle because the bundle is generated — a
 * re-export from the design tool would erase a patch, but not this.
 *
 * The phone bundle draws no cursor at all, so this is a no-op there.
 */
function keepOneCursor(iframe: HTMLIFrameElement) {
  const doc = iframe.contentDocument;
  if (!doc || patched.has(doc)) return; // cross-origin: nothing we can do, and nothing we ship is
  patched.add(doc);

  /** The arrow is the only polygon drawn with these points. */
  const arrows = () =>
    [...doc.querySelectorAll('polygon')]
      .filter((p) => (p.getAttribute('points') ?? '').startsWith('4,2 4,20'))
      .map((p) => p.closest('div'))
      .filter((d): d is HTMLDivElement => d !== null);

  const moved = new WeakMap<Element, number>();
  let tick = 0;

  const sweep = () => {
    const live = arrows();
    if (live.length < 2) return;
    const newest = Math.max(...live.map((d) => moved.get(d) ?? -1));
    // Before any arrow has been seen moving, fall back to document order: the
    // runtime appends the replacement and orphans the one already there.
    const keep = newest < 0 ? live[live.length - 1] : null;
    for (const d of live) {
      if (keep ? d !== keep : (moved.get(d) ?? -1) < newest) d.remove();
    }
  };

  // The target is the Document, not `doc.body`: the bundle's loader rewrites the
  // document after the iframe's first load event, which detaches an observer
  // bound to the body it had then — measured as zero matching mutations.
  new MutationObserver((records) => {
    for (const r of records) {
      const el = r.target instanceof Element ? r.target.closest('div') : null;
      if (el?.querySelector('polygon[points^="4,2 4,20"]')) moved.set(el, ++tick);
    }
    sweep();
  }).observe(doc, { subtree: true, attributes: true, attributeFilter: ['style'], childList: true });
}
