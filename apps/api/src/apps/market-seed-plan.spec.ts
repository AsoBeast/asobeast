import { TrackingState } from '../keywords/keyword-import-plan';
import { pairKey } from '../keywords/keyword-import';
import { planSeed } from './market-seed-plan';

const phrases = (...texts: string[]) => texts.map((text) => ({ text }));

const tracking = (entries: Record<string, TrackingState>) =>
  new Map(
    Object.entries(entries).map(([text, state]) => [
      pairKey('de', text),
      state,
    ]),
  );

describe('planSeed', () => {
  it('chooses every phrase when the plan has no keyword limit', () => {
    expect(planSeed(phrases('a', 'b'), new Map(), 'de', null)).toEqual({
      chosen: phrases('a', 'b'),
      opened: 2,
      skipped: 0,
    });
  });

  it('fills the room in order and skips the rest', () => {
    expect(planSeed(phrases('a', 'b', 'c'), new Map(), 'de', 2)).toEqual({
      chosen: phrases('a', 'b'),
      opened: 2,
      skipped: 1,
    });
  });

  it('leaves out a phrase the app already tracks or paused', () => {
    const plan = planSeed(
      phrases('a', 'b', 'c'),
      tracking({
        a: { own: 'active', elsewhere: false },
        b: { own: 'paused', elsewhere: true },
      }),
      'de',
      0,
    );

    expect(plan).toEqual({ chosen: [], opened: 0, skipped: 1 });
  });

  it('takes a phrase another app tracks without spending the room', () => {
    const plan = planSeed(
      phrases('a', 'b'),
      tracking({ a: { own: null, elsewhere: true } }),
      'de',
      0,
    );

    expect(plan).toEqual({ chosen: phrases('a'), opened: 0, skipped: 1 });
  });

  it('reads the tracking of the seeded market only', () => {
    const elsewhere = new Map([
      [pairKey('fr', 'a'), { own: 'active' as const, elsewhere: false }],
    ]);

    expect(planSeed(phrases('a'), elsewhere, 'de', null).chosen).toEqual(
      phrases('a'),
    );
  });
});
