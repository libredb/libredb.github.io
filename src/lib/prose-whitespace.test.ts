import { test, expect } from 'bun:test';
import { Glob } from 'bun';
import { readFileSync } from 'node:fs';

// Guards against a silent, recurring content bug.
//
// Astro follows JSX whitespace rules: a newline between prose text and an
// adjacent inline element is DROPPED, not collapsed to a space. Prettier
// reflows long sentences and will happily move an inline tag onto its own
// line — at which point the space disappears from the rendered page and
// "See our <a>Privacy Policy</a>" ships as "See ourPrivacy Policy". Nothing
// in typecheck, lint or the build complains, and the source still reads
// correctly, so it is very easy to miss in review.
//
// The fix at each site is an explicit `{' '}` or `&#32;` at the end of the
// text line. This test fails if a new occurrence appears.
//
// Scope: only content-bearing inline elements (a, em, code, strong, ...).
// `<span>` is deliberately excluded — it is used here for badges and icon
// dots that sit in `flex ... gap-*` rows, where the missing text-node space
// is invisible and intentional. Adjacency of a closing inline tag followed by
// prose is likewise context-dependent (flex gaps again) and is not checked.

const INLINE = String.raw`(?:a|em|code|strong|abbr|kbd|b|i|mark|time)`;

/** Line ends mid-sentence: a word character or sentence punctuation, and not markup. */
const PROSE_TAIL = new RegExp(String.raw`[\p{L}\p{N},;:—–)]$`, 'u');
/** Already carries an explicit space, or is not prose at all. */
const SAFE_TAIL = /(?:\{' '\}|&#32;|&nbsp;|>|"|'|=|\{|\()$/;
// The tag may be alone on its line with attributes below it, so end-of-line
// counts as a boundary just like whitespace or `>`.
const OPENS_INLINE = new RegExp(String.raw`^<${INLINE}(?:[\s>]|$)`);

interface Offence {
  file: string;
  line: number;
  text: string;
  next: string;
}

function scan(file: string): Offence[] {
  const lines = readFileSync(file, 'utf8').split('\n');
  // Skip the component script (frontmatter) — it is TypeScript, not markup.
  let start = 0;
  if (lines[0]?.trim() === '---') {
    const end = lines.indexOf('---', 1);
    if (end > 0) start = end + 1;
  }

  const out: Offence[] = [];
  for (let i = start; i < lines.length - 1; i++) {
    const cur = lines[i]!.replace(/\s+$/, '');
    const next = lines[i + 1]!.replace(/^\s+/, '');
    const bare = cur.replace(/^\s+/, '');
    if (!bare || !next) continue;
    if (bare.startsWith('<!--') || bare.startsWith('//') || bare.startsWith('*')) continue;
    if (!PROSE_TAIL.test(cur) || SAFE_TAIL.test(cur)) continue;
    if (!OPENS_INLINE.test(next)) continue;
    out.push({ file, line: i + 1, text: bare.slice(-60), next: next.slice(0, 40) });
  }
  return out;
}

test('no prose text is joined to a following inline element', () => {
  const files = [...new Glob('src/**/*.astro').scanSync('.')].sort();
  expect(files.length).toBeGreaterThan(0);

  const offences = files.flatMap(scan);
  const report = offences
    .map((o) => `${o.file}:${o.line}\n    ...${o.text}\n    ${o.next}...\n    -> end that line with {' '} or &#32;`)
    .join('\n');

  expect(report).toBe('');
});
