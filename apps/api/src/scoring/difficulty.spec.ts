import {
  ageScore,
  computeDifficulty,
  diversityScore,
  dominanceScore,
  entryDifficulty,
  isBrandKeyword,
  qualityScore,
  ratingVolumeScore,
  velocityScore,
} from './difficulty';
import { KeywordStats, SerpApp } from './formulas';
import * as fixtures from './scoring-fixtures';

const DAYS_PER_YEAR = 365.25;

const rated = (ratingCount: number, extra: Partial<SerpApp> = {}): SerpApp => ({
  title: 'App',
  ratingCount,
  ...extra,
});

const page = (keywordText: string, top10: SerpApp[]): KeywordStats => ({
  ...fixtures.F1_HEAD,
  keywordText,
  top10,
});

const backfilled = (leader: SerpApp, targeting: number): SerpApp[] => [
  leader,
  ...Array.from({ length: 9 }, (_, index) =>
    rated(500_000, {
      title: index < targeting - 1 ? `Lan Invoice ${index}` : 'Invoice Maker',
    }),
  ),
];

describe('difficulty sub scores', () => {
  it.each([
    [0, 0],
    [25, 2.5],
    [2_000, 50],
    [10_000, 78],
    [100_000, 100],
  ])('rates a median of %d ratings at %d', (count, expected) => {
    expect(ratingVolumeScore([rated(count)])).toBeCloseTo(expected, 5);
  });

  it('measures velocity as ratings per year of age', () => {
    const yearly = (ratings: number, years: number) =>
      velocityScore([
        rated(ratings, { daysSinceRelease: years * DAYS_PER_YEAR }),
      ]);
    expect(yearly(1_000, 1)).toBeCloseTo(50, 5);
    expect(yearly(10_000, 2)).toBeCloseTo(70, 5);
    expect(yearly(500, 0.1)).toBeCloseTo(50, 5);
    expect(velocityScore([rated(1_000)])).toBe(50);
  });

  it('rates the mean age of the dated apps', () => {
    const aged = (years: number) =>
      rated(10, { daysSinceRelease: years * DAYS_PER_YEAR });
    expect(ageScore([aged(2), aged(4), rated(10)])).toBeCloseTo(50, 5);
    expect(ageScore([aged(12)])).toBe(100);
    expect(ageScore([rated(10)])).toBe(50);
  });

  it('weights star ratings by the log of the rating count', () => {
    expect(qualityScore([rated(100, { ratingAvg: 4.5 })])).toBeCloseTo(85, 5);
    expect(
      qualityScore([
        rated(100_000, { ratingAvg: 4 }),
        rated(1, { ratingAvg: 5 }),
      ]),
    ).toBeLessThan(55);
    expect(qualityScore([rated(0, { ratingAvg: 5 })])).toBe(0);
  });

  it('counts the top half of the page twice for dominance', () => {
    expect(dominanceScore([rated(10_000_000)])).toBe(100);
    expect(dominanceScore([rated(10_000_000), rated(0)])).toBeCloseTo(
      (2 / 3) * 100,
      5,
    );
  });

  it('rates publisher diversity as the share of distinct names', () => {
    expect(
      diversityScore([
        rated(1, { developer: 'Acme' }),
        rated(1, { developer: 'ACME' }),
        rated(1, { developer: 'Other' }),
        rated(1),
      ]),
    ).toBe(50);
  });
});

