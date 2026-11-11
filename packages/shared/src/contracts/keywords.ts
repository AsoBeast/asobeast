import {
  KeywordBucket,
  KeywordSource,
  KeywordSuggestionStrategy,
  OfficialPopularityState,
  ScoringConfidence,
  ScoringSource,
  SerpFlag,
  Store,
  SuggestReachStatus,
} from '../index';
import type { RankMilestoneTier } from '../rank';
import type { KeywordWordMatch } from './keyword-breakdown';
import type { AppStoreLocalization } from '../storefronts/app-store-localizations';
import type { PaidPlanName, QuotaUsage } from './plans';

export interface OfficialPopularityListing {
  value: number;
  week: string;
}

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
  officialPopularityState?: OfficialPopularityState | null;
  officialPopularityFloor?: number | null;
  officialPopularityWeek?: string | null;
  officialPopularityLastAboveFloor?: OfficialPopularityListing | null;
}

export interface ScoreProvenance {
  source: ScoringSource;
  formulaVersion: string;
  capturedAt: string;
  confidence: ScoringConfidence;
}

export const KEYWORD_MARK_SURFACES = [
  'title',
  'subtitle',
  'shortDescription',
  'keywordField',
] as const;
export type KeywordMarkSurface = (typeof KEYWORD_MARK_SURFACES)[number];

export interface KeywordMarkSegment {
  text: string;
  surface: KeywordMarkSurface | null;
  match?: Exclude<KeywordWordMatch, 'none'>;
}

export interface KeywordRecentPosition {
  date: string;
  position: number | null;
}

export const KEYWORD_TOP_APP_ROLES = ['own', 'competitor', 'other'] as const;
export type KeywordTopAppRole = (typeof KEYWORD_TOP_APP_ROLES)[number];

export interface KeywordTopApp {
  storeAppId: string;
  title: string;
  iconUrl: string | null;
  position: number;
  role: KeywordTopAppRole;
}

export const KEYWORD_RECENT_POSITION_DAYS = 7;
export const KEYWORD_TOP_APPS = 3;

export interface TrackedKeywordItem {
  keywordId: string;
  text: string;
  country: string;
  source: KeywordSource;
  active: boolean;
  latestPosition: number | null;
  latestDepth: number | null;
  latestCheckedOn?: string | null;
  previousPosition: number | null;
  positionDelta1d: number | null;
  positionDelta7d: number | null;
  bestPosition?: number | null;
  positionDeltaFromBest?: number | null;
  daysInTier?: number | null;
  heldTier?: RankMilestoneTier | null;
  dropStreak?: number | null;
  uncovered?: boolean;
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
  trackedAt?: string;
  competitorsInTop10?: number | null;
  playAcquisitions?: PlayAcquisitions | null;
  matchedIn?: KeywordMarkSegment[];
  keywordClass?: KeywordClass;
  keywordClassSource?: KeywordClassSource;
  lastRankedPosition?: number | null;
  lastRankedOn?: string | null;
  recentPositions?: KeywordRecentPosition[];
  topApps?: KeywordTopApp[] | null;
}

export interface PlayAcquisitions {
  month: string;
  visitors: number;
  acquisitions: number;
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
  seed?: string;
}

export interface KeywordFieldResult {
  tracked: TrackedKeywordItem[];
  charactersUsed: number;
  charactersLimit: number;
  duplicatesRemoved: number;
  country?: string;
  localization?: AppStoreLocalization;
  phrases?: string[];
}

export interface KeywordFieldQuery {
  country?: string;
  localization?: AppStoreLocalization;
}

export interface KeywordFieldSummary {
  localization: AppStoreLocalization;
  phrases: string[];
  charactersUsed: number;
  charactersLimit: number;
  markets: string[];
  updatedAt: string;
}

export interface KeywordComparisonCompetitor {
  id: string;
  name: string | null;
}

export interface KeywordComparisonRow {
  keywordId: string;
  text: string;
  country: string;
  traffic: number | null;
  difficulty: number | null;
  you: number | null;
  positions: Record<string, number | null>;
  gap: boolean;
  unchecked?: string[];
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
  keywordClass?: KeywordClass | null;
}

export const KEYWORD_CLASSES = [
  'ownBrand',
  'competitorBrand',
  'generic',
] as const;
export type KeywordClass = (typeof KEYWORD_CLASSES)[number];

export const KEYWORD_CLASS_SOURCES = ['detected', 'owner'] as const;
export type KeywordClassSource = (typeof KEYWORD_CLASS_SOURCES)[number];

export const isKeywordClass = (value: unknown): value is KeywordClass =>
  typeof value === 'string' &&
  KEYWORD_CLASSES.some((keywordClass) => keywordClass === value);

export const KEYWORD_BULK_ACTIONS = ['pause', 'resume', 'untrack'] as const;
export type KeywordBulkAction = (typeof KEYWORD_BULK_ACTIONS)[number];

export interface KeywordBulkRequest {
  action: KeywordBulkAction;
  keywordIds: string[];
}

export interface KeywordBulkResult {
  action: KeywordBulkAction;
  requested: number;
  changed: number;
  unchanged: number;
  missing: string[];
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
