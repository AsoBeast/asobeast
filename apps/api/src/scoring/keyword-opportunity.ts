import { KeywordSource } from '@asobeast/shared';
import {
  computeOpportunity,
  defaultRelevance,
  toDifficulty100,
  toVolume,
} from './formulas';

export interface OpportunityInput {
  source: KeywordSource;
  keywordText: string;
  snapshotText: string;
  relevanceOverride: number | null;
  traffic: number | null;
  difficulty: number | null;
}

export interface AppOpportunity {
  relevance: number;
  volume: number | null;
  difficulty100: number | null;
  opportunity: number | null;
}

export function appOpportunity(input: OpportunityInput): AppOpportunity {
  const relevance =
    input.relevanceOverride ??
    defaultRelevance(input.source, input.keywordText, input.snapshotText);
  const volume = input.traffic === null ? null : toVolume(input.traffic);
  const difficulty100 =
    input.difficulty === null ? null : toDifficulty100(input.difficulty);
  return {
    relevance,
    volume,
    difficulty100,
    opportunity: computeOpportunity(volume, difficulty100, relevance),
  };
}
