import type { TrackedRow } from './analytics.support';
import {
  baselineCheck,
  currentCheck,
  hasBaseline,
  keywordsAtBaseline,
  keywordsNow,
  positionsNow,
} from './baseline';
import { DAY_MS, Ranking } from './days';

const T = new Date('2026-07-06T00:00:00.000Z');
const day = (offset: number) => new Date(T.getTime() + offset * DAY_MS);
const check = (offset: number, position: number | null): Ranking => ({
  position,
  depth: 200,
  date: day(offset),
});
const row = (
  rankings: Ranking[],
  metrics: Array<[traffic: number, offset: number]> = [],
): TrackedRow => ({
  keywordId: 'kw_1',
  source: 'MANUAL',
  relevance: null,
  keyword: {
    text: 'focus timer',
    country: 'us',
    metrics: metrics.map(([traffic, offset]) => ({
      traffic,
      difficulty: 10,
      date: day(offset),
    })),
    rankings,
  },
});

describe('baselineCheck', () => {
  it('reads the check on the target day first', () => {
    expect(
      baselineCheck([check(1, 2), check(0, 3), check(-1, 4)], T)?.position,
    ).toBe(3);
  });

  it('reads the day after before the day before', () => {
    expect(baselineCheck([check(-1, 4), check(1, 2)], T)?.position).toBe(2);
  });

  it('reads the day before when nothing nearer exists', () => {
    expect(baselineCheck([check(-1, 4)], T)?.position).toBe(4);
  });

  it('has no baseline further than one day away', () => {
    expect(baselineCheck([check(2, 1), check(-2, 1)], T)).toBeNull();
  });

  it('does not depend on the order of the checks', () => {
    const ascending = [check(-1, 4), check(1, 2)];
    expect(baselineCheck(ascending, T)).toEqual(
      baselineCheck([...ascending].reverse(), T),
    );
  });

  it('keeps a check that found nothing as the baseline', () => {
    expect(baselineCheck([check(0, null), check(1, 5)], T)).toEqual(
      check(0, null),
    );
  });
});

describe('hasBaseline', () => {
  it('finds a baseline when one keyword was checked the day after', () => {
    expect(hasBaseline([row([]), row([check(1, 7)])], T)).toBe(true);
  });

  it('finds none when every check is two days away', () => {
    expect(hasBaseline([row([check(2, 7)]), row([check(-2, 3)])], T)).toBe(
      false,
    );
  });
});

describe('keywordsAtBaseline', () => {
  it('reads the position of each keyword baseline check and null without one', () => {
    expect(
      keywordsAtBaseline([row([check(-1, 6)]), row([check(3, 2)])], T).map(
        (keyword) => keyword.position,
      ),
    ).toEqual([6, null]);
  });

  it('reads the popularity scored on or before the baseline check', () => {
    const scored = row(
      [check(-1, 6)],
      [
        [60, 0],
        [20, -1],
      ],
    );

    expect(keywordsAtBaseline([scored], T)).toEqual([
      { traffic: 20, position: 6 },
    ]);
  });

  it('reads the popularity at the target without a baseline check', () => {
    expect(keywordsAtBaseline([row([], [[30, -3]])], T)).toEqual([
      { traffic: 30, position: null },
    ]);
  });
});

describe('currentCheck', () => {
  it('reads the check of the reference day', () => {
    expect(currentCheck([check(0, 3), check(-1, 6)], T)?.position).toBe(3);
  });

  it('falls back to the day before when the run has not reached the keyword', () => {
    expect(currentCheck([check(-1, 6)], T)?.position).toBe(6);
  });

  it('never reaches two days back', () => {
    expect(currentCheck([check(-2, 6)], T)).toBeNull();
  });

  it('never reads the day after', () => {
    expect(currentCheck([check(1, 2)], T)).toBeNull();
  });

  it('keeps a check of the reference day that found nothing', () => {
    expect(currentCheck([check(0, null), check(-1, 6)], T)).toEqual(
      check(0, null),
    );
  });
});

describe('keywordsNow', () => {
  it('reads a keyword checked the day before with the popularity of that day', () => {
    const pending = row(
      [check(-1, 6)],
      [
        [70, 0],
        [40, -1],
      ],
    );

    expect(keywordsNow([pending], T)).toEqual([{ traffic: 40, position: 6 }]);
  });

  it('reads a keyword checked on neither day as not found', () => {
    expect(keywordsNow([row([check(-2, 6)], [[30, -3]])], T)).toEqual([
      { traffic: 30, position: null },
    ]);
  });
});

describe('positionsNow', () => {
  it('reads each keyword at its current check', () => {
    expect(
      positionsNow(
        [row([check(0, 2)]), row([check(-1, 6)]), row([check(-2, 8)])],
        T,
      ),
    ).toEqual([2, 6, null]);
  });
});
