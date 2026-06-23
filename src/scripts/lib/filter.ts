/** Case-insensitive subsequence match. Returns null if not a subsequence,
 *  else a score (sum of gap sizes; lower = tighter = better). */
export function fuzzyMatch(query: string, text: string): number | null {
  const q = query.toLowerCase().trim();
  const t = text.toLowerCase();
  if (q === '') return 0;
  let qi = 0;
  let score = 0;
  let last = -1;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      if (last >= 0) score += ti - last - 1;
      last = ti;
      qi++;
    }
  }
  return qi === q.length ? score : null;
}

export function filterItems<T>(query: string, items: T[], keyFn: (it: T) => string): T[] {
  if (query.trim() === '') return items;
  return items
    .map((item) => ({ item, score: fuzzyMatch(query, keyFn(item)) }))
    .filter((r): r is { item: T; score: number } => r.score !== null)
    .sort((a, b) => a.score - b.score)
    .map((r) => r.item);
}
