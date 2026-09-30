import {
  estimatePopularity,
  NEUTRAL_CONTINUATIONS,
  POPULARITY_FEATURES,
  POPULARITY_WEIGHTS,
  PopularityWeights,
  popularityFeatures,
  SuggestEvidence,
  UNLISTED_POPULARITY_WEIGHTS,
} from './popularity-model';
import { SuggestReach } from './suggest-reach';

const app = (title: string, ratingCount?: number) => ({ title, ratingCount });

const listed: SuggestReach = { status: 'listed', position: 1 };

const suggest = (
  continuations: number,
  reach: SuggestReach = listed,
): SuggestEvidence => ({ continuations, reach });

const zero = Object.fromEntries(
  ['intercept', ...POPULARITY_FEATURES].map((name) => [name, 0]),
) as PopularityWeights;

describe('popularityFeatures', () => {
  it('returns null for an empty page', () => {
    expect(popularityFeatures([], 'quiz', suggest(0))).toBeNull();
  });

  it('reads leader, depth and title shares from the page', () => {
    const page = [
      app('Geo Quiz', 99_999),
      app('Quiz Geo Master', 9),
      app('Maps', 999),
      app('Geo Quiz Pro'),
    ];
    const features = popularityFeatures(page, 'geo quiz', suggest(9));
    const expected = {
      leader: 5,
      depth: 3,
      titled: 0.75,
      exact: 0.5,
      exactLeader: 5,
      words: 1,
      results: 4 / 25,
      continuations: 1,
    };
    Object.entries(expected).forEach(([name, value]) => {
      expect(features?.[name as keyof typeof expected]).toBeCloseTo(value, 9);
    });
    expect(features?.suggested).toBe(1);
    expect(features?.early).toBe(0);
    expect(features?.relevance).toBeGreaterThan(0.5);
    expect(features?.weightedLeader).toBeCloseTo(
      5 * (features?.relevance ?? 0),
      9,
    );
  });

  it('only counts exact matches in the top five as the exact leader', () => {
    const page = [
      ...Array.from({ length: 5 }, (_, index) => app(`Other ${index}`, 10)),
      app('Trivia', 1_000_000),
    ];
    expect(popularityFeatures(page, 'trivia', suggest(0))?.exactLeader).toBe(0);
  });

  it('stays finite when a rating count is negative or missing', () => {
    const features = popularityFeatures(
      [app('Quiz', -5), app('Quiz'), app('Quiz', Number.NaN)],
      'quiz',
      suggest(-3),
    );
    Object.values(features ?? {}).forEach((value) => {
      expect(Number.isFinite(value)).toBe(true);
    });
    expect(features?.depth).toBe(0);
  });

  it('counts a keyword without words as one word', () => {
    expect(
      popularityFeatures([app('Quiz', 10)], ' !? ', suggest(0))?.words,
    ).toBe(0);
  });

  it('reads at most 25 results and caps the word count', () => {
    const page = Array.from({ length: 40 }, () => app('Word', 1));
    const features = popularityFeatures(page, 'a b c d e f g h', suggest(0));
    expect(features?.results).toBe(1);
    expect(features?.words).toBe(5);
  });

  it.each([
    [{ status: 'hit', prefixLength: 1, position: 3 }, 1, 1],
    [{ status: 'hit', prefixLength: 8, position: 1 }, 1, 1 / 8],
    [{ status: 'listed', position: 1 }, 1, 0],
    [{ status: 'unavailable' }, 1, 0],
    [{ status: 'absent' }, 0, 0],
  ] as Array<[SuggestReach, number, number]>)(
    'reads %j as suggested %s and early %s',
    (reach, suggested, early) => {
      const features = popularityFeatures([app('Quiz', 10)], 'quiz', {
        continuations: 0,
        reach,
      });
      expect(features?.suggested).toBe(suggested);
      expect(features?.early).toBeCloseTo(early, 9);
    },
  );
});

describe('estimatePopularity', () => {
  it('returns null without results', () => {
    expect(estimatePopularity([], 'quiz', suggest(0))).toBeNull();
  });

  it('predicts on a log scale and keeps the estimate between 1 and 100', () => {
    const page = [app('Quiz', 1_000)];
    expect(
      estimatePopularity(page, 'quiz', suggest(0), { ...zero, intercept: -20 }),
    ).toBe(1);
    expect(
      estimatePopularity(page, 'quiz', suggest(0), { ...zero, intercept: 250 }),
    ).toBe(100);
    expect(
      estimatePopularity(page, 'quiz', suggest(0), {
        ...zero,
        intercept: 1,
        leader: 0.5,
      }),
    ).toBe(Math.round(Math.expm1(1 + 0.5 * Math.log10(1_001))));
  });

  it('ranks a crowded head term above a long tail phrase', () => {
    const head = Array.from({ length: 25 }, (_, index) =>
      app(`Quiz ${index}`, 200_000 - index * 5_000),
    );
    const tail = Array.from({ length: 25 }, (_, index) =>
      app(index < 2 ? 'Guess The Old Town Map' : `Puzzle ${index}`, 40),
    );
    expect(
      estimatePopularity(head, 'quiz', suggest(NEUTRAL_CONTINUATIONS)),
    ).toBeGreaterThan(
      estimatePopularity(
        tail,
        'guess the old town map',
        suggest(NEUTRAL_CONTINUATIONS),
      ) ?? 100,
    );
  });

  it('ranks a phrase the store continues often above one it never continues', () => {
    const page = Array.from({ length: 25 }, (_, index) =>
      app(`Map Quiz ${index}`, 5_000),
    );
    expect(estimatePopularity(page, 'map quiz', suggest(9))).toBeGreaterThan(
      estimatePopularity(page, 'map quiz', suggest(0)) ?? 100,
    );
  });

  it('ranks a phrase suggested after few typed characters above one never suggested', () => {
    const page = Array.from({ length: 25 }, (_, index) =>
      app(`Map Quiz ${index}`, 5_000),
    );
    expect(
      estimatePopularity(
        page,
        'map quiz',
        suggest(5, { status: 'hit', prefixLength: 2, position: 1 }),
      ),
    ).toBeGreaterThan(
      estimatePopularity(page, 'map quiz', suggest(5, { status: 'absent' })) ??
        100,
    );
  });

  describe.each([
    ['every term', POPULARITY_WEIGHTS],
    ['terms Apple leaves out of its list', UNLISTED_POPULARITY_WEIGHTS],
  ])('with the weights for %s', (_name, weights) => {
    const page = Array.from({ length: 25 }, (_, index) =>
      app(`Map Quiz ${index}`, 5_000),
    );
    const early: SuggestReach = { status: 'hit', prefixLength: 2, position: 1 };

    it('carries a finite weight for every feature', () => {
      expect(Object.keys(weights).sort()).toEqual(
        ['intercept', ...POPULARITY_FEATURES].sort(),
      );
      Object.values(weights).forEach((weight) => {
        expect(Number.isFinite(weight)).toBe(true);
      });
    });

    it('rises with continuations and with an earlier suggestion', () => {
      const silent = estimatePopularity(
        page,
        'map quiz',
        suggest(0, { status: 'absent' }),
        weights,
      );
      expect(
        estimatePopularity(page, 'map quiz', suggest(9, early), weights),
      ).toBeGreaterThan(silent ?? 100);
    });
  });
});
