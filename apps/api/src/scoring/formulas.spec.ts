import {
  competitorsScore,
  computeDifficulty,
  computeOpportunity,
  computeTraffic,
  defaultRelevance,
  freshnessScore,
  gplaySuggestScore,
  installsScore,
  KeywordStats,
  lengthScore,
  strengthScore,
  suggestScore,
  titleMatchScore,
  toDifficulty100,
  toVolume,
} from './formulas';

const genericKeyword: KeywordStats = {
  store: 'APP_STORE',
  keywordText: 'games',
  top10: Array.from({ length: 10 }, (_, index) => ({
    title: `Best Games ${index}`,
    ratingCount: 1_000_000,
    ratingAvg: 4.8,
    daysSinceUpdate: 9,
  })),
  top30TitleMatchCount: 30,
  suggest: { priority: 9000 },
};

const longTailKeyword: KeywordStats = {
  store: 'APP_STORE',
  keywordText: 'offline pixel dungeon crawler',
  top10: Array.from({ length: 10 }, (_, index) => ({
    title: `Random App ${index}`,
    ratingCount: 50,
    ratingAvg: 3.2,
  })),
  top30TitleMatchCount: 0,
  suggest: {},
};

const midKeyword: KeywordStats = {
  store: 'APP_STORE',
  keywordText: 'puzzle game',
  top10: [
    'Puzzle Game Deluxe',
    'Ultimate Puzzle Game',
    'Game of Puzzle',
    'A Game and a Puzzle',
    'Puzzle Land Game',
    'Puzzle Quest',
    'Daily Puzzle',
    'Puzzle Mania',
    'Random App',
    'Another Thing',
  ].map((title) => ({
    title,
    ratingCount: 10_000,
    ratingAvg: 4.4,
    daysSinceUpdate: 45,
  })),
  top30TitleMatchCount: 12,
  suggest: { priority: 4000 },
};

