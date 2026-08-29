/**
 * Date formatting.
 *
 * The design system mandates Turkish conventions for Turkish copy
 * (12.03.2026) — so the formatter is locale-driven, never hard-coded.
 * English pages get the long form (12 March 2026).
 */
export function formatDate(value: Date | string, locale: string): string {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  if (locale === 'tr') {
    return new Intl.DateTimeFormat('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(d);
  }
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
