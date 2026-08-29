/** Scroll reveal: 20px up + fade, 60ms stagger between siblings in a section.
 *  Distance and duration come from tokens/motion.css, so prefers-reduced-motion
 *  already flattens them; the observer still runs and just adds the class. */
const items = Array.from(document.querySelectorAll<HTMLElement>('[data-rv]'));
if (items.length) {
  const order = new WeakMap<HTMLElement, number>();
  const seen = new Map<Element, number>();
  for (const el of items) {
    const group = el.closest('section') ?? document.body;
    const n = seen.get(group) ?? 0;
    order.set(el, n);
    seen.set(group, n + 1);
  }

  const reveal = (el: HTMLElement) => {
    el.style.setProperty('--rv-delay', `${(order.get(el) ?? 0) * 60}ms`);
    el.classList.add('is-revealed');
  };

  if (!('IntersectionObserver' in window)) {
    items.forEach(reveal);
  } else {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          reveal(e.target as HTMLElement);
          io.unobserve(e.target);
        }
      },
      { rootMargin: '0px 0px -12% 0px', threshold: 0.05 },
    );
    for (const el of items) io.observe(el);
  }
}

export {};
