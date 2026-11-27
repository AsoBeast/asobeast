import { describe, expect, it } from 'vitest';

import { SERP_KEYWORD_PLACEMENTS } from '../index';

describe('search results contract', () => {
  it('lists the keyword placements of a search result', () => {
    expect(SERP_KEYWORD_PLACEMENTS).toEqual([
      'title',
      'subtitle',
      'both',
      'split',
      'none',
    ]);
  });
});
