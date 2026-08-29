import { describe, expect, it } from 'bun:test';
import { readFileSync, readdirSync } from 'node:fs';
import { contrast } from '../scripts/contrast.mjs';

const stripComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');

/** Pull a custom property out of the first rule block whose selector list
 *  contains `selector`. Comments are stripped first — they mention these
 *  selectors in prose and a naive split lands inside one. */
function tokenIn(css: string, selector: string, name: string): string {
  const src = stripComments(css);
  const blocks = [...src.matchAll(/([^{}]+)\{([^{}]*)\}/g)];
  for (const [, sel, body] of blocks) {
    if (!sel.split(',').some((s) => s.trim() === selector)) continue;
    const m = body.match(new RegExp(`${name}\\s*:\\s*([^;]+);`));
    if (m) return m[1].trim();
  }
  throw new Error(`${name} not found in a rule selecting ${selector}`);
}

const a11y = readFileSync('src/styles/a11y.css', 'utf8');
const theme = readFileSync('design-system/tokens/theme.css', 'utf8');

const DARK = {
  background: '#0b0d18',
  'background-subtle': '#101321',
  surface: '#141829',
  'surface-elevated': '#1b2038',
};
const LIGHT = { background: '#ffffff', 'background-subtle': '#f8f9fc', surface: '#ffffff' };
const CONSOLE = {
  'console-bg': '#0d1020',
  'console-surface': '#12162a',
  'console-deep': '#0b0e1c',
  'console-chip': '#161a30',
  'console-row-alt': '#0f1326',
};

describe('WCAG 1.4.3 AA (4.5:1) for the tokens the site paints', () => {
  it('lifts --text-tertiary above 4.5:1 on every dark ground it lands on', () => {
    const fg = tokenIn(a11y, "[data-theme='dark']", '--text-tertiary');
    for (const [name, bg] of Object.entries(DARK)) {
      expect(contrast(fg, bg), `${fg} on --${name}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('lifts --text-tertiary above 4.5:1 on every light ground it lands on', () => {
    const fg = tokenIn(a11y, ':root', '--text-tertiary');
    for (const [name, bg] of Object.entries(LIGHT)) {
      expect(contrast(fg, bg), `${fg} on --${name}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('lifts --console-text-tertiary above 4.5:1 on every console surface', () => {
    const fg = tokenIn(a11y, ':root', '--console-text-tertiary');
    for (const [name, bg] of Object.entries(CONSOLE)) {
      expect(contrast(fg, bg), `${fg} on --${name}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('declares the light override BEFORE the dark one', () => {
    // :root and [data-theme='dark'] share specificity (0,1,0), so source order
    // decides. Declaring dark first silently paints dark mode with light values —
    // that shipped once and dropped the footer headings to 4.06:1.
    const light = a11y.indexOf(':root {');
    const dark = a11y.indexOf("[data-theme='dark'] {");
    expect(light).toBeGreaterThan(-1);
    expect(dark).toBeGreaterThan(-1);
    expect(light, ':root must be declared before [data-theme="dark"]').toBeLessThan(dark);
  });

  it('keeps the design system itself unedited — the lifts live in a separate layer', () => {
    expect(theme).toContain('--text-tertiary:#767e9e');
    expect(theme).toContain('--text-tertiary:#7b8199');
  });
});

describe('WCAG 1.4.3 large text (3:1) for gradient-clipped headlines', () => {
  // axe-core SKIPS background-clip:text elements entirely, so nothing else checks these.
  const cases: Array<[string, string[], string[]]> = [
    ['dark --gradient-brand-text', ['#6366f1', '#a855f7'], ['#0b0d18', '#101321']],
    ['dark --gradient-data-text', ['#10b981', '#3b82f6'], ['#0b0d18', '#101321']],
    ['light --gradient-brand-text', ['#4f46e5', '#9333ea'], ['#ffffff', '#f8f9fc']],
    ['light --gradient-data-text', ['#059669', '#2563eb'], ['#ffffff', '#f8f9fc']],
    // the CTA panel's own ground: brand gradient under two tint stops
    ['CTA --gradient-data-text', ['#6ee7b7', '#93c5fd'], ['#433cbd', '#7e2cd0']],
  ];

  for (const [label, stops, grounds] of cases) {
    it(`${label} clears 3:1 at both stops`, () => {
      for (const stop of stops) {
        for (const ground of grounds) {
          expect(contrast(stop, ground), `${stop} on ${ground}`).toBeGreaterThanOrEqual(3);
        }
      }
    });
  }

  it('ships a solid-colour fallback where background-clip:text is unsupported', () => {
    const global = readFileSync('src/styles/global.css', 'utf8');
    expect(global).toMatch(/@supports not \(\(background-clip: text\)/);
  });
});

describe('--console-text-faint is chrome, never copy', () => {
  // #3a4265 is 1.93:1 on --console-bg. a11y.css deliberately lifts
  // --console-text-tertiary and leaves this one alone, because in the prototype
  // it only paints separators and ghost chrome. The playground port reached for
  // it for the editor note, the placeholder, the result hint and three activity-log
  // columns — all text a reader has to read — and dropped /playground to 97.
  const FAINT = '#3a4265';
  const CONSOLE_GROUNDS = { 'console-bg': '#0d1020', 'console-surface': '#12162a' };

  it('is genuinely below AA, which is why it may not carry text', () => {
    for (const [name, bg] of Object.entries(CONSOLE_GROUNDS)) {
      expect(contrast(FAINT, bg), `${FAINT} on --${name}`).toBeLessThan(4.5);
    }
  });

  // The token itself is legitimate where it paints something a reader never has
  // to read: ProductSection uses it for an aria-hidden "+" and the mock editor's
  // line-number gutter. CSS cannot tell decorative from readable, so the guard is
  // scoped to the surfaces that are all readable text.
  it('is never assigned to `color` in the playground', () => {
    const dir = 'src/components/playground';
    const offenders = readdirSync(dir)
      .filter((f) => f.endsWith('.astro'))
      .filter((f) => /color:\s*var\(--console-text-faint\)/.test(readFileSync(`${dir}/${f}`, 'utf8')));
    expect(offenders, 'use --console-text-tertiary for text a reader must read').toEqual([]);
  });
});
