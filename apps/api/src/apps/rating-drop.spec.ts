import {
  newRatingDrop,
  RATING_DROP_HISTORY_DAYS,
  ratingDropAt,
  type RatedSnapshot,
} from './rating-drop';

const NOW = new Date('2026-11-03T03:10:00.000Z');
const daysAgo = (days: number): Date =>
  new Date(NOW.getTime() - days * 86_400_000);

const snap = (
  days: number,
  ratingAvg: number | null,
  ratingCount: number | null = 1200,
  version: string | null = '1.0.0',
): RatedSnapshot => ({
  capturedAt: daysAgo(days),
  ratingAvg,
  ratingCount,
  version,
});

describe('ratingDropAt', () => {
  it.each<[string, RatedSnapshot[], number | null]>([
    ['4.66 to 4.55', [snap(0, 4.55, 1210), snap(7, 4.66)], 1],
    ['4.70 to 4.60', [snap(0, 4.6, 1210), snap(7, 4.7)], 1],
    ['nine hundredths', [snap(0, 4.55, 1210), snap(7, 4.64)], null],
    ['4.50 to 4.30', [snap(0, 4.3, 1210), snap(7, 4.5)], 2],
    [
      'a reference under 20 ratings',
      [snap(0, 4.3, 25), snap(7, 4.5, 19)],
      null,
    ],
    ['a latest under 20 ratings', [snap(0, 4.3, 19), snap(7, 4.5)], null],
    ['a reference 11 days old', [snap(0, 4.3), snap(11, 4.5)], null],
    ['a reference exactly 7 days old', [snap(0, 4.3), snap(7, 4.5)], 2],
    ['a reference exactly 10 days old', [snap(0, 4.3), snap(10, 4.5)], 2],
    ['a reference 6 days old only', [snap(0, 4.3), snap(6, 4.5)], null],
    ['a rise', [snap(0, 4.5), snap(7, 4.3)], null],
    ['a null latest average', [snap(0, null), snap(7, 4.5)], null],
    ['a null latest count', [snap(0, 4.3, null), snap(7, 4.5)], null],
    ['an empty history', [], null],
    ['a single snapshot', [snap(0, 4.3)], null],
  ])('judges %s', (_name, history, tenths) => {
    expect(ratingDropAt(history, 0)?.dropTenths ?? null).toBe(tenths);
  });

  it('skips a reference without a rating for the next older one in the window', () => {
    const drop = ratingDropAt([snap(0, 4.3), snap(7, null), snap(8, 4.5)], 0);

    expect(drop).toMatchObject({ from: 4.5, fromDate: '2026-10-26' });
  });

  it('answers the averages, counts and UTC days of both snapshots', () => {
    expect(ratingDropAt([snap(0, 4.44, 1260), snap(7, 4.66, 1200)], 0)).toEqual(
      {
        from: 4.66,
        to: 4.44,
        fromCount: 1200,
        toCount: 1260,
        fromDate: '2026-10-27',
        toDate: '2026-11-03',
        dropTenths: 2,
        version: null,
      },
    );
  });

  it.each<[string | null, string | null, string | null]>([
    ['1.1.0', '1.0.0', '1.1.0'],
    ['1.0.0', '1.0.0', null],
    [null, '1.0.0', null],
  ])('names version %p after %p as %p', (latest, reference, expected) => {
    expect(
      ratingDropAt(
        [snap(0, 4.3, 1200, latest), snap(7, 4.5, 1200, reference)],
        0,
      )?.version,
    ).toBe(expected);
  });

  it('judges an older capture against its own reference', () => {
    const history = [snap(0, 4.3), snap(1, 4.3), snap(8, 4.5)];

    expect(ratingDropAt(history, 1)?.dropTenths).toBe(2);
  });
});

describe('newRatingDrop', () => {
  it('raises a drop the previous capture did not see', () => {
    expect(
      newRatingDrop([snap(0, 4.3), snap(1, 4.5), snap(8, 4.5)]),
    ).toMatchObject({ dropTenths: 2 });
  });

  it('stays quiet when the drop did not deepen', () => {
    expect(
      newRatingDrop([snap(0, 4.3), snap(0.01, 4.3), snap(7.5, 4.5)]),
    ).toBeNull();
  });

  it('raises a drop that deepened since the previous capture', () => {
    expect(
      newRatingDrop([snap(0, 4.3), snap(1, 4.4), snap(8, 4.5)]),
    ).toMatchObject({ dropTenths: 2 });
  });

  it('raises nothing without a drop', () => {
    expect(newRatingDrop([snap(0, 4.5), snap(7, 4.5)])).toBeNull();
    expect(newRatingDrop([])).toBeNull();
  });
});

describe('newRatingDrop over a daily history', () => {
  const steady = Array.from({ length: 10 }, () => 4.6);

  const alertedTenths = (ratings: readonly number[]): (number | null)[] =>
    ratings.map(
      (_rating, day) =>
        newRatingDrop(
          ratings
            .slice(0, day + 1)
            .map((ratingAvg, index) => snap(day - index, ratingAvg))
            .reverse(),
        )?.dropTenths ?? null,
    );

  it('alerts a fall, stays quiet through a partial recovery and its return, and alerts a deeper fall', () => {
    expect(alertedTenths([...steady, 4.3, 4.5, 4.3, 4.2]).slice(10)).toEqual([
      3,
      null,
      null,
      4,
    ]);
  });

  it('stays quiet when the rating returns to an alerted depth after a full recovery', () => {
    expect(alertedTenths([...steady, 4.3, 4.6, 4.3]).slice(10)).toEqual([
      3,
      null,
      null,
    ]);
  });

  it('alerts a new fall once the reference has caught up with the first one', () => {
    const persisting = Array.from({ length: 8 }, () => 4.3);

    expect(alertedTenths([...steady, ...persisting, 4.0]).slice(10)).toEqual([
      3,
      ...Array.from({ length: 7 }, () => null),
      3,
    ]);
  });
});

describe('rating drop review fixes', () => {
  it('counts a decline under a tenth as nothing even with more decimals', () => {
    expect(ratingDropAt([snap(0, 4.55), snap(7, 4.649)], 0)).toBeNull();
    expect(ratingDropAt([snap(0, 4.4), snap(7, 4.5)], 0)?.dropTenths).toBe(1);
  });

  it('names no version when the reference has none', () => {
    expect(
      ratingDropAt([snap(0, 4.3, 1200, '1.1.0'), snap(7, 4.5, 1200, null)], 0)
        ?.version,
    ).toBeNull();
  });

  it('compares with the last rated capture, skipping an unrated one', () => {
    expect(
      newRatingDrop([
        snap(0, 4.3),
        snap(0.5, null),
        snap(1, 4.3),
        snap(8, 4.5),
      ]),
    ).toBeNull();
  });

  it('reaches the reference of a previous capture ten days back', () => {
    expect(RATING_DROP_HISTORY_DAYS).toBe(20);
  });
});
