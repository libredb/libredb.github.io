/** Theme toggle. The initial value is applied by the inline head script so there
 *  is no flash; this module only owns the switch and the persisted value. */
const KEY = 'libredb-theme';
const COLORS = { dark: '#0b0d18', light: '#ffffff' } as const;
type Theme = keyof typeof COLORS;

const root = document.documentElement;

function current(): Theme {
  return root.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
}

function apply(theme: Theme): void {
  root.setAttribute('data-theme', theme);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', COLORS[theme]);

  const next: Theme = theme === 'dark' ? 'light' : 'dark';
  const label = next === 'light' ? 'Light' : 'Dark';
  for (const btn of document.querySelectorAll<HTMLButtonElement>('[data-theme-toggle]')) {
    btn.textContent = label;
    btn.setAttribute('aria-label', `Switch to ${next} theme`);
  }
}

apply(current());

for (const btn of document.querySelectorAll<HTMLButtonElement>('[data-theme-toggle]')) {
  btn.addEventListener('click', () => {
    const next: Theme = current() === 'dark' ? 'light' : 'dark';
    apply(next);
    try {
      localStorage.setItem(KEY, next);
    } catch {
      /* private mode — the choice just does not persist */
    }
  });
}

export {};
