import { ScoringConfidence, ScoringSource, Store } from '@asobeast/shared';
import {
  APP_STORE_FORMULA_VERSION,
  GOOGLE_PLAY_FORMULA_VERSION,
} from './formulas';

export interface ScoringEvidence {
  searchResultCount: number;
  suggestCompleted: boolean;
  prefixSweepCompleted: boolean;
  detailTargetCount: number;
  detailSuccessCount: number;
}

export interface ScoringProfile {
  source: ScoringSource;
  formulaVersion: string;
}

const PROFILES: Record<Store, ScoringProfile> = {
  APP_STORE: {
    source: 'APPLE_SUGGEST_SEARCH',
    formulaVersion: APP_STORE_FORMULA_VERSION,
  },
  GOOGLE_PLAY: {
    source: 'GOOGLE_PLAY_PREFIX_SEARCH',
    formulaVersion: GOOGLE_PLAY_FORMULA_VERSION,
  },
};

export const scoringProfile = (store: Store): ScoringProfile => PROFILES[store];

export function scoringConfidence(
  store: Store,
  evidence: ScoringEvidence,
): ScoringConfidence {
  const searchComplete = evidence.searchResultCount >= 10;
  if (store === 'APP_STORE') {
    const completed =
      Number(searchComplete) + Number(evidence.suggestCompleted);
    return completed === 2 ? 'HIGH' : completed === 1 ? 'MEDIUM' : 'LOW';
  }

  const detailComplete =
    evidence.detailTargetCount >= 8 && evidence.detailSuccessCount >= 8;
  const completed =
    Number(searchComplete) +
    Number(evidence.prefixSweepCompleted) +
    Number(detailComplete);
  return completed === 3 ? 'HIGH' : completed === 2 ? 'MEDIUM' : 'LOW';
}
