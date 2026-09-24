import { KeywordStats } from './formulas';

type FixtureApp = KeywordStats['top10'][number];

const app = (title: string, ratingCount: number): FixtureApp => ({
  title,
  ratingCount,
});

export const HEAD_RATING_COUNTS = [
  748_153, 4_516, 222_602, 20_357, 90_000, 15_000, 30_000, 5_000, 120_000,
  60_000,
];

export const headTopTen = (): FixtureApp[] =>
  HEAD_RATING_COUNTS.map((count, index) => app(`Quiz ${index}`, count));

export const brandTopTen = (): FixtureApp[] => [
  app('GeoGuessr', 31_751),
  ...Array.from({ length: 9 }, (_, index) => app(`Map game ${index}`, 800)),
];

export const junkTopTen = (): FixtureApp[] =>
  Array.from({ length: 10 }, () => app('YouTube', 30_000_000));

export const tailTopTen = (): FixtureApp[] =>
  [1_200, 300, 50, 20, 900, 10, 5, 0, 40, 700].map((count, index) =>
    app(index < 4 ? `Guess the Location ${index}` : `Map game ${index}`, count),
  );

export const outlierTopTen = (): FixtureApp[] =>
  [20_000_000, 5, 5, 5, 5, 5, 5, 5, 5, 5].map((count, index) =>
    app(`Geo Quiz ${index}`, count),
  );

export const F1_HEAD: KeywordStats = {
  store: 'APP_STORE',
  keywordText: 'quiz',
  resultCount: 30,
  suggest: { status: 'hit', prefixLength: 4, position: 6 },
  top10: headTopTen(),
};

export const F2_BRAND: KeywordStats = {
  store: 'APP_STORE',
  keywordText: 'geoguessr',
  resultCount: 30,
  suggest: { status: 'hit', prefixLength: 4, position: 4 },
  top10: brandTopTen(),
};

export const F3_JUNK: KeywordStats = {
  store: 'GOOGLE_PLAY',
  keywordText: 'videos put',
  resultCount: 30,
  suggest: { status: 'absent' },
  top10: junkTopTen(),
};

export const F4_EMPTY: KeywordStats = {
  store: 'APP_STORE',
  keywordText: 'kw3006',
  resultCount: 0,
  suggest: { status: 'absent' },
  top10: [],
};

export const F5_TAIL: KeywordStats = {
  store: 'APP_STORE',
  keywordText: 'guess the location',
  resultCount: 30,
  suggest: { status: 'listed', position: 1 },
  top10: tailTopTen(),
};

export const F6_OUTLIER: KeywordStats = {
  store: 'APP_STORE',
  keywordText: 'geo quiz',
  resultCount: 30,
  suggest: { status: 'hit', prefixLength: 3, position: 2 },
  top10: outlierTopTen(),
};

export const F7_SINGLE: KeywordStats = {
  store: 'APP_STORE',
  keywordText: 'geo quiz',
  resultCount: 1,
  suggest: { status: 'hit', prefixLength: 6, position: 1 },
  top10: [app('Geo Quiz', 1_000_000)],
};

export const F8_UNAVAILABLE: KeywordStats = {
  ...F1_HEAD,
  suggest: { status: 'unavailable' },
};

export const F9_OFFICIAL: KeywordStats = {
  ...F1_HEAD,
  official: { value: 71 },
};

export const F10_ABSENT_CAP: KeywordStats = {
  ...F1_HEAD,
  official: { absentBelow: 41 },
};

export const F12_NOT_FINITE: KeywordStats = {
  ...F1_HEAD,
  top10: headTopTen().map((item, index) =>
    index === 0 ? { ...item, ratingCount: Number.NaN } : item,
  ),
};

export const F13_DIACRITICS: KeywordStats = {
  ...F7_SINGLE,
  keywordText: 'Géo  Quiz',
  resultCount: 30,
};
