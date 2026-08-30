/** Split-button disclosure for the demo sign-in panel. The panel is absolutely
 *  positioned, so it costs the layout nothing and never pushes the blocks under
 *  the hero around; that also means it has to be dismissed by hand — Escape,
 *  a click outside, or focus leaving the group. */
for (const group of document.querySelectorAll<HTMLElement>('[data-demo-cta]')) {
  const toggle = group.querySelector<HTMLButtonElement>('[data-demo-cta-toggle]');
  const panel = group.querySelector<HTMLElement>('[data-demo-cta-panel]');
  if (!toggle || !panel) continue;

  const setOpen = (open: boolean) => {
    panel.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    group.classList.toggle('is-open', open);
  };

  toggle.addEventListener('click', (e) => {
    const open = toggle.getAttribute('aria-expanded') === 'true';
    setOpen(!open);
    /* Focus moves into the panel only for a keyboard activation — a click made
       with the mouse would leave a focus ring around the first credential, which
       reads as an input field rather than a value you copy. Keyboard-synthesised
       clicks report detail 0; real pointer clicks report 1 or more. The panel
       follows the toggle in the DOM, so Tab still reaches it either way. */
    if (!open && e.detail === 0) panel.querySelector<HTMLButtonElement>('button')?.focus();
  });

  panel.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    setOpen(false);
    toggle.focus();
  });

  toggle.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') setOpen(false);
  });

  document.addEventListener('click', (e) => {
    if (panel.hidden) return;
    if (!group.contains(e.target as Node)) setOpen(false);
  });

  group.addEventListener('focusout', () => {
    // deferred: at focusout the new activeElement is not assigned yet
    window.setTimeout(() => {
      if (!panel.hidden && !group.contains(document.activeElement)) setOpen(false);
    }, 0);
  });
}

export {};
