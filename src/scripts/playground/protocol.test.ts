import { test, expect } from 'bun:test';
import { parseCommand } from './protocol';

test('get parses key', () => {
  expect(parseCommand('get config:theme')).toEqual({ op: 'get', key: 'config:theme' });
});

test('put captures the whole value tail', () => {
  expect(parseCommand('put config:theme dark mode')).toEqual({
    op: 'put',
    key: 'config:theme',
    value: 'dark mode',
  });
});

test('delete / prefix / range', () => {
  expect(parseCommand('delete config:theme')).toEqual({ op: 'delete', key: 'config:theme' });
  expect(parseCommand('prefix config:')).toEqual({ op: 'prefix', prefix: 'config:' });
  expect(parseCommand('range a z')).toEqual({ op: 'range', start: 'a', end: 'z' });
});

test('doc family', () => {
  expect(parseCommand('doc.all articles')).toEqual({ op: 'docall', collection: 'articles' });
  expect(parseCommand('doc.get articles a1')).toEqual({ op: 'docget', collection: 'articles', id: 'a1' });
  expect(parseCommand('doc.delete articles a1')).toEqual({ op: 'docdel', collection: 'articles', id: 'a1' });
  expect(parseCommand('doc.put articles a3 {"title":"Hi"}')).toEqual({
    op: 'docput',
    collection: 'articles',
    id: 'a3',
    json: { title: 'Hi' },
  });
  expect(parseCommand('doc.find articles {"published":true}')).toEqual({
    op: 'docfind',
    collection: 'articles',
    predicate: { published: true },
  });
});

test('relational family', () => {
  expect(parseCommand('select * from users')).toEqual({ op: 'select', table: 'users' });
  expect(parseCommand('select * from users limit 2')).toEqual({ op: 'select', table: 'users', limit: 2 });
  expect(parseCommand('insert into users {"id":"4","name":"Lin","age":29,"active":true}')).toEqual({
    op: 'insert',
    table: 'users',
    row: { id: '4', name: 'Lin', age: 29, active: true },
  });
  expect(parseCommand('delete from users 4')).toEqual({ op: 'remove', table: 'users', pk: '4' });
});

test('help', () => {
  expect(parseCommand('help')).toEqual({ op: 'help' });
});

test('empty input is an error', () => {
  expect(parseCommand('   ')).toEqual({ op: 'error', error: "empty command — type 'help'." });
});

test('unknown verb is a friendly error', () => {
  expect(parseCommand('frobnicate x')).toMatchObject({ op: 'error' });
});

test('invalid JSON tail is a friendly error, never a throw', () => {
  expect(parseCommand('doc.put articles a3 {not json}')).toMatchObject({ op: 'error' });
  expect(parseCommand('insert into users ["not","an","object"]')).toMatchObject({ op: 'error' });
});

test('prefix requires a non-empty argument', () => {
  expect(parseCommand('prefix')).toMatchObject({ op: 'error' });
});
