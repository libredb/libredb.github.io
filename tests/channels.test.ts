import { describe, expect, it } from 'bun:test';
import { channels, channelCategories } from '../src/data/deploy-channels';
import { deploy, openSource } from '../src/data/home';
import { faq } from '../src/data/faq';

/**
 * The site must only ever advertise a channel someone can install from today.
 *
 * libredb-studio/distribution/channels.yaml is the source of truth, and it marks
 * each channel live | pending | deprecated. The homepage shipped "OpenShift
 * operator" in three places while that channel was `pending` (the OperatorHub.io
 * listing is still in review), and the headline stat said "27 channels, 22 live"
 * against an inventory of 33 / 25. Both are the same failure: prose transcribed
 * once and never reconciled.
 *
 * These tests cannot read the other repository — it is not a dependency — so the
 * scorecard is pinned here. When channels.yaml moves, update SCORECARD and the
 * data file together; docs/CHANNELS.md § "Coverage snapshot" is the number to
 * copy from.
 */
const SCORECARD = { total: 33, live: 25, pending: 7, deprecated: 1 };

/** Channels that exist in the inventory but are NOT live, so must never appear. */
const NOT_LIVE = ['OperatorHub', 'OpenShift', 'CasaOS', 'Easypanel', 'Portainer', 'Umbrel', 'AppImageHub', 'Flathub'];

describe('the deploy data holds every live channel and only live channels', () => {
  it('has exactly as many entries as the scorecard has live channels', () => {
    expect(channels.length).toBe(SCORECARD.live);
  });

  it('accounts for every category the scorecard lists', () => {
    const perCategory: Record<string, number> = {
      'registries-releases': 2,
      containers: 2,
      'kubernetes-operators': 2,
      'package-managers': 5,
      'os-desktop': 2,
      'paas-catalogs': 8,
      'deploy-recipes': 3,
      'cloud-marketplaces': 1,
    };
    for (const [cat, n] of Object.entries(perCategory)) {
      expect(channels.filter((c) => c.category === cat).length, cat).toBe(n);
    }
    expect(Object.values(perCategory).reduce((a, b) => a + b, 0)).toBe(SCORECARD.live);
  });

  it('gives every category in the list at least one channel', () => {
    for (const c of channelCategories) {
      expect(
        channels.some((ch) => ch.category === c.id),
        `${c.id} has no channels`,
      ).toBe(true);
    }
  });

  it('names no channel that is pending or deprecated', () => {
    for (const c of channels) {
      for (const banned of NOT_LIVE) {
        expect(c.name.includes(banned), `${c.name} is not live`).toBe(false);
      }
    }
  });
});

describe('the marketing copy quotes the scorecard, not a stale memory of it', () => {
  const prose = [
    ...openSource.stats.map((s) => `${s.v} ${s.l}`),
    `${deploy.channelsCount} ${deploy.channelsLabel}`,
    ...faq.map((f) => f.a),
    ...deploy.channels,
    deploy.intro,
  ].join(' | ');

  it('states the current totals', () => {
    expect(prose).toContain(String(SCORECARD.total));
    expect(prose).toContain(String(SCORECARD.live));
  });

  it('no longer states the superseded totals', () => {
    expect(prose).not.toContain('27 channels');
    expect(prose).not.toContain('22 of them live');
    expect(prose).not.toContain('22 live');
  });

  it('advertises no pending channel anywhere in the copy', () => {
    for (const banned of NOT_LIVE) {
      expect(prose.includes(banned), `copy names the non-live channel "${banned}"`).toBe(false);
    }
  });
});
