import {
  KeywordBucket,
  KeywordSource,
  KeywordSuggestionStrategy,
  ScoringConfidence,
  ScoringSource,
  Store,
} from '../index';

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

export interface SpiderStartRequest {
  term: string;
  country?: string;
}
