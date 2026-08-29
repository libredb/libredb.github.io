/**
 * Reports how each self-hosted engine mark reads on the white hexagon plate the
 * design places it on.
 *
 * These are third-party TRADEMARKS, so they are shipped in their exact brand
 * colour and never recoloured — vendor brand guidelines forbid it, and the
 * engine name is rendered as text directly beneath each mark, so the logo is
 * decorative (alt="") and carries no WCAG contrast requirement. This script
 * exists so the faint ones are a known, measured fact rather than a surprise.
 *
 *   node scripts/logo-contrast-report.mjs
 */
import { readdirSync, readFileSync } from 'node:fs';
import { contrast } from './contrast.mjs';

const WHITE = '#ffffff';
const rows = [];

for (const file of readdirSync('public/engines').sort()) {
  if (!file.endsWith('.svg')) continue;
  const svg = readFileSync(`public/engines/${file}`, 'utf8');
  const fills = [...svg.matchAll(/fill="(#[0-9a-fA-F]{3,6})"/g)].map((m) => m[1].toLowerCase());
  if (fills.length === 0) continue;
  // a mark reads as well as its STRONGEST fill against the plate
  const best = Math.max(...fills.map((f) => contrast(f, WHITE)));
  rows.push({ id: file.replace('.svg', ''), fills: fills.length, best });
}

rows.sort((a, b) => a.best - b.best);
for (const r of rows) {
  const flag = r.best >= 3 ? 'ok  ' : 'faint';
  console.log(
    `${flag} ${r.best.toFixed(2).padStart(6)}:1  ${r.id.padEnd(14)} (${r.fills} fill${r.fills > 1 ? 's' : ''})`,
  );
}
const faint = rows.filter((r) => r.best < 3).map((r) => r.id);
if (faint.length) {
  console.log(`\n${faint.length} mark(s) read faint on the white plate: ${faint.join(', ')}`);
  console.log('Shipped in brand colour on purpose — see DECISIONS.md § "Engine marks".');
}