describe('computeDifficulty', () => {
  it('weights the seven sub scores and truncates the total', () => {
    expect(computeDifficulty(fixtures.F1_HEAD)).toBe(6);
  });

  it('prefers the wider competitor window over the top ten', () => {
    const wide = {
      ...fixtures.F1_HEAD,
      competitors: Array.from({ length: 25 }, () =>
        rated(100, { title: 'Quiz' }),
      ),
    };
    expect(computeDifficulty(wide)).toBeLessThan(
      computeDifficulty(fixtures.F1_HEAD),
    );
  });

  it('scores an empty page at zero', () => {
    expect(computeDifficulty(fixtures.F4_EMPTY)).toBe(0);
  });

  it('skips a rating count that is not finite', () => {
    expect(computeDifficulty(fixtures.F12_NOT_FINITE)).toBeLessThanOrEqual(
      computeDifficulty(fixtures.F1_HEAD),
    );
  });

  it('does not read a top app without a rating count as a weak leader', () => {
    const apps = Array.from({ length: 10 }, (_, index) =>
      rated(500_000, { title: `Photo Editor ${index}`, ratingAvg: 4.6 }),
    );
    const unknownLeader = [
      { ...apps[0], ratingCount: undefined },
      ...apps.slice(1),
    ];
    expect(computeDifficulty(page('photo editor', unknownLeader))).toBeCloseTo(
      computeDifficulty(page('photo editor', apps)),
      0,
    );
  });

  it.each([
    [1, 1],
    [2, 2],
    [3, 3.1],
    [4, 4],
  ])('caps a page of %d apps at %d', (size, cap) => {
    const apps = Array.from({ length: size }, () =>
      rated(5_000_000, { title: 'Geo Quiz', ratingAvg: 4.8 }),
    );
    expect(computeDifficulty(page('geo quiz', apps))).toBe(cap);
  });

  it('does not raise a brand page to a floor', () => {
    const difficulty = computeDifficulty(fixtures.F2_BRAND);
    expect(difficulty).toBeGreaterThan(2);
    expect(difficulty).toBeLessThan(5);
  });
});

describe('weak leader corrections', () => {
  it('caps a backfilled page by its leader and discounts it', () => {
    const apps = backfilled(rated(0, { title: 'Lan Invoice' }), 1);
    expect(computeDifficulty(page('lan invoice', apps))).toBe(1.2);
  });

  it('softens the cap by the share of titles that target the phrase', () => {
    const half = backfilled(rated(100, { title: 'Lan Invoice' }), 5);
    const all = backfilled(rated(100, { title: 'Lan Invoice' }), 10);
    const uncapped = backfilled(rated(1_000, { title: 'Lan Invoice' }), 5);
    const halfScore = computeDifficulty(page('lan invoice', half));
    expect(halfScore).toBeGreaterThan(3.8);
    expect(halfScore).toBeLessThan(
      computeDifficulty(page('lan invoice', uncapped)),
    );
    expect(computeDifficulty(page('lan invoice', all))).toBeGreaterThan(
      halfScore,
    );
  });

  it('leaves a brand page uncapped', () => {
    const leader = rated(200, { title: 'Nasdaq', developer: 'Nasdaq, Inc.' });
    const branded = backfilled(leader, 1);
    const unbranded = backfilled({ ...leader, developer: 'Someone' }, 1);
    expect(computeDifficulty(page('nasdaq', branded))).toBeGreaterThan(
      computeDifficulty(page('nasdaq', unbranded)),
    );
  });
});

describe('isBrandKeyword', () => {
  const rivals = (count: number): SerpApp[] =>
    Array.from({ length: 4 }, (_, index) =>
      rated(count, { developer: `Rival ${index}` }),
    );

  it.each([
    {
      name: 'a strong leader',
      keyword: 'spotify',
      leader: rated(5_000, { developer: 'Spotify AB' }),
      rivalRatings: 10,
      expected: true,
    },
    {
      name: 'a weak leader before major apps',
      keyword: 'nasdaq',
      leader: rated(200, { developer: 'Nasdaq, Inc.' }),
      rivalRatings: 50_000,
      expected: true,
    },
    {
      name: 'a weak leader before small apps',
      keyword: 'nasdaq',
      leader: rated(200, { developer: 'Nasdaq, Inc.' }),
      rivalRatings: 900,
      expected: false,
    },
    {
      name: 'another publisher',
      keyword: 'stocks',
      leader: rated(5_000_000, { developer: 'Apple Inc.' }),
      rivalRatings: 50_000,
      expected: false,
    },
  ])('$name', ({ keyword, leader, rivalRatings, expected }) => {
    expect(isBrandKeyword([leader, ...rivals(rivalRatings)], keyword)).toBe(
      expected,
    );
  });

  it('ignores the rest of the publisher portfolio', () => {
    const apps = [
      rated(200, { developer: 'Nasdaq, Inc.' }),
      rated(90_000, { developer: 'Nasdaq, Inc.' }),
    ];
    expect(isBrandKeyword(apps, 'nasdaq')).toBe(false);
  });
});

describe('entryDifficulty', () => {
  it('rates a brand page without its leader', () => {
    const entry = entryDifficulty(fixtures.F2_BRAND);
    expect(entry).not.toBeNull();
    expect(entry).toBeLessThan(computeDifficulty(fixtures.F2_BRAND));
    expect(entryDifficulty(fixtures.F1_HEAD)).toBeNull();
  });
});
