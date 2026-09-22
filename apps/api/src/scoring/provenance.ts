import {
  CURRENT_FORMULA_VERSIONS,
  ScoringConfidence,
  ScoringSource,
  Store,
} from '@asobeast/shared';

export interface ScoringEvidence {
  searchResultCount: number;
  suggestCompleted: boolean;
  suggestRequests: number;
  detailTargetCount: number;
  detailSuccessCount: number;
  officialPopularityUsed: boolean;
}

export interface ScoringProfile {
  source: ScoringSource;
  formulaVersion: string;
}

const MIN_COMPLETE_RESULTS = 10;
const MIN_COMPLETE_DETAILS = 8;

const ESTIMATE_SOURCES: Record<Store, ScoringSource> = {
  APP_STORE: 'APPLE_SEARCH_SIGNALS',
  GOOGLE_PLAY: 'GOOGLE_PLAY_SUGGEST_REACH',
};

export const scoringProfile = (
  store: Store,
  officialUsed: boolean,
): ScoringProfile => ({
  source: officialUsed ? 'APPLE_ADS_POPULARITY' : ESTIMATE_SOURCES[store],
  formulaVersion: CURRENT_FORMULA_VERSIONS[store],
});

export function scoringConfidence(
  store: Store,
  evidence: ScoringEvidence,
): ScoringConfidence {
  if (evidence.officialPopularityUsed) {
    return 'HIGH';
  }
  const suggestFailed = store === 'GOOGLE_PLAY' && !evidence.suggestCompleted;
  if (suggestFailed || evidence.searchResultCount === 0) {
    return 'LOW';
  }
  const serpComplete = evidence.searchResultCount >= MIN_COMPLETE_RESULTS;
  const detailsComplete =
    store !== 'GOOGLE_PLAY' ||
    evidence.detailSuccessCount >= MIN_COMPLETE_DETAILS;
  return serpComplete && detailsComplete ? 'HIGH' : 'MEDIUM';
}
