import { CompetitorDiscoveryItem } from '@asobeast/shared';
import { SearchItem } from '../store-providers/types';
import { mergeSuggestions } from './competitor-suggestions';

const serp = (
  storeAppId: string,
  appearances = 1,
  bestPosition = 5,
): CompetitorDiscoveryItem => ({
  storeAppId,
  title: `Serp ${storeAppId}`,
  developer: 'Ranked Co',
  ratingAvg: 4.1,
  ratingCount: 10,
  appearances,
  keywordCount: 1,
  bestPosition,
  avgPosition: bestPosition,
  keywords: ['focus'],
});

const similar = (storeAppId: string, extra: Partial<SearchItem> = {}) => ({
  storeAppId,
  title: `Similar ${storeAppId}`,
  ...extra,
});

describe('mergeSuggestions', () => {
  it('lists the serp apps first in their order, then the similar apps in store order', () => {
    const merged = mergeSuggestions(
      [serp('s1', 3), serp('s2', 1)],
      [similar('m1'), similar('m2')],
      new Set(),
    );

    expect(merged.map((item) => item.storeAppId)).toEqual([
      's1',
      's2',
      'm1',
      'm2',
    ]);
  });

  it('keeps the serp row of an app both sources name', () => {
    const merged = mergeSuggestions(
      [serp('both', 2, 4)],
      [similar('both', { iconUrl: 'https://icon/both.jpg' })],
      new Set(),
    );

    expect(merged).toEqual([
      expect.objectContaining({ storeAppId: 'both', source: 'serp' }),
    ]);
  });

  it('never names an excluded app', () => {
    const merged = mergeSuggestions(
      [serp('self'), serp('s1')],
      [similar('rival'), similar('m1')],
      new Set(['self', 'rival']),
    );

    expect(merged.map((item) => item.storeAppId)).toEqual(['s1', 'm1']);
  });

  it('names a similar app once when the store repeats it', () => {
    const merged = mergeSuggestions(
      [],
      [similar('m1'), similar('m1')],
      new Set(),
    );

    expect(merged).toHaveLength(1);
  });

  it('stops at the limit', () => {
    const merged = mergeSuggestions(
      Array.from({ length: 8 }, (_, index) => serp(`s${index}`)),
      Array.from({ length: 8 }, (_, index) => similar(`m${index}`)),
      new Set(),
    );

    expect(merged).toHaveLength(10);
    expect(merged.at(-1)?.storeAppId).toBe('m1');
  });

  it('maps a serp row with its evidence and no icon', () => {
    expect(mergeSuggestions([serp('s1', 2, 3)], [], new Set())).toEqual([
      {
        storeAppId: 's1',
        title: 'Serp s1',
        developer: 'Ranked Co',
        iconUrl: null,
        source: 'serp',
        appearances: 2,
        bestPosition: 3,
      },
    ]);
  });

  it('maps a similar row with its icon and no evidence', () => {
    expect(
      mergeSuggestions(
        [],
        [
          similar('m1', { developer: 'Dev', iconUrl: 'https://icon/m1.jpg' }),
          similar('m2'),
        ],
        new Set(),
      ),
    ).toEqual([
      {
        storeAppId: 'm1',
        title: 'Similar m1',
        developer: 'Dev',
        iconUrl: 'https://icon/m1.jpg',
        source: 'similar',
        appearances: null,
        bestPosition: null,
      },
      {
        storeAppId: 'm2',
        title: 'Similar m2',
        developer: null,
        iconUrl: null,
        source: 'similar',
        appearances: null,
        bestPosition: null,
      },
    ]);
  });
});
