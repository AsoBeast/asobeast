import { Keyword, KeywordMetric, KeywordRanking } from '@prisma/client';
import {
  CURRENT_FORMULA_VERSIONS,
  isScoringConfidence,
  isScoringSource,
  ScoreProvenance,
  ScoreSignals,
  TrackedKeywordItem,
} from '@asobeast/shared';
import { appOpportunity } from '../scoring/keyword-opportunity';
import { readScoreSignals } from '../scoring/score-signals';
import { reportedSource } from './keyword-field-membership';

const DELTA_WINDOW_DAYS = 7;

export interface TrackedKeywordRow {
  keywordId: string;
  source: TrackedKeywordItem['source'];
  fieldOrder: number | null;
  active: boolean;
  relevance: number | null;
  keyword: {
    text: string;
    country: string;
    store: Keyword['store'];
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
      | 'stats'
    >[];
  };
}

type TrackedMetric = TrackedKeywordRow['keyword']['metrics'][number];

type ScoreEvidence = Pick<TrackedKeywordItem, 'scoreSignals' | 'scoreOutdated'>;

function scoreEvidence(
  metric: TrackedMetric | null,
  store: TrackedKeywordRow['keyword']['store'],
  signals: ScoreSignals | null,
): ScoreEvidence {
  if (!metric) {
    return {};
  }
  return {
    scoreSignals: signals,
    scoreOutdated: metric.formulaVersion !== CURRENT_FORMULA_VERSIONS[store],
  };
}

function toScoreProvenance(
  metric: TrackedMetric | null,
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

type PositionFacts = Pick<
  TrackedKeywordItem,
  | 'latestPosition'
  | 'latestDepth'
  | 'previousPosition'
  | 'positionDelta1d'
  | 'positionDelta7d'
>;

function positionFacts(
  rankings: TrackedKeywordRow['keyword']['rankings'],
): PositionFacts {
  const latest = rankings[0] ?? null;
  const latestPosition = latest?.position ?? null;
  const previousPosition = previousDayPosition(rankings);
  return {
    latestPosition,
    latestDepth: latest?.depth ?? null,
    previousPosition,
    positionDelta1d:
      latestPosition !== null && previousPosition !== null
        ? latestPosition - previousPosition
        : null,
    positionDelta7d: positionDelta7d(rankings),
  };
}

export interface AppFacts {
  snapshotText: string;
}

const NO_APP_FACTS: AppFacts = { snapshotText: '' };

export function toTrackedKeywordItem(
  row: TrackedKeywordRow,
  app: AppFacts = NO_APP_FACTS,
  serpVolatility7d: number | null = null,
): TrackedKeywordItem {
  const metric = row.keyword.metrics[0] ?? null;
  const positions = positionFacts(row.keyword.rankings);
  const { latestPosition, latestDepth } = positions;
  const traffic = metric?.traffic ?? null;
  const difficulty = metric?.difficulty ?? null;
  const source = reportedSource(row);
  const signals = readScoreSignals(metric?.stats);
  const { volume, relevance, opportunity } = appOpportunity({
    source,
    keywordText: row.keyword.text,
    snapshotText: app.snapshotText,
    relevanceOverride: row.relevance,
    traffic,
    difficulty,
    ranking: { position: latestPosition, checked: latestDepth !== null },
  });
  return {
    keywordId: row.keywordId,
    text: row.keyword.text,
    country: row.keyword.country,
    source,
    active: row.active,
    ...positions,
    traffic,
    difficulty,
    volume,
    relevance,
    opportunity,
    bucket: null,
    scoredAt: metric ? metric.date.toISOString().slice(0, 10) : null,
    scoreProvenance: toScoreProvenance(metric),
    serpVolatility7d,
    ...scoreEvidence(metric, row.keyword.store, signals),
  };
}
