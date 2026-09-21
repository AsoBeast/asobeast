import { KeywordStats } from './formulas';

export interface FixtureApp {
  storeAppId?: string;
  title: string;
  developer?: string;
  ratingCount?: number;
  daysSinceUpdate?: number;
}

export type FixtureReach =
  | { status: 'hit'; prefixLength: number; position: number }
  | { status: 'listed'; position: number }
  | { status: 'absent' }
  | { status: 'unavailable' };

export interface ScoringFixture extends Omit<
  KeywordStats,
  'top10' | 'suggest'
> {
  resultCount: number;
  top10: FixtureApp[];
  suggest: FixtureReach;
  previousTop10?: Array<{ storeAppId: string; ratingCount: number }>;
  previousCapturedDaysAgo?: number;
  official?: { value: number } | { absentBelow: number };
}

const app = (
  title: string,
  ratingCount: number,
  daysSinceUpdate: number,
): FixtureApp => ({
  title,
  ratingCount,
  daysSinceUpdate,
});

export const HEAD_RATING_COUNTS = [
  748_153, 4_516, 222_602, 20_357, 90_000, 15_000, 30_000, 5_000, 120_000,
  60_000,
];

export const headTopTen = (): FixtureApp[] =>
  HEAD_RATING_COUNTS.map((count, index) => app(`Quiz ${index}`, count, 10));

export const brandTopTen = (): FixtureApp[] => [
  app('GeoGuessr', 31_751, 9),
  ...Array.from({ length: 9 }, (_, index) => app(`Map game ${index}`, 800, 60)),
];

export const junkTopTen = (): FixtureApp[] =>
  Array.from({ length: 10 }, () => app('YouTube', 30_000_000, 2));

export const tailTopTen = (): FixtureApp[] =>
  [1_200, 300, 50, 20, 900, 10, 5, 0, 40, 700].map((count, index) =>
    app(
      index < 4 ? `Guess the Location ${index}` : `Map game ${index}`,
      count,
      200,
    ),
  );

export const outlierTopTen = (): FixtureApp[] =>
  [20_000_000, 5, 5, 5, 5, 5, 5, 5, 5, 5].map((count, index) =>
    app(`Geo Quiz ${index}`, count, 30),
  );

export const headStats = (): ScoringFixture => ({
  store: 'APP_STORE',
  keywordText: 'quiz',
  resultCount: 30,
  top30TitleMatchCount: 24,
  suggest: { status: 'hit', prefixLength: 4, position: 6 },
  top10: headTopTen(),
});

export const brandStats = (): ScoringFixture => ({
  store: 'APP_STORE',
  keywordText: 'geoguessr',
  resultCount: 30,
  top30TitleMatchCount: 1,
  suggest: { status: 'hit', prefixLength: 4, position: 4 },
  top10: brandTopTen(),
});

export const junkStats = (): ScoringFixture => ({
  store: 'GOOGLE_PLAY',
  keywordText: 'videos put',
  resultCount: 30,
  top30TitleMatchCount: 0,
  suggest: { status: 'absent' },
  top10: junkTopTen(),
});

export const emptyStats = (): ScoringFixture => ({
  store: 'APP_STORE',
  keywordText: 'kw3006',
  resultCount: 0,
  top30TitleMatchCount: 0,
  suggest: { status: 'absent' },
  top10: [],
});

export const tailStats = (): ScoringFixture => ({
  store: 'APP_STORE',
  keywordText: 'guess the location',
  resultCount: 30,
  top30TitleMatchCount: 4,
  suggest: { status: 'listed', position: 1 },
  top10: tailTopTen(),
});

export const outlierStats = (): ScoringFixture => ({
  store: 'APP_STORE',
  keywordText: 'geo quiz',
  resultCount: 30,
  top30TitleMatchCount: 10,
  suggest: { status: 'hit', prefixLength: 3, position: 2 },
  top10: outlierTopTen(),
});

export const singleStats = (): ScoringFixture => ({
  store: 'APP_STORE',
  keywordText: 'geo quiz',
  resultCount: 1,
  top30TitleMatchCount: 1,
  suggest: { status: 'hit', prefixLength: 6, position: 1 },
  top10: [app('Geo Quiz', 1_000_000, 1)],
});

export const unavailableStats = (): ScoringFixture => ({
  ...headStats(),
  suggest: { status: 'unavailable' },
});

export const officialStats = (): ScoringFixture => ({
  ...headStats(),
  official: { value: 71 },
});

export const absentCapStats = (): ScoringFixture => ({
  ...headStats(),
  official: { absentBelow: 41 },
});

export const velocityStats = (): ScoringFixture => ({
  ...headStats(),
  top10: headTopTen().map((item, index) => ({
    ...item,
    storeAppId: `id${index}`,
  })),
  previousCapturedDaysAgo: 28,
  previousTop10: HEAD_RATING_COUNTS.map((count, index) => ({
    storeAppId: `id${index}`,
    ratingCount: Math.round(count * 0.98),
  })),
});

export const notFiniteStats = (): ScoringFixture => ({
  ...headStats(),
  top10: headTopTen().map((item, index) =>
    index === 0 ? { ...item, ratingCount: Number.NaN } : item,
  ),
});

export const diacriticsStats = (): ScoringFixture => ({
  ...singleStats(),
  keywordText: 'Géo  Quiz',
  resultCount: 30,
});
