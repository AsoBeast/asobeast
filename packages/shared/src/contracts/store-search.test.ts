import { describe, expect, expectTypeOf, it } from 'vitest';

import {
  COMPETITOR_SUGGESTION_SOURCES,
  COMPETITOR_SUGGESTIONS_LIMIT,
  QUERY_BOUNDS,
  SIMILAR_LOOKUP_STATES,
  STORE_SEARCH_QUERY_MAX_LENGTH,
  type CompetitorSuggestion,
  type CompetitorSuggestionSource,
  type CompetitorSuggestions,
  type SimilarLookupState,
  type Store,
  type StoreSearchResult,
} from '../index';

describe('the store search vocabulary', () => {
  it('names the suggestion sources, the store results first', () => {
    expect(COMPETITOR_SUGGESTION_SOURCES).toEqual(['serp', 'similar']);
    expectTypeOf<CompetitorSuggestionSource>().toEqualTypeOf<
      'serp' | 'similar'
    >();
  });

  it('names the similar lookup states', () => {
    expect(SIMILAR_LOOKUP_STATES).toEqual(['ok', 'unavailable']);
    expectTypeOf<SimilarLookupState>().toEqualTypeOf<'ok' | 'unavailable'>();
  });

  it('suggests at most ten competitors', () => {
    expect(COMPETITOR_SUGGESTIONS_LIMIT).toBe(10);
  });

  it('bounds a name search query and its page size', () => {
    expect(STORE_SEARCH_QUERY_MAX_LENGTH).toBe(80);
    expect(QUERY_BOUNDS.storeSearchLimit).toEqual({
      min: 1,
      max: 25,
      default: 10,
    });
  });
});

describe('the store search contract', () => {
  it('types a search result with nullable listing details', () => {
    expectTypeOf<StoreSearchResult['iconUrl']>().toEqualTypeOf<string | null>();
    expectTypeOf<StoreSearchResult['ratingAvg']>().toEqualTypeOf<
      number | null
    >();
  });

  it('types the suggestions with their store and source', () => {
    expectTypeOf<CompetitorSuggestions['store']>().toEqualTypeOf<Store>();
    expectTypeOf<
      CompetitorSuggestion['source']
    >().toEqualTypeOf<CompetitorSuggestionSource>();
  });
});
