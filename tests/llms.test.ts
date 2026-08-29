import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { engines } from '../src/data/engines';
import { channels } from '../src/data/deploy-channels';
import { pageRoutes } from '../src/pages/llms.txt';
import site from '../site.config.json' with { type: 'json' };

/**
 * Both llms files are generated, so most of what a test could assert is true by
 * construction. What is NOT true by construction is the hand-written half: the
 * per-page descriptions, and the counts the site spells out in prose.
 *
 * The static files these replaced failed on exactly that hand-written half —
 * they named seven engines against seventeen and listed two pages out of
 * twelve. So that is what this guards.
 */
const llms = () => readFileSync('dist/llms.txt', 'utf8');
const full = () => readFileSync('dist/llms-full.txt', 'utf8');

/** Written-out numbers the site uses in prose, up to what it plausibly needs. */
const WORDS = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen',
  'twenty',
];

describe('llms.txt', () => {
  it('describes every page it lists', () => {
    // A route added to site.config.json with no description here reaches the
    // file as a bare link with a trailing colon, which is worse than absent:
    // it tells a model the page exists and nothing about what is on it.
    const text = llms();
    for (const route of pageRoutes) {
      const line = text.split('\n').find((l) => l.startsWith(`- [${route}]`));
      expect(line, `${route} is missing from llms.txt`).toBeDefined();
      expect(line!.replace(/^.*\): ?/, ''), `${route} has no description`).not.toBe('');
    }
  });

  it('lists no page that is not a route', () => {
    const listed = [...llms().matchAll(/^- \[(\/[^\]]*)\]/gm)].map((m) => m[1]);
    for (const route of listed) {
      expect(site.routes, `llms.txt points at ${route}, which the site does not build`).toContain(route);
    }
  });

  it('counts the engines the engine list actually holds', () => {
    expect(full()).toContain(`## Supported engines (${engines.length})`);
    for (const e of engines) {
      expect(full(), `${e.name} is missing from llms-full.txt`).toContain(e.name);
    }
  });

  it('counts the channels the channel list actually holds', () => {
    expect(full()).toContain(`## Deployment (${channels.length} live channels)`);
  });

  it('spells the engine count the same way everywhere it is written out', () => {
    // site.config.json's description said "twelve more engines" while the
    // homepage said "thirteen more" and the data held seventeen. That one line
    // is the meta description of every page and the first paragraph of
    // llms.txt, so it was the most-read wrong sentence on the site.
    const named = (site.description.match(/\b(PostgreSQL|MySQL|MongoDB|Redis)\b/g) ?? []).length;
    const more = WORDS.indexOf(site.description.match(/and (\w+) more engines/)?.[1] ?? '');
    expect(more, 'the description no longer says "and <n> more engines"').toBeGreaterThan(-1);
    expect(named + more, 'site.description undercounts or overcounts the engines').toBe(engines.length);
  });

  it('carries the vendor identity, which is what a model is asked to verify', () => {
    for (const file of [llms(), full()]) {
      expect(file).toContain('Sekoya Grup Bilisim ve Teknoloji Ltd. Sti.');
      expect(file).toContain('0759114698700001');
    }
  });

  it('publishes the limits, not only the capabilities', () => {
    // The generated file inherits every engine's `not` line and every feature's
    // `limit`. If a refactor drops them, the file quietly becomes a brochure.
    expect(full()).toContain('### What each engine does NOT do');
    expect(full()).toContain('**Limit:**');
    expect(full(), 'the localStorage caveat is the one a reader most needs').toContain('unencrypted in browser');
  });

  it('makes no claim about a competitor', () => {
    // The file this replaced asserted what pgAdmin and DBeaver could not do,
    // and was wrong about both. /compare argues from architecture instead, and
    // this file must not reintroduce the older framing.
    expect(full()).not.toMatch(/\bunlike\b/i);
  });
});
