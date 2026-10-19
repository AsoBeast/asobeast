import { describe, expect, it } from 'vitest';

import {
  isKeywordPlacement,
  KEYWORD_BREAKDOWN_RULES,
  KEYWORD_PLACEMENTS,
} from '../index';

describe('keyword breakdown contract', () => {
  it('orders placements from strongest to none', () => {
    expect(KEYWORD_PLACEMENTS).toEqual([
      'title',
      'subtitle',
      'shortDescription',
      'keywordField',
      'description',
      'split',
      'partial',
      'none',
    ]);
  });

  it('names every rule a note can carry', () => {
    expect(KEYWORD_BREAKDOWN_RULES).toEqual([
      'placement',
      'spelling',
      'ratings',
      'unread',
      'hidden',
      'similar',
    ]);
  });

  it('recognises a placement', () => {
    expect(isKeywordPlacement('split')).toBe(true);
    expect(isKeywordPlacement('summary')).toBe(false);
  });
});
