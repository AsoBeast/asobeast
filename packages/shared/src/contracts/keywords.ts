import {
  KeywordBucket,
  KeywordSource,
  KeywordSuggestionStrategy,
  ScoringConfidence,
  ScoringSource,
  SerpFlag,
  Store,
  SuggestReachStatus,
} from '../index';
import type { PaidPlanName, QuotaUsage } from './plans';

export interface ScoreSignals {
  suggestReach: SuggestReachStatus;
  suggestPrefixLength: number | null;
  suggestPosition: number | null;
  serpRelevance: number;
  medianRatingCount: number | null;
  flags: SerpFlag[];
  officialPopularity: number | null;
  estimatedTraffic: number | null;
  entryDifficulty?: number | null;
}

export interface ScoreProvenance {
  source: ScoringSource;
  formulaVersion: string;
  capturedAt: string;
  confidence: ScoringConfidence;
}

export interface TrackedKeywordItem {
  keywordId: string;
  text: string;
  country: string;
  source: KeywordSource;
  active: boolean;
  latestPosition: number | null;
  latestDepth: number | null;
  previousPosition: number | null;
  positionDelta1d: number | null;
  positionDelta7d: number | null;
  traffic: number | null;
  difficulty: number | null;
  volume: number | null;
  relevance: number | null;
  opportunity: number | null;
  bucket: KeywordBucket | null;
  scoredAt: string | null;
  scoreProvenance: ScoreProvenance | null;
  serpVolatility7d: number | null;
  scoreSignals?: ScoreSignals | null;
  scoreOutdated?: boolean;
  tags?: string[];
  note?: string | null;
}

export interface KeywordCountrySummary {
  country: string;
  keywordCount: number;
}

export interface KeywordSuggestion {
  text: string;
  strategy: KeywordSuggestionStrategy;
  priority?: number;
  usedByCount?: number;
  event?: string;
}

export interface KeywordFieldResult {
  tracked: TrackedKeywordItem[];
  charactersUsed: number;
  charactersLimit: number;
  duplicatesRemoved: number;
}

export interface KeywordComparisonCompetitor {
  id: string;
  name: string | null;
}

export interface KeywordComparisonRow {
  keywordId: string;
  text: string;
  traffic: number | null;
  difficulty: number | null;
  you: number | null;
  positions: Record<string, number | null>;
  gap: boolean;
}

export interface KeywordComparison {
  competitors: KeywordComparisonCompetitor[];
  rows: KeywordComparisonRow[];
}

export interface KeywordUpdateRequest {
  active?: boolean;
  relevance?: number | null;
  tags?: string[];
  note?: string | null;
}

export interface KeywordAddRequest {
  keywords: string[];
  country?: string;
}

export interface KeywordFieldRequest {
  text: string;
}

export interface KeywordScope {
  id: string;
  text: string;
  store: Store;
  country: string;
}

export function keywordLabel(scope: {
  text: string;
  country?: string;
}): string {
  return scope.country
    ? `${scope.text} (${scope.country.toUpperCase()})`
    : scope.text;
}

export const KEYWORD_IMPORT_STATUSES = [
  'new',
  'resume',
  'tracked',
  'duplicate',
  'invalid',
  'overQuota',
] as const;
export type KeywordImportStatus = (typeof KEYWORD_IMPORT_STATUSES)[number];

export const KEYWORD_IMPORT_REASONS = [
  'empty',
  'tooLong',
  'tooManyWords',
  'unknownCountry',
  'invalidTag',
  'tooManyTags',
  'noteTooLong',
] as const;
export type KeywordImportReason = (typeof KEYWORD_IMPORT_REASONS)[number];

export interface KeywordImportRow {
  keyword: string;
  country?: string | null;
  tags?: string[];
  note?: string | null;
}

export interface KeywordImportRequest {
  rows: KeywordImportRow[];
  country?: string;
}

export interface KeywordImportRowResult {
  index: number;
  keyword: string;
  country: string;
  status: KeywordImportStatus;
  reason?: KeywordImportReason;
  message?: string;
  duplicateOf?: number;
}

export type KeywordImportSummary = { rows: number } & Record<
  KeywordImportStatus,
  number
>;

export interface KeywordImportCost {
  store: Store;
  keywordMarkets: number;
  dailyRequests: number;
}

export interface KeywordImportQuota extends QuotaUsage {
  upgradeTo: PaidPlanName | null;
}

export interface KeywordImportResult {
  dryRun: boolean;
  imported: number;
  summary: KeywordImportSummary;
  cost: KeywordImportCost;
  quota: KeywordImportQuota | null;
  results: KeywordImportRowResult[];
}

export interface SpiderStartRequest {
  term: string;
  country?: string;
}
