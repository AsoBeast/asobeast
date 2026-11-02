import { SERP_DEPTH } from '@asobeast/shared';
import { TOP_TEN_ROWS, topTenOf } from './top-ten';

describe('top ten', () => {
  it('filters rows to the positions of the top 10', () => {
    expect(TOP_TEN_ROWS).toEqual({ position: { lte: 10 } });
    expect(TOP_TEN_ROWS.position.lte).toBe(SERP_DEPTH);
  });

  it('keeps the entries at positions 1 to 10 in order', () => {
    const entries = [1, 2, 10, 11, 50].map((position) => ({
      position,
      storeAppId: `app-${position}`,
    }));

    expect(topTenOf(entries)).toEqual([
      { position: 1, storeAppId: 'app-1' },
      { position: 2, storeAppId: 'app-2' },
      { position: 10, storeAppId: 'app-10' },
    ]);
  });

  it('keeps an empty list empty', () => {
    expect(topTenOf([])).toEqual([]);
  });
});
