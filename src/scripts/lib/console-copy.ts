export type ConsoleKind = 'notice' | 'error' | 'ok' | 'comment';
interface ConsoleCta {
  label: string;
  href: string;
}
export interface ConsoleMessage {
  kind: ConsoleKind;
  text: string;
  hint?: string;
  cta?: ConsoleCta;
}

const DEMO = 'https://app.libredb.org';
const demo = (label = 'Open demo'): ConsoleCta => ({ label, href: DEMO });

/** Playful, bold in-character responses for non-functional chrome controls. */
export const NOTICES: Record<string, ConsoleMessage> = {
  monitoring: {
    kind: 'comment',
    text: "nothing's on fire here. live monitoring runs in the app",
    cta: demo(),
  },
  query: { kind: 'notice', text: 'the visual query builder is a live-app superpower', cta: demo() },
  save: {
    kind: 'error',
    text: '42501: permission denied — must be superuser',
    hint: 'superusers save queries in the live demo',
    cta: demo('Become one'),
  },
  begin: {
    kind: 'notice',
    text: 'BEGIN…COMMIT — real transactions, real database. In the app',
    cta: demo(),
  },
  sandbox: {
    kind: 'notice',
    text: 'SANDBOX runs scary queries safely. Try it in the app',
    cta: demo(),
  },
  edit: {
    kind: 'comment',
    text: 'read-only out here; full edit mode lives in the app',
    cta: demo(),
  },
  import: {
    kind: 'notice',
    text: 'drop a .sql / .csv and IMPORT it — in the live app',
    cta: demo(),
  },
  format: { kind: 'notice', text: 'one-keystroke SQL formatting ships in the app', cta: demo() },
  clear: { kind: 'comment', text: 'nothing to clear on a landing page ;)' },
  lines: { kind: 'comment', text: 'line numbers are bolted on around here' },
  history: {
    kind: 'notice',
    text: 'every query you run is logged per-workspace — in the app',
    cta: demo(),
  },
  saved: {
    kind: 'notice',
    text: 'star a query to save it — saved queries live in the app',
    cta: demo(),
  },
  charts: {
    kind: 'notice',
    text: 'turn any result set into a chart, one click — in the app',
    cta: demo(),
  },
  autopilot: {
    kind: 'notice',
    text: 'Autopilot hunts slow queries and writes the fix. In the app',
    cta: demo(),
  },
  pivot: {
    kind: 'notice',
    text: 'pivot any result like a spreadsheet — only works in production',
    cta: demo(),
  },
  diff: {
    kind: 'notice',
    text: 'diff two schemas or result sets side-by-side — in the app',
    cta: demo(),
  },
  dashboard: {
    kind: 'notice',
    text: 'pin queries into a live dashboard — build yours in the app',
    cta: demo(),
  },
  newtab: { kind: 'notice', text: 'more tabs unlock in the app', cta: demo() },
  closetab: { kind: 'comment', text: "you can't close the one thing selling you on us ;)" },
};
