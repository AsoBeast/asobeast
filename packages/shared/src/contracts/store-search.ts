import type { Store } from '../index';

export const STORE_SEARCH_QUERY_MAX_LENGTH = 80;

export interface StoreSearchResult {
  storeAppId: string;
  title: string;
  developer: string | null;
  ratingAvg: number | null;
  ratingCount: number | null;
  iconUrl: string | null;
}

export const COMPETITOR_SUGGESTION_SOURCES = ['serp', 'similar'] as const;
export type CompetitorSuggestionSource =
  (typeof COMPETITOR_SUGGESTION_SOURCES)[number];

export const COMPETITOR_SUGGESTIONS_LIMIT = 10;

export interface CompetitorSuggestion {
  storeAppId: string;
  title: string;
  developer: string | null;
  iconUrl: string | null;
  source: CompetitorSuggestionSource;
  appearances: number | null;
  bestPosition: number | null;
}

export const SIMILAR_LOOKUP_STATES = ['ok', 'unavailable'] as const;
export type SimilarLookupState = (typeof SIMILAR_LOOKUP_STATES)[number];

export interface CompetitorSuggestions {
  store: Store;
  country: string;
  similar: SimilarLookupState;
  items: CompetitorSuggestion[];
}
