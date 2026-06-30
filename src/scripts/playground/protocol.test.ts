import { test, expect } from 'bun:test';
import { parseCommand } from './protocol';

test('the five kv verbs parse', () => {
  expect(parseCommand('get config:theme')).toEqual({ op: 'get', key: 'config:theme' });
  expect(parseCommand('delete users:1')).toEqual({ op: 'delete', key: 'users:1' });
  expect(parseCommand('prefix users:')).toEqual({ op: 'prefix', prefix: 'users:' });
  expect(parseCommand('range a z')).toEqual({ op: 'range', start: 'a', end: 'z' });
  expect(parseCommand('put session:1 token')).toEqual({ op: 'put', key: 'session:1', value: 'token' });
});

test('verbs are case-insensitive', () => {
  expect(parseCommand('GET config:theme')).toEqual({ op: 'get', key: 'config:theme' });
  expect(parseCommand('Prefix users:')).toEqual({ op: 'prefix', prefix: 'users:' });
});

test('put captures a JSON value tail verbatim', () => {
  expect(parseCommand('put users:4 {"id":"4","name":"Lin"}')).toEqual({
    op: 'put',
    key: 'users:4',
    value: '{"id":"4","name":"Lin"}',
  });
});

test('put collapses unquoted whitespace, quotes preserve it', () => {
  expect(parseCommand('put note hello   world')).toEqual({ op: 'put', key: 'note', value: 'hello world' });
  expect(parseCommand('put note "hello   world"')).toEqual({ op: 'put', key: 'note', value: 'hello   world' });
});

test('unmatched quote is a friendly error', () => {
  expect(parseCommand('put k "oops')).toMatchObject({ op: 'error' });
});

test('comment and blank lines are skipped; first real line runs', () => {
  expect(parseCommand('# a cheatsheet comment\n\nprefix users:')).toEqual({ op: 'prefix', prefix: 'users:' });
});

test('empty / comment-only input is an error', () => {
  expect(parseCommand('   ')).toMatchObject({ op: 'error' });
  expect(parseCommand('# only a comment')).toMatchObject({ op: 'error' });
});

test('wrong arg count yields a usage error', () => {
  expect(parseCommand('get')).toMatchObject({ op: 'error' });
  expect(parseCommand('range a')).toMatchObject({ op: 'error' });
  expect(parseCommand('put k')).toMatchObject({ op: 'error' });
});

test('unknown verb lists the supported verbs', () => {
  const r = parseCommand('select * from users');
  expect(r.op).toBe('error');
  if (r.op === 'error') expect(r.error).toContain('get');
});

test('inspect / stats parse with no args', () => {
  expect(parseCommand('inspect')).toEqual({ op: 'inspect' });
  expect(parseCommand('stats')).toEqual({ op: 'stats' });
  expect(parseCommand('inspect extra')).toMatchObject({ op: 'error' });
});

test('import parses a JSON object of string values', () => {
  expect(parseCommand('import {"session:a1":"token-abc","session:a2":"token-xyz"}')).toEqual({
    op: 'import',
    entries: { 'session:a1': 'token-abc', 'session:a2': 'token-xyz' },
  });
});

test('import rejects non-objects and non-string values', () => {
  expect(parseCommand('import [1,2,3]')).toMatchObject({ op: 'error' });
  expect(parseCommand('import {"n":1}')).toMatchObject({ op: 'error' });
  expect(parseCommand('import not-json')).toMatchObject({ op: 'error' });
});
