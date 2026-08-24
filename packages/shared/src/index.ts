/**
 * @asobeast/shared
 *
 * Design rule: this package is runtime agnostic and dependency light. It holds
 * contract types shared between the API and the web app, the `Store` union, the
 * store URL parser (Phase 2), normalization helpers and constants. It must never
 * import Nest, Next or Prisma — nothing runtime specific may leak in here.
 */

export const STORES = ['APP_STORE', 'GOOGLE_PLAY'] as const;
export type Store = (typeof STORES)[number];

/** Stores actively scraped in this version. */
export const SUPPORTED_STORES: readonly Store[] = ['APP_STORE', 'GOOGLE_PLAY'];

export const KEYWORD_SUGGESTION_STRATEGIES = [
  'metadata',
  'search',
  'similar',
  'developer',
  'competitors',
  'seasonal',
  'reviews',
] as const;
export type KeywordSuggestionStrategy =
  (typeof KEYWORD_SUGGESTION_STRATEGIES)[number];

export const KEYWORD_BUCKETS = [
  'primary',
  'secondary',
  'longtail',
  'aspirational',
] as const;
export type KeywordBucket = (typeof KEYWORD_BUCKETS)[number];

export const KEYWORD_BUCKET_TARGETS: Record<
  KeywordBucket,
  { min: number; max: number }
> = {
  primary: { min: 3, max: 5 },
  secondary: { min: 5, max: 10 },
  longtail: { min: 10, max: 20 },
  aspirational: { min: 3, max: 5 },
};

export const KEYWORD_SORTS = [
  'opportunity',
  'traffic',
  'difficulty',
  'position',
  'volatility',
] as const;
export type KeywordSort = (typeof KEYWORD_SORTS)[number];

export const KEYWORD_SOURCES = [
  'TITLE',
  'SUBTITLE',
  'DESCRIPTION',
  'KEYWORD_FIELD',
  'SUGGESTED',
  'MANUAL',
  'COMPETITOR',
] as const;
export type KeywordSource = (typeof KEYWORD_SOURCES)[number];

export const SCORING_SOURCES = [
  'APPLE_SUGGEST_SEARCH',
  'GOOGLE_PLAY_PREFIX_SEARCH',
] as const;
export type ScoringSource = (typeof SCORING_SOURCES)[number];

export const SCORING_CONFIDENCES = ['LOW', 'MEDIUM', 'HIGH'] as const;
export type ScoringConfidence = (typeof SCORING_CONFIDENCES)[number];

export const isScoringSource = (value: unknown): value is ScoringSource =>
  typeof value === 'string' &&
  SCORING_SOURCES.some((source) => source === value);

export const isScoringConfidence = (
  value: unknown,
): value is ScoringConfidence =>
  typeof value === 'string' &&
  SCORING_CONFIDENCES.some((confidence) => confidence === value);

export const DEFAULT_COUNTRY = 'us';

export const SERP_DEPTH = 10;

export * from './query-bounds';
export * from './url-parser';
export * from './contracts';
export * from './text';
export * from './aso';
export * from './rank';
export * from './auth';
export * from './trusted-proxy';
