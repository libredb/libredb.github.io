/**
 * WCAG 2.1 relative-luminance contrast, no dependencies.
 *   node scripts/contrast.mjs "#767e9e" "#141829"
 *   node scripts/contrast.mjs --audit      (checks the pairs the site actually paints)
 */
const hex = (h) => {
  const s = h.replace('#', '').trim();
  const n =
    s.length === 3
      ? s
          .split('')
          .map((c) => c + c)
          .join('')
      : s;
  return [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16));
};
const lin = (c) => {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
export const luminance = (h) => {
  const [r, g, b] = hex(h).map(lin);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
export const contrast = (fg, bg) => {
  const a = luminance(fg);
  const b = luminance(bg);
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
};

/** Nudge a hex lighter, one step at a time, until it clears `target` on `bg`. */
export function raiseUntil(fg, bg, target = 4.5) {
  let [r, g, b] = hex(fg);
  for (let i = 0; i < 255; i++) {
    const c = `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
    if (contrast(c, bg) >= target) return { hex: c, ratio: contrast(c, bg), steps: i };
    r = Math.min(255, r + 1);
    g = Math.min(255, g + 1);
    b = Math.min(255, b + 1);
  }
  return null;
}

if (process.argv[2] && process.argv[2] !== '--audit') {
  const [, , fg, bg, target] = process.argv;
  const ratio = contrast(fg, bg);
  const t = Number(target ?? 4.5);
  console.log(`${fg} on ${bg} = ${ratio.toFixed(3)}:1  ${ratio >= t ? 'PASS' : 'FAIL'} (target ${t})`);
  if (ratio < t) console.log('  minimum lift:', raiseUntil(fg, bg, t));
}

/** Nudge a hex darker until it clears `target` on `bg`. */
export function lowerUntil(fg, bg, target = 4.5) {
  let [r, g, b] = hex(fg);
  for (let i = 0; i < 255; i++) {
    const c = `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
    if (contrast(c, bg) >= target) return { hex: c, ratio: contrast(c, bg), steps: i };
    r = Math.max(0, r - 1);
    g = Math.max(0, g - 1);
    b = Math.max(0, b - 1);
  }
  return null;
}

/** Composite `fg` at `alpha` over `bg`, returning the flattened hex. */
export function flatten(fg, bg, alpha) {
  const f = hex(fg);
  const b = hex(bg);
  const out = f.map((v, i) => Math.round(v * alpha + b[i] * (1 - alpha)));
  return `#${out.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}
