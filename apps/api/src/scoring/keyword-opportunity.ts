import { KeywordSource } from '@asobeast/shared';
import { toDifficulty100, toVolume } from './formulas';
import { computeOpportunity } from './opportunity';
import { defaultRelevance, RankingEvidence } from './relevance';

export interface OpportunityInput {
  source: KeywordSource;
  keywordText: string;
  snapshotText: string;
  relevanceOverride: number | null;
  traffic: number | null;
  difficulty: number | null;
  ranking?: RankingEvidence;
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
    defaultRelevance(
      input.source,
      input.keywordText,
      input.snapshotText,
      input.ranking,
    );
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
