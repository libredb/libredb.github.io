import { demoStatus } from '../data/home';

/** The SQL editor mock types its query out at two characters every 24ms, pauses,
 *  "runs", then shows the result grid — the prototype's exact cadence.
 *  The finished state is what the server renders, so this only *replays* it. */
interface Chunk {
  el: HTMLElement;
  text: string;
}

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const root = document.querySelector<HTMLElement>('[data-sql]');

if (root) {
  const chunks: Chunk[] = Array.from(root.querySelectorAll<HTMLElement>('[data-sql-chunk]')).map((el) => ({
    el,
    text: el.textContent ?? '',
  }));
  const total = chunks.reduce((a, c) => a + c.text.length, 0);
  const caret = root.querySelector<HTMLElement>('[data-sql-caret]');
  const status = root.querySelector<HTMLElement>('[data-sql-status]');
  const results = root.querySelector<HTMLElement>('[data-sql-results]');

  const STATUS = demoStatus;

  let typeTimer: number | undefined;
  let phaseTimers: number[] = [];

  const paint = (n: number) => {
    let left = n;
    for (const c of chunks) {
      c.el.textContent = c.text.slice(0, Math.max(0, left));
      left -= c.text.length;
    }
  };

  const setPhase = (phase: 'typing' | 'running' | 'done') => {
    root.dataset.sqlPhase = phase;
    if (status) status.textContent = STATUS[phase];
    if (caret) caret.hidden = phase !== 'typing';
    if (results) results.dataset.state = phase === 'done' ? 'visible' : 'pending';
  };

  const finish = () => {
    paint(total);
    setPhase('done');
  };

  const run = () => {
    window.clearInterval(typeTimer);
    phaseTimers.forEach((t) => window.clearTimeout(t));
    phaseTimers = [];

    if (reduceMotion.matches) {
      finish();
      return;
    }

    let n = 0;
    paint(0);
    setPhase('typing');
    typeTimer = window.setInterval(() => {
      n += 2;
      if (n >= total) {
        window.clearInterval(typeTimer);
        paint(total);
        phaseTimers.push(window.setTimeout(() => setPhase('running'), 350));
        phaseTimers.push(window.setTimeout(() => setPhase('done'), 1150));
        return;
      }
      paint(n);
    }, 24);
  };

  finish();

  for (const btn of document.querySelectorAll<HTMLButtonElement>('[data-sql-replay]')) {
    btn.addEventListener('click', () => {
      const owner = btn.closest('[data-switch]') as HTMLElement | null;
      // "replay" also jumps to the editor tab, as in the prototype
      owner?.dispatchEvent(new CustomEvent('switch:request', { detail: { value: 'editor' } }));
      run();
    });
  }

  // play once when the panel is first shown, not on page load
  let played = false;
  const panel = root.closest('[data-switch-panel]');
  const group = root.closest('[data-switch]');
  group?.addEventListener('switch:change', (e) => {
    const value = (e as CustomEvent<{ value: string }>).detail.value;
    if (panel && panel.getAttribute('data-switch-panel') === value && !played) {
      played = true;
      run();
    }
  });
}
