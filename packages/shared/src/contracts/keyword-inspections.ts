import type {
  ScoringConfidence,
  ScoringSource,
  Store,
  SuggestReachStatus,
} from '../index';
import type { ScoreSignals } from './keywords';

export const KEYWORD_INSPECTION_STATUSES = [
  'PENDING',
  'DONE',
  'FAILED',
] as const;
export type KeywordInspectionStatus =
  (typeof KEYWORD_INSPECTION_STATUSES)[number];

export const KEYWORD_INSPECTION_RESULT_DEPTH = 50;
export const KEYWORD_INSPECTION_SUGGESTION_LIMIT = 10;
export const KEYWORD_INSPECTION_LIST_LIMIT = 50;

export const KEYWORD_INSPECTION_TITLE_MATCHES = [
  'exact',
  'allWords',
  'someWords',
  'none',
] as const;
export type KeywordInspectionTitleMatch =
  (typeof KEYWORD_INSPECTION_TITLE_MATCHES)[number];

export interface KeywordInspectionRequest {
  keyword: string;
  store: Store;
  country: string;
}

export interface KeywordInspectionResult {
  position: number;
  storeAppId: string;
  title: string;
  developer: string | null;
  iconUrl: string | null;
  ratingAvg: number | null;
  ratingCount: number | null;
  releasedAt: string | null;
  updatedAt: string | null;
  titleMatch: KeywordInspectionTitleMatch;
}

export interface KeywordInspectionSuggestion {
  position: number;
  term: string;
}

export interface KeywordInspectionCompetition {
  topCount: number;
  medianRatingCount: number | null;
  strongestRatingCount: number | null;
  averageRating: number | null;
  exactTitleMatches: number;
  titleMatches: number;
  appsOverHundredThousandRatings: number;
  medianDaysSinceUpdate: number | null;
  freshlyUpdated: number;
}

export interface KeywordInspectionProvenance {
  source: ScoringSource;
  formulaVersion: string;
  confidence: ScoringConfidence;
}

export interface KeywordInspectionSummary {
  id: string;
  keywordId: string;
  keyword: string;
  store: Store;
  country: string;
  status: KeywordInspectionStatus;
  requestedAt: string;
  completedAt: string | null;
  volume: number | null;
  difficulty100: number | null;
  opportunity: number | null;
  resultCount: number | null;
}

export interface KeywordInspectionDelta {
  inspectionId: string;
  completedAt: string;
  volume: number | null;
  difficulty100: number | null;
  resultCount: number | null;
  entered: string[];
  left: string[];
}

export interface KeywordInspection extends KeywordInspectionSummary {
  provenance: KeywordInspectionProvenance | null;
  suggestReach: SuggestReachStatus | null;
  signals: ScoreSignals | null;
  competition: KeywordInspectionCompetition | null;
  results: KeywordInspectionResult[];
  suggestions: KeywordInspectionSuggestion[];
  previous: KeywordInspectionDelta | null;
  failure: string | null;
}

export interface KeywordInspectionList {
  items: KeywordInspectionSummary[];
}
