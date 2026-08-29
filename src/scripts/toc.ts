/** Highlights the table-of-contents entry for the heading currently in view. */
const items = Array.from(document.querySelectorAll<HTMLElement>('.toc__item'));
const targets = items
  .map((li) => {
    const id = li.querySelector('a')?.getAttribute('href')?.slice(1);
    return id ? document.getElementById(decodeURIComponent(id)) : null;
  })
  .filter((el): el is HTMLElement => el !== null);

if (items.length && targets.length && 'IntersectionObserver' in window) {
  const byId = new Map(targets.map((t, i) => [t.id, items[i]!]));
  let active: HTMLElement | undefined;

  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        const next = byId.get((e.target as HTMLElement).id);
        if (!next || next === active) continue;
        active?.removeAttribute('data-current');
        next.setAttribute('data-current', '');
        active = next;
      }
    },
    { rootMargin: '-96px 0px -70% 0px' },
  );
  for (const t of targets) io.observe(t);
}

export {};
