import { Prisma } from '@prisma/client';
import { computeDifficulty } from './difficulty';
import { KeywordStats } from './formulas';
import { scoringConfidence, scoringProfile } from './provenance';
import { buildScoreSignals } from './score-signals';
import { CollectedKeywordStats } from './stats-collector.service';
import { computeTraffic, estimateTraffic } from './traffic';

export interface KeywordScore {
  traffic: number;
  difficulty: number;
  stats: Prisma.InputJsonValue;
  scoringSource: string;
  formulaVersion: string;
  confidence: string;
}

function storedStats(
  { stats, evidence }: CollectedKeywordStats,
  estimatedTraffic: number,
): Prisma.InputJsonValue {
  const stored: Partial<KeywordStats> = { ...stats };
  delete stored.official;
  return {
    ...stored,
    signals: buildScoreSignals(stats, estimatedTraffic),
    evidence,
  } as unknown as Prisma.InputJsonValue;
}

export function scoreCollected(collected: CollectedKeywordStats): KeywordScore {
  const { stats, evidence } = collected;
  const { source, formulaVersion } = scoringProfile(
    stats.store,
    evidence.officialPopularityUsed,
  );
  return {
    traffic: computeTraffic(stats),
    difficulty: computeDifficulty(stats),
    stats: storedStats(collected, estimateTraffic(stats)),
    scoringSource: source,
    formulaVersion,
    confidence: scoringConfidence(stats.store, evidence),
  };
}
