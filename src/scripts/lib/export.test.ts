import { test, expect } from 'bun:test';
import { toJSON, toCSV, serialize } from './export';

test('toJSON pretty-prints rows', () => {
  expect(toJSON([{ a: 1 }])).toBe('[\n  {\n    "a": 1\n  }\n]');
});

test('toCSV writes header then rows', () => {
  const csv = toCSV([
    { name: 'pg', type: 'relational' },
    { name: 'redis', type: 'kv' },
  ]);
  expect(csv).toBe('name,type\npg,relational\nredis,kv');
});

test('toCSV quotes cells containing comma, quote, or newline', () => {
  const csv = toCSV([{ a: 'x,y', b: 'he said "hi"' }]);
  expect(csv).toBe('a,b\n"x,y","he said ""hi"""');
});

test('toCSV on empty array is empty string', () => {
  expect(toCSV([])).toBe('');
});

test('serialize dispatches by format', () => {
  expect(serialize([{ a: 1 }], 'csv')).toBe('a\n1');
  expect(serialize([{ a: 1 }], 'json')).toBe(toJSON([{ a: 1 }]));
});
