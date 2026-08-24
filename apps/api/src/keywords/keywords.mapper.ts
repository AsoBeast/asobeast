import { KeywordMetric, KeywordRanking } from '@prisma/client';
import {
  isScoringConfidence,
  isScoringSource,
  ScoreProvenance,
  TrackedKeywordItem,
} from '@asobeast/shared';
import {
  computeOpportunity,
  defaultRelevance,
  toDifficulty100,
  toVolume,
} from '../scoring/formulas';

const DELTA_WINDOW_DAYS = 7;

export interface TrackedKeywordRow {
  keywordId: string;
  source: TrackedKeywordItem['source'];
  active: boolean;
  relevance: number | null;
  keyword: {
    text: string;
    country: string;
    rankings: Pick<KeywordRanking, 'position' | 'date' | 'depth'>[];
    metrics: Pick<
      KeywordMetric,
      | 'traffic'
      | 'difficulty'
      | 'date'
      | 'scoringSource'
      | 'formulaVersion'
      | 'confidence'
      | 'capturedAt'
    >[];
  };
}

function toScoreProvenance(
  metric: TrackedKeywordRow['keyword']['metrics'][number] | null,
): ScoreProvenance | null {
  if (
    !metric ||
    !isScoringSource(metric.scoringSource) ||
    !metric.formulaVersion ||
    !metric.capturedAt ||
    !isScoringConfidence(metric.confidence)
  ) {
    return null;
  }
  return {
    source: metric.scoringSource,
    formulaVersion: metric.formulaVersion,
    capturedAt: metric.capturedAt.toISOString(),
    confidence: metric.confidence,
  };
}

function positionDelta7d(
  rankings: Pick<KeywordRanking, 'position' | 'date'>[],
): number | null {
  const latest = rankings[0];
  if (!latest || latest.position === null) {
    return null;
  }
  const cutoff = new Date(latest.date);
  cutoff.setUTCDate(cutoff.getUTCDate() - DELTA_WINDOW_DAYS);
  const past = rankings.find(
    (ranking) => ranking.date <= cutoff && ranking.position !== null,
  );
  if (!past || past.position === null) {
    return null;
  }
  return latest.position - past.position;
}

function previousDayPosition(
  rankings: Pick<KeywordRanking, 'position' | 'date'>[],
): number | null {
  const latest = rankings[0];
  if (!latest) {
    return null;
  }
  const target = new Date(latest.date);
  target.setUTCDate(target.getUTCDate() - 1);
  const targetKey = target.toISOString().slice(0, 10);
  const previous = rankings.find(
    (ranking) => ranking.date.toISOString().slice(0, 10) === targetKey,
  );
  return previous ? previous.position : null;
}

export function toTrackedKeywordItem(
  row: TrackedKeywordRow,
  snapshotText = '',
  serpVolatility7d: number | null = null,
): TrackedKeywordItem {
  const latest = row.keyword.rankings[0] ?? null;
  const metric = row.keyword.metrics[0] ?? null;
  const latestPosition = latest?.position ?? null;
  const latestDepth = latest?.depth ?? null;
  const previousPosition = previousDayPosition(row.keyword.rankings);
  const positionDelta1d =
    latestPosition !== null && previousPosition !== null
      ? latestPosition - previousPosition
      : null;
  const traffic = metric?.traffic ?? null;
  const difficulty = metric?.difficulty ?? null;
  const volume = traffic === null ? null : toVolume(traffic);
  const difficulty100 =
    difficulty === null ? null : toDifficulty100(difficulty);
  const relevance =
    row.relevance ??
    defaultRelevance(row.source, row.keyword.text, snapshotText);
  return {
    keywordId: row.keywordId,
    text: row.keyword.text,
    country: row.keyword.country,
    source: row.source,
    active: row.active,
    latestPosition,
    latestDepth,
    previousPosition,
    positionDelta1d,
    positionDelta7d: positionDelta7d(row.keyword.rankings),
    traffic,
    difficulty,
    volume,
    relevance,
    opportunity: computeOpportunity(volume, difficulty100, relevance),
    bucket: null,
    scoredAt: metric ? metric.date.toISOString().slice(0, 10) : null,
    scoreProvenance: toScoreProvenance(metric),
    serpVolatility7d,
  };
}
