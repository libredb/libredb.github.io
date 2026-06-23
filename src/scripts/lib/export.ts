export type Row = Record<string, unknown>;

export function toJSON(rows: Row[]): string {
  return JSON.stringify(rows, null, 2);
}

function csvCell(v: unknown): string {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCSV(rows: Row[]): string {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(',')];
  for (const r of rows) lines.push(headers.map((h) => csvCell(r[h])).join(','));
  return lines.join('\n');
}

export function serialize(rows: Row[], format: 'json' | 'csv'): string {
  return format === 'csv' ? toCSV(rows) : toJSON(rows);
}
