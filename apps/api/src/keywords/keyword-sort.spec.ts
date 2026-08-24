import { TrackedKeywordItem } from '@asobeast/shared';
import { sortTracked } from './keyword-sort';

const item = (
  keywordId: string,
  overrides: Partial<TrackedKeywordItem>,
): TrackedKeywordItem =>
  ({
    keywordId,
    text: keywordId,
    country: 'us',
    source: 'MANUAL',
    active: true,
    relevance: null,
    latestPosition: null,
    traffic: null,
    difficulty: null,
    opportunity: null,
    serpVolatility7d: null,
    ...overrides,
  }) as TrackedKeywordItem;

describe('sortTracked', () => {
  it('keeps the incoming order when no sort is requested', () => {
    const items = [item('b', { traffic: 1 }), item('a', { traffic: 9 })];

    expect(sortTracked(items).map((row) => row.keywordId)).toEqual(['b', 'a']);
  });

  it('sorts scores descending and pushes nulls last', () => {
    const items = [
      item('none', {}),
      item('low', { traffic: 10 }),
      item('high', { traffic: 90 }),
    ];

    expect(sortTracked(items, 'traffic').map((row) => row.keywordId)).toEqual([
      'high',
      'low',
      'none',
    ]);
  });

  it('sorts position ascending with unranked keywords last', () => {
    const items = [
      item('unranked', {}),
      item('deep', { latestPosition: 40 }),
      item('top', { latestPosition: 2 }),
    ];

    expect(sortTracked(items, 'position').map((row) => row.keywordId)).toEqual([
      'top',
      'deep',
      'unranked',
    ]);
  });
});