describe('scoring formulas', () => {
  it('scores a huge generic keyword high on traffic and difficulty', () => {
    expect(titleMatchScore(genericKeyword)).toBeCloseTo(10, 2);
    expect(strengthScore(genericKeyword)).toBeCloseTo(9.3, 2);
    expect(competitorsScore(genericKeyword)).toBeCloseTo(10, 2);
    expect(freshnessScore(genericKeyword)).toBeCloseTo(9, 2);
    expect(suggestScore(genericKeyword)).toBeCloseTo(9, 2);
    expect(lengthScore(genericKeyword)).toBeCloseTo(10, 2);
    expect(computeDifficulty(genericKeyword)).toBeCloseTo(9.64, 2);
    expect(computeTraffic(genericKeyword)).toBeCloseTo(9.29, 2);
  });

  it('scores a niche long tail phrase low on traffic and difficulty', () => {
    expect(titleMatchScore(longTailKeyword)).toBeCloseTo(0, 2);
    expect(strengthScore(longTailKeyword)).toBeCloseTo(0, 2);
    expect(competitorsScore(longTailKeyword)).toBeCloseTo(0, 2);
    expect(freshnessScore(longTailKeyword)).toBeCloseTo(0, 2);
    expect(suggestScore(longTailKeyword)).toBeCloseTo(1, 2);
    expect(lengthScore(longTailKeyword)).toBeCloseTo(2, 2);
    expect(computeDifficulty(longTailKeyword)).toBeCloseTo(0, 2);
    expect(computeTraffic(longTailKeyword)).toBeCloseTo(0.9, 2);
  });

  it('scores an achievable mid keyword in the middle', () => {
    expect(titleMatchScore(midKeyword)).toBeCloseTo(5.3, 2);
    expect(strengthScore(midKeyword)).toBeCloseTo(4.65, 2);
    expect(competitorsScore(midKeyword)).toBeCloseTo(4, 2);
    expect(freshnessScore(midKeyword)).toBeCloseTo(5, 2);
    expect(suggestScore(midKeyword)).toBeCloseTo(4, 2);
    expect(lengthScore(midKeyword)).toBeCloseTo(8.22, 2);
    expect(computeDifficulty(midKeyword)).toBeCloseTo(4.8, 2);
    expect(computeTraffic(midKeyword)).toBeCloseTo(5.04, 2);
  });

  describe('google play path', () => {
    const playKeyword: KeywordStats = {
      store: 'GOOGLE_PLAY',
      keywordText: 'puzzle game',
      top10: Array.from({ length: 10 }, (_, index) => ({
        title: `Puzzle Game ${index}`,
        ratingCount: 10_000,
        ratingAvg: 4.4,
        daysSinceUpdate: 45,
        installs: 1_000_000,
      })),
      top30TitleMatchCount: 12,
      suggest: { prefixHitLength: 1 },
    };

    const withInstalls = (
      installs: Array<number | undefined>,
    ): KeywordStats => ({
      ...playKeyword,
      top10: installs.map((value) => ({
        title: 'Puzzle Game',
        ...(value === undefined ? {} : { installs: value }),
      })),
    });

    it('scores a full suggest hit at the first prefix character', () => {
      expect(gplaySuggestScore(playKeyword)).toBeCloseTo(10, 2);
    });

    it('decays the suggest score as the hitting prefix gets longer', () => {
      expect(
        gplaySuggestScore({ ...playKeyword, suggest: { prefixHitLength: 7 } }),
      ).toBeCloseTo(4.55, 2);
    });

    it('falls back to 1 when no prefix ever completes the term', () => {
      expect(
        gplaySuggestScore({
          ...playKeyword,
          suggest: { prefixHitLength: null },
        }),
      ).toBeCloseTo(1, 2);
    });

    it('scores installs on a 1k-to-1B log scale', () => {
      expect(installsScore(withInstalls([]))).toBeCloseTo(0, 2);
      expect(installsScore(withInstalls([1_000]))).toBeCloseTo(0, 2);
      expect(installsScore(withInstalls([1_000_000]))).toBeCloseTo(5, 2);
      expect(installsScore(withInstalls([1_000_000_000]))).toBeCloseTo(10, 2);
    });

    it('ignores top-10 entries with no installs figure', () => {
      expect(
        installsScore(withInstalls([1_000_000_000, undefined])),
      ).toBeCloseTo(10, 2);
    });

    it('composes play traffic from suggest, installs, strength and length', () => {
      expect(computeTraffic(playKeyword)).toBeCloseTo(7.61, 2);
    });

    it('composes play difficulty from the four enriched signals', () => {
      expect(computeDifficulty(playKeyword)).toBeCloseTo(6.45, 2);
    });
  });

  describe('scale bridging', () => {
    it('maps traffic to a 0-100 volume', () => {
      expect(toVolume(8)).toBeCloseTo(80, 2);
      expect(toVolume(12)).toBeCloseTo(100, 2);
    });

    it('maps difficulty to a 0-100 scale', () => {
      expect(toDifficulty100(4)).toBeCloseTo(40, 2);
      expect(toDifficulty100(11)).toBeCloseTo(100, 2);
    });
  });

  describe('defaultRelevance', () => {
    it('adds the overlap bonus when the keyword is fully in the snapshot', () => {
      expect(
        defaultRelevance('TITLE', 'habit tracker', 'daily habit tracker'),
      ).toBe(100);
    });

    it('subtracts the bonus when there is zero overlap', () => {
      expect(defaultRelevance('COMPETITOR', 'sudoku', 'habit tracker')).toBe(
        40,
      );
    });

    it('keeps the base for partial overlap', () => {
      expect(
        defaultRelevance('SUGGESTED', 'habit journal', 'habit tracker'),
      ).toBe(60);
    });
  });

  describe('computeOpportunity', () => {
    it('is null when volume or difficulty is missing', () => {
      expect(computeOpportunity(null, 40, 90)).toBeNull();
      expect(computeOpportunity(80, null, 90)).toBeNull();
    });

    it('applies the ported 0.4/0.3/0.3 weights', () => {
      expect(computeOpportunity(80, 40, 90)).toBeCloseTo(77, 1);
    });

    it('clamps to a maximum of 100', () => {
      expect(computeOpportunity(100, 0, 100)).toBeCloseTo(100, 1);
    });
  });

  it('falls back to partial suggest priority when no exact match', () => {
    const stats: KeywordStats = {
      store: 'APP_STORE',
      keywordText: 'race',
      top10: [],
      top30TitleMatchCount: 0,
      suggest: { partialPriority: 6000 },
    };
    expect(suggestScore(stats)).toBeCloseTo(3, 2);
  });
});
