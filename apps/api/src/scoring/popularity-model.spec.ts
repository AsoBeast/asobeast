import {
  estimatePopularity,
  POPULARITY_FEATURES,
  PopularityWeights,
  popularityFeatures,
} from './popularity-model';

const app = (title: string, ratingCount?: number) => ({ title, ratingCount });

const zero = Object.fromEntries(
  ['intercept', ...POPULARITY_FEATURES].map((name) => [name, 0]),
) as PopularityWeights;

describe('popularityFeatures', () => {
  it('returns null for an empty page', () => {
    expect(popularityFeatures([], 'quiz')).toBeNull();
  });

  it('reads leader, depth and title shares from the page', () => {
    const page = [
      app('Geo Quiz', 99_999),
      app('Quiz Geo Master', 9),
      app('Maps', 999),
      app('Geo Quiz Pro'),
    ];
    const features = popularityFeatures(page, 'geo quiz');
    const expected = {
      leader: 5,
      depth: 3,
      titled: 0.75,
      exact: 0.5,
      exactLeader: 5,
      words: 1,
      results: 4 / 25,
    };
    Object.entries(expected).forEach(([name, value]) => {
      expect(features?.[name as keyof typeof expected]).toBeCloseTo(value, 9);
    });
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
    expect(popularityFeatures(page, 'trivia')?.exactLeader).toBe(0);
  });

  it('stays finite when a rating count is negative or missing', () => {
    const features = popularityFeatures(
      [app('Quiz', -5), app('Quiz'), app('Quiz', Number.NaN)],
      'quiz',
    );
    Object.values(features ?? {}).forEach((value) => {
      expect(Number.isFinite(value)).toBe(true);
    });
    expect(features?.depth).toBe(0);
  });

  it('counts a keyword without words as one word', () => {
    expect(popularityFeatures([app('Quiz', 10)], ' !? ')?.words).toBe(0);
  });

  it('reads at most 25 results and caps the word count', () => {
    const page = Array.from({ length: 40 }, () => app('Word', 1));
    const features = popularityFeatures(page, 'a b c d e f g h');
    expect(features?.results).toBe(1);
    expect(features?.words).toBe(5);
  });
});

describe('estimatePopularity', () => {
  it('returns null without results', () => {
    expect(estimatePopularity([], 'quiz')).toBeNull();
  });

  it('keeps the estimate on the 1 to 100 scale', () => {
    const page = [app('Quiz', 1_000)];
    expect(estimatePopularity(page, 'quiz', { ...zero, intercept: -20 })).toBe(
      1,
    );
    expect(estimatePopularity(page, 'quiz', { ...zero, intercept: 250 })).toBe(
      100,
    );
    expect(
      estimatePopularity(page, 'quiz', { ...zero, intercept: 10, leader: 2 }),
    ).toBe(Math.round(10 + 2 * Math.log10(1_001)));
  });

  it('ranks a crowded head term above a long tail phrase', () => {
    const head = Array.from({ length: 25 }, (_, index) =>
      app(`Quiz ${index}`, 200_000 - index * 5_000),
    );
    const tail = Array.from({ length: 25 }, (_, index) =>
      app(index < 2 ? 'Guess The Old Town Map' : `Puzzle ${index}`, 40),
    );
    expect(estimatePopularity(head, 'quiz')).toBeGreaterThan(
      estimatePopularity(tail, 'guess the old town map') ?? 100,
    );
  });
});
