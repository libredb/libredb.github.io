import { test, expect } from 'bun:test';
import { NOTICES } from './console-copy';

const REQUIRED_KEYS = [
  'monitoring',
  'query',
  'save',
  'begin',
  'sandbox',
  'edit',
  'import',
  'format',
  'clear',
  'lines',
  'history',
  'saved',
  'charts',
  'autopilot',
  'pivot',
  'diff',
  'dashboard',
  'newtab',
  'closetab',
];
const VALID_KINDS = ['notice', 'error', 'ok', 'comment'];

test('every required control has a console message', () => {
  for (const k of REQUIRED_KEYS) expect(NOTICES[k]).toBeDefined();
});

test('messages are well-formed', () => {
  for (const [key, m] of Object.entries(NOTICES)) {
    expect(VALID_KINDS).toContain(m.kind);
    expect(m.text.length).toBeGreaterThan(0);
    if (m.cta) expect(m.cta.href.startsWith('http')).toBe(true);
    if (m.cta) expect(m.cta.label.length).toBeGreaterThan(0);
  }
});
