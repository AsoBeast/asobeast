import { describe, expect, it } from 'vitest';

import {
  DISCOVERY_CAPTURE_DEPTH,
  DISCOVERY_CHECKS_PER_RUN,
  DISCOVERY_POOL_LIMIT,
  DISCOVERY_RECHECK_DAYS,
  DISCOVERY_RECOMMENDED,
  DISCOVERY_SOURCES,
  DISCOVERY_STATES,
  isDiscoverySource,
  RANK_DEPTH,
  SERP_CAPTURE_DEPTH,
  STORES,
} from '../index';

describe('keyword discovery contract', () => {
  it('lists the sources in the order that breaks a pool tie', () => {
    expect(DISCOVERY_SOURCES).toEqual([
      'title',
      'subtitle',
      'description',
      'competitors',
      'reviews',
      'popularity',
      'portfolio',
    ]);
  });

  it('recognises a stored source and refuses any other text', () => {
    expect(isDiscoverySource('reviews')).toBe(true);
    expect(isDiscoverySource('ai')).toBe(false);
  });

  it('lists the states a list can be filtered by', () => {
    expect(DISCOVERY_STATES).toEqual(['all', 'ranked', 'opportunity']);
  });

  it('caps the weekly checks per store and sizes the pool', () => {
    expect(DISCOVERY_CHECKS_PER_RUN).toEqual({
      APP_STORE: 40,
      GOOGLE_PLAY: 20,
    });
    expect(DISCOVERY_RECOMMENDED).toBe(50);
    expect(DISCOVERY_POOL_LIMIT).toBe(200);
    expect(DISCOVERY_RECHECK_DAYS).toBe(7);
  });

  it('names a weekly cap for every store', () => {
    expect(Object.keys(DISCOVERY_CHECKS_PER_RUN)).toEqual([...STORES]);
  });

  it('reads a capture as deep as the stored search results and no deeper than a search', () => {
    expect(DISCOVERY_CAPTURE_DEPTH).toBe(SERP_CAPTURE_DEPTH);
    expect(DISCOVERY_CAPTURE_DEPTH).toBeLessThan(RANK_DEPTH);
  });
});
