/** Mobile navigation panel + the header's on-scroll hairline shadow. */
const header = document.querySelector<HTMLElement>('.hdr');
const toggle = document.querySelector<HTMLButtonElement>('[data-nav-toggle]');
const panel = document.getElementById('site-nav-panel');

if (toggle && panel) {
  const label = toggle.querySelector('.u-visually-hidden');

  const setOpen = (open: boolean) => {
    panel.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    if (label) label.textContent = open ? 'Close menu' : 'Open menu';
    document.body.style.overflow = open ? 'hidden' : '';
  };

  // `hidden` is `boolean | 'until-found'` in the DOM lib, and 'until-found' still
  // means hidden — so coerce rather than pass it through.
  toggle.addEventListener('click', () => setOpen(Boolean(panel.hidden)));

  // any navigation inside the panel closes it
  panel.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('a')) setOpen(false);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !panel.hidden) {
      setOpen(false);
      toggle.focus();
    }
  });

  // resizing past the breakpoint must not leave the body scroll-locked
  const mq = window.matchMedia('(min-width: 1024px)');
  mq.addEventListener('change', (e) => {
    if (e.matches && !panel.hidden) setOpen(false);
  });
}

if (header) {
  const sync = () => header.toggleAttribute('data-scrolled', window.scrollY > 4);
  sync();
  window.addEventListener('scroll', sync, { passive: true });
}

export {};
