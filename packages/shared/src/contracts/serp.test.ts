import { describe, expect, it } from 'vitest';

import { SERP_KEYWORD_PLACEMENTS, type SerpEntryItem } from '../index';

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

  it('describes the short description of a Google Play result', () => {
    const entry: SerpEntryItem = {
      position: 1,
      storeAppId: 'com.example',
      title: 'Habit Tracker',
      developer: null,
      ratingAvg: null,
      ratingCount: null,
      appId: null,
      isCompetitor: false,
      placement: 'subtitle',
      shortDescription: 'Plan your day',
      shortDescriptionSegments: [{ text: 'Plan your day', match: 'none' }],
    };

    expect(entry.shortDescription).toBe('Plan your day');
    expect(SERP_KEYWORD_PLACEMENTS).toContain(entry.placement);
  });
});
