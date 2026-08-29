/** "How it works": the sticky diagram lights up layer by layer as each of the
 *  four numbered steps crosses the middle of the viewport. rootMargin is the
 *  prototype's -42%/-42% band, i.e. a step is "current" while it sits in the
 *  middle 16% of the screen. */
const scene = document.querySelector<HTMLElement>('[data-arch]');
const steps = Array.from(document.querySelectorAll<HTMLElement>('[data-astep]'));

if (scene && steps.length) {
  const setStep = (n: number) => {
    scene.dataset.archStep = String(n);
    for (const s of steps) s.dataset.state = s.dataset.astep === String(n) ? 'active' : 'idle';
  };

  setStep(1);

  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setStep(Number((e.target as HTMLElement).dataset.astep));
        }
      },
      { rootMargin: '-42% 0px -42% 0px' },
    );
    for (const s of steps) io.observe(s);
  } else {
    // no observer: show the finished state rather than a half-drawn diagram
    setStep(4);
  }
}

export {};
