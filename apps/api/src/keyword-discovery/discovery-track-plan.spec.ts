import { pairKey } from '../keywords/keyword-import';
import { TrackingLookup, TrackingState } from '../keywords/keyword-import-plan';
import { planDiscoveryTrack, TrackRow } from './discovery-track-plan';

const row = (text: string, country = 'us'): TrackRow => ({
  keywordId: `${country}:${text}`,
  text,
  country,
  source: 'title',
  position: null,
  depth: null,
  checkedOn: null,
});

const lookup = (
  entries: [string, string, TrackingState][] = [],
): TrackingLookup =>
  new Map(
    entries.map(([country, text, state]) => [pairKey(country, text), state]),
  );

describe('planDiscoveryTrack', () => {
  it('chooses every untracked row when the room is unmetered', () => {
    const rows = [row('a'), row('b'), row('c')];
    expect(planDiscoveryTrack(rows, lookup(), null)).toEqual({
      chosen: rows,
      skipped: 0,
    });
  });

  it('chooses rows in input order up to the room and skips the rest', () => {
    const rows = ['a', 'b', 'c', 'd', 'e'].map((text) => row(text));
    expect(planDiscoveryTrack(rows, lookup(), 2)).toEqual({
      chosen: rows.slice(0, 2),
      skipped: 3,
    });
  });

  it.each(['active', 'paused'] as const)(
    'never chooses or skips a row the app already tracks %s',
    (own) => {
      const plan = planDiscoveryTrack(
        [row('a'), row('b')],
        lookup([['us', 'a', { own, elsewhere: false }]]),
        0,
      );
      expect(plan).toEqual({ chosen: [], skipped: 1 });
    },
  );

  it('chooses a row another app tracks even without room', () => {
    const rows = [row('a')];
    expect(
      planDiscoveryTrack(
        rows,
        lookup([['us', 'a', { own: null, elsewhere: true }]]),
        0,
      ),
    ).toEqual({ chosen: rows, skipped: 0 });
  });

  it('shares the room between countries', () => {
    const rows = [row('a', 'us'), row('b', 'us'), row('a', 'de'), row('c')];
    const plan = planDiscoveryTrack(rows, lookup(), 3);
    expect(plan.chosen).toEqual([row('a', 'us'), row('b', 'us'), row('c')]);
    expect(plan.skipped).toBe(1);
  });

  it('never admits more than the room across countries', () => {
    const rows = [row('a', 'us'), row('a', 'de'), row('a', 'fr')];
    const plan = planDiscoveryTrack(rows, lookup(), 2);
    expect(plan.chosen).toHaveLength(2);
    expect(plan.skipped).toBe(1);
  });

  it('plans nothing for no rows', () => {
    expect(planDiscoveryTrack([], lookup(), 5)).toEqual({
      chosen: [],
      skipped: 0,
    });
  });
});
