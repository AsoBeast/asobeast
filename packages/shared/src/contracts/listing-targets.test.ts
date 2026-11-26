import { describe, expect, it } from 'vitest';

import {
  LISTING_TARGET_LIMIT,
  PLACEMENT_REASONS,
  PLACEMENT_SUGGESTIONS,
  placementFieldsOf,
  TARGET_NOT_TRACKED_REASONS,
  targetSlotRole,
} from '../index';

describe('the listing targets vocabulary', () => {
  it('names the first three slots title, subtitle, subtitle and the rest extra', () => {
    expect(targetSlotRole(0)).toBe('title');
    expect(targetSlotRole(1)).toBe('subtitle');
    expect(targetSlotRole(2)).toBe('subtitle');
    for (let index = 3; index < LISTING_TARGET_LIMIT; index += 1) {
      expect(targetSlotRole(index)).toBe('extra');
    }
  });

  it('allows ten targets', () => {
    expect(LISTING_TARGET_LIMIT).toBe(10);
  });

  it('names one reason a target is not tracked', () => {
    expect(TARGET_NOT_TRACKED_REASONS).toEqual(['keywordLimit']);
  });

  it('lists every field a suggestion can name, and skip', () => {
    expect(PLACEMENT_SUGGESTIONS).toEqual([
      'title',
      'subtitle',
      'keywordField',
      'shortDescription',
      'description',
      'skip',
    ]);
  });

  it('lists the reasons', () => {
    expect(PLACEMENT_REASONS).toEqual([
      'strongestReachable',
      'nextReachable',
      'hardToRank',
      'singleWord',
      'longTail',
      'noStrongRoom',
      'noRoom',
      'lowPopularity',
      'lowRelevance',
      'competitorBrand',
      'ownBrand',
    ]);
  });

  it('names only App Store fields for the App Store and only Google Play fields for Google Play', () => {
    expect(placementFieldsOf('APP_STORE')).toEqual([
      'title',
      'subtitle',
      'keywordField',
    ]);
    expect(placementFieldsOf('GOOGLE_PLAY')).toEqual([
      'title',
      'shortDescription',
      'description',
    ]);
  });
});
