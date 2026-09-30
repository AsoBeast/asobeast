import {
  computeDifficulty,
  entryDifficulty,
  pageStrength,
  ratingStrength,
  targetingShare,
} from './difficulty';
import { KeywordStats, SerpApp } from './formulas';
import * as fixtures from './scoring-fixtures';

const rated = (ratingCount: number, title = 'App'): SerpApp => ({
  title,
  ratingCount,
});

const page = (
  keywordText: string,
  top10: SerpApp[],
  store: KeywordStats['store'] = 'APP_STORE',
): KeywordStats => ({
  ...fixtures.F1_HEAD,
  store,
  keywordText,
  top10,
});

const tenOf = (ratingCount: number, title: string): SerpApp[] =>
  Array.from({ length: 10 }, () => rated(ratingCount, title));

describe('ratingStrength', () => {
  it.each([
    [0, 0],
    [1_000, 0],
    [31_623, 0.5],
    [1_000_000, 1],
    [50_000_000, 1],
  ])('rates %d ratings at %d', (ratings, expected) => {
    expect(ratingStrength(ratings)).toBeCloseTo(expected, 3);
  });
});

describe('pageStrength', () => {
  it('averages the apps whose rating count is known', () => {
    expect(
      pageStrength([rated(1_000_000), rated(1_000), rated(Number.NaN)]),
    ).toBeCloseTo(0.5, 5);
    expect(pageStrength([{ title: 'App' }])).toBe(0);
  });
});

describe('targetingShare', () => {
  it('counts the titles that carry the phrase as written', () => {
    const apps = [
      rated(1, 'Geometry Dash'),
      rated(1, 'GeoGuessr'),
      rated(1, 'World Map Quiz'),
      rated(1, 'Big Geo'),
    ];
    expect(targetingShare(apps, 'geo')).toBe(0.75);
    expect(targetingShare(apps, 'quiz map')).toBe(0);
  });
});

describe('computeDifficulty', () => {
  it('adds the strength of the top ten to the share of titles targeting the phrase', () => {
    expect(computeDifficulty(fixtures.F1_HEAD)).toBe(6);
  });

  it('rates a page that targets the phrase above the same page that does not', () => {
    const targeted = computeDifficulty(page('quiz', tenOf(50_000, 'Quiz')));
    const untargeted = computeDifficulty(page('quiz', tenOf(50_000, 'Trivia')));
    expect(targeted - untargeted).toBeCloseTo(2.6, 5);
  });

  it('weighs strength more and targeting less on Google Play', () => {
    const giants = tenOf(5_000_000, 'Roblox');
    expect(computeDifficulty(page('game', giants, 'GOOGLE_PLAY'))).toBe(9);
    expect(computeDifficulty(page('game', giants))).toBe(5.3);
  });

  it('discounts longer phrases on Google Play only', () => {
    const apps = tenOf(50_000, 'Trivia');
    const short = page('quiz', apps, 'GOOGLE_PLAY');
    const long = page('quiz games for adults', apps, 'GOOGLE_PLAY');
    expect(computeDifficulty(short) - computeDifficulty(long)).toBeCloseTo(
      1.2,
      5,
    );
    expect(computeDifficulty(page('quiz', apps))).toBe(
      computeDifficulty(page('quiz games for adults', apps)),
    );
  });

  it('keeps a page with results at the lowest step or above', () => {
    const phrase = 'a very long phrase nobody searches for on google play';
    expect(
      computeDifficulty(page(phrase, [rated(3, 'Other')], 'GOOGLE_PLAY')),
    ).toBe(0.1);
  });

  it('scores an empty page at zero', () => {
    expect(computeDifficulty(fixtures.F4_EMPTY)).toBe(0);
  });

  it('skips a rating count that is not finite', () => {
    expect(computeDifficulty(fixtures.F12_NOT_FINITE)).toBeLessThanOrEqual(
      computeDifficulty(fixtures.F1_HEAD),
    );
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
