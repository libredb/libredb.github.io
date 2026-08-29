/**
 * Date formatting — the long form, 12 March 2026.
 *
 * en-GB is named explicitly rather than left to the runtime default: the site is
 * English everywhere, and a build machine set to another locale must not change
 * what a page says.
 */
export function formatDate(value: Date | string): string {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(d);
}

/** ISO-8601 date (yyyy-mm-dd) for <time datetime>. */
export function isoDate(value: Date | string): string {
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}

/** Rough reading time in minutes at 200 wpm, floored to 1. */
export function readingTime(body: string): number {
  const words = body.trim().split(/\s+/u).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}
