import { describe, expect, it } from 'bun:test';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * src/styles/ds/ is a vendored copy of design-system/ so Vite can resolve the
 * relative url() references inside tokens/theme.css. "Design system is law"
 * only means anything if the copy cannot drift from the source.
 */
const SOURCE = 'design-system';
const VENDORED = 'src/styles/ds';

function walk(dir: string, base = dir): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full, base) : [relative(base, full)];
  });
}

const digest = (p: string) => createHash('sha256').update(readFileSync(p)).digest('hex');

describe('design system', () => {
  it('is vendored verbatim — every file byte-identical to design-system/', () => {
    const source = walk(SOURCE).filter((f) => !f.endsWith('.md') && !f.startsWith('components/'));
    const vendored = walk(VENDORED);

    expect(vendored.sort()).toEqual(source.sort());
    for (const file of source) {
      expect(digest(join(VENDORED, file)), `${file} drifted from design-system/`).toBe(digest(join(SOURCE, file)));
    }
  });

  it('imports every token file except fonts.css, which the handoff overrides', () => {
    const global = readFileSync('src/styles/global.css', 'utf8');
    const tokens = readdirSync(join(SOURCE, 'tokens')).filter((f) => f.endsWith('.css'));

    for (const file of tokens) {
      const imported = global.includes(`@import './ds/tokens/${file}'`);
      if (file === 'fonts.css') {
        // it @imports Geist from Google Fonts and the site paints Plus Jakarta Sans
        expect(imported, 'fonts.css must stay out of the global entry').toBe(false);
      } else {
        expect(imported, `${file} is not imported by src/styles/global.css`).toBe(true);
      }
    }
  });

  it('redefines all six --font-* variables that the skipped fonts.css owned', () => {
    const global = readFileSync('src/styles/global.css', 'utf8');
    for (const v of ['--font-sans', '--font-mono', '--font-display', '--font-heading', '--font-body', '--font-ui']) {
      expect(global, `${v} is not redefined after skipping ds/tokens/fonts.css`).toContain(`${v}:`);
    }
  });
});
