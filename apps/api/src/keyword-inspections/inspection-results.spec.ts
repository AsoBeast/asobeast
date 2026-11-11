import { KeywordInspectionResult } from '@asobeast/shared';
import {
  summarizeCompetition,
  toInspectionResults,
  toInspectionSuggestions,
} from './inspection-results';

const NOW = new Date('2026-11-05T12:00:00.000Z');

function result(
  overrides: Partial<KeywordInspectionResult>,
): KeywordInspectionResult {
  return {
    position: 1,
    storeAppId: 'app',
    title: 'App',
    developer: null,
    iconUrl: null,
    ratingAvg: null,
    ratingCount: null,
    releasedAt: null,
    updatedAt: null,
    titleMatch: 'none',
    titleSegments: [],
    ...overrides,
  };
}

describe('toInspectionResults', () => {
  it('numbers the results from 1, keeps the top 50 and maps missing fields to null', () => {
    const items = Array.from({ length: 60 }, (_, index) => ({
      storeAppId: `id${index}`,
      title: index === 0 ? 'Habit Tracker' : `App ${index}`,
      ...(index === 0
        ? {
            developer: 'Dev',
            ratingAvg: 4.5,
            ratingCount: 1200,
            updatedAt: new Date('2026-10-01T00:00:00.000Z'),
          }
        : {}),
    }));

    const results = toInspectionResults(items, 'habit tracker');

    expect(results).toHaveLength(50);
    expect(results[0]).toEqual({
      position: 1,
      storeAppId: 'id0',
      title: 'Habit Tracker',
      developer: 'Dev',
      iconUrl: null,
      ratingAvg: 4.5,
      ratingCount: 1200,
      releasedAt: null,
      updatedAt: '2026-10-01T00:00:00.000Z',
      titleMatch: 'phrase',
      titleSegments: [
        { text: 'Habit', match: 'exact' },
        { text: ' ', match: 'none' },
        { text: 'Tracker', match: 'exact' },
      ],
    });
    expect(results[49].position).toBe(50);
    expect(results[1].developer).toBeNull();
  });

  it('grades each title with the rankings title judge', () => {
    const titles = [
      'Habit Tracker: Daily Goals',
      'Tracker for every habit',
      'Daily habit',
      'Calendar',
    ];

    const results = toInspectionResults(
      titles.map((title, index) => ({ storeAppId: `id${index}`, title })),
      'habit tracker',
    );

    expect(results.map((result) => result.titleMatch)).toEqual([
      'phrase',
      'words',
      'partial',
      'none',
    ]);
  });
});

describe('toInspectionSuggestions', () => {
  it('drops blank and repeated terms, keeps the store order and stops at ten', () => {
    const terms = [
      'habit tracker',
      'Habit Tracker',
      '   ',
      ...Array.from({ length: 12 }, (_, index) => `habit ${index}`),
    ].map((term) => ({ term }));

    const suggestions = toInspectionSuggestions(terms);

    expect(suggestions).toHaveLength(10);
    expect(suggestions[0]).toEqual({ position: 1, term: 'habit tracker' });
    expect(suggestions[1]).toEqual({ position: 2, term: 'habit 0' });
    expect(suggestions[9].position).toBe(10);
  });
});

describe('summarizeCompetition', () => {
  it('answers null when the store returned nothing', () => {
    expect(summarizeCompetition([], NOW)).toBeNull();
  });

  it('summarizes the top ten and ignores the results below them', () => {
    const top = [
      result({
        ratingCount: 250_000,
        ratingAvg: 4.8,
        titleMatch: 'phrase',
        updatedAt: '2026-11-01T00:00:00.000Z',
      }),
      result({
        ratingCount: 1_000,
        ratingAvg: 4.0,
        titleMatch: 'words',
        updatedAt: '2026-06-01T00:00:00.000Z',
      }),
      result({ ratingCount: 50, titleMatch: 'partial' }),
    ];
    const below = Array.from({ length: 10 }, () =>
      result({ ratingCount: 9_000_000, titleMatch: 'phrase' }),
    );

    expect(summarizeCompetition([...top, ...below], NOW)).toEqual({
      topCount: 10,
      medianRatingCount: 9_000_000,
      strongestRatingCount: 9_000_000,
      averageRating: 4.4,
      exactTitleMatches: 8,
      titleMatches: 9,
      appsOverHundredThousandRatings: 8,
      medianDaysSinceUpdate: 81,
      freshlyUpdated: 1,
    });
  });

  it('answers null figures when the results carry no ratings or dates', () => {
    expect(summarizeCompetition([result({})], NOW)).toEqual({
      topCount: 1,
      medianRatingCount: null,
      strongestRatingCount: null,
      averageRating: null,
      exactTitleMatches: 0,
      titleMatches: 0,
      appsOverHundredThousandRatings: 0,
      medianDaysSinceUpdate: null,
      freshlyUpdated: 0,
    });
  });
});
