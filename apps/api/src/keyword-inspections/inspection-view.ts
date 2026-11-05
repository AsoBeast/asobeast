import {
  isScoringConfidence,
  isScoringSource,
  KEYWORD_INSPECTION_STATUSES,
  KeywordInspection,
  KeywordInspectionDelta,
  KeywordInspectionProvenance,
  KeywordInspectionResult,
  KeywordInspectionStatus,
  KeywordInspectionSuggestion,
  KeywordInspectionSummary,
  toDifficulty100,
  toVolume,
} from '@asobeast/shared';
import { Prisma } from '@prisma/client';
import { computeOpportunity } from '../scoring/opportunity';
import { readScoreSignals } from '../scoring/score-signals';
import { COMPETITION_DEPTH, summarizeCompetition } from './inspection-results';

export const INSPECTION_SUMMARY_SELECT = {
  id: true,
  keywordId: true,
  status: true,
  requestedAt: true,
  completedAt: true,
  traffic: true,
  difficulty: true,
  resultCount: true,
  keyword: { select: { text: true, store: true, country: true } },
} satisfies Prisma.KeywordInspectionSelect;

export const INSPECTION_DETAIL_SELECT = {
  ...INSPECTION_SUMMARY_SELECT,
  scoringSource: true,
  formulaVersion: true,
  confidence: true,
  stats: true,
  results: true,
  suggestions: true,
  failure: true,
} satisfies Prisma.KeywordInspectionSelect;

export type InspectionSummaryRow = Prisma.KeywordInspectionGetPayload<{
  select: typeof INSPECTION_SUMMARY_SELECT;
}>;

export type InspectionDetailRow = Prisma.KeywordInspectionGetPayload<{
  select: typeof INSPECTION_DETAIL_SELECT;
}>;

const STATUSES: ReadonlySet<string> = new Set(KEYWORD_INSPECTION_STATUSES);

function statusOf(value: string): KeywordInspectionStatus {
  return STATUSES.has(value) ? (value as KeywordInspectionStatus) : 'FAILED';
}

const scaled = (
  value: number | null,
  scale: (raw: number) => number,
): number | null => (value === null ? null : scale(value));

export function toInspectionSummary(
  row: InspectionSummaryRow,
): KeywordInspectionSummary {
  const volume = scaled(row.traffic, toVolume);
  const difficulty100 = scaled(row.difficulty, toDifficulty100);
  return {
    id: row.id,
    keywordId: row.keywordId,
    keyword: row.keyword.text,
    store: row.keyword.store,
    country: row.keyword.country,
    status: statusOf(row.status),
    requestedAt: row.requestedAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
    volume,
    difficulty100,
    opportunity: computeOpportunity(volume, difficulty100),
    resultCount: row.resultCount,
  };
}

const arrayOf = <T>(value: Prisma.JsonValue | null): T[] =>
  Array.isArray(value) ? (value as unknown as T[]) : [];

function provenanceOf(
  row: InspectionDetailRow,
): KeywordInspectionProvenance | null {
  if (
    !isScoringSource(row.scoringSource) ||
    !isScoringConfidence(row.confidence) ||
    row.formulaVersion === null
  ) {
    return null;
  }
  return {
    source: row.scoringSource,
    formulaVersion: row.formulaVersion,
    confidence: row.confidence,
  };
}

const topTitles = (results: readonly KeywordInspectionResult[]): Set<string> =>
  new Set(
    results.slice(0, COMPETITION_DEPTH).map((result) => result.storeAppId),
  );

function titlesOf(
  results: readonly KeywordInspectionResult[],
  ids: ReadonlySet<string>,
): string[] {
  return results
    .slice(0, COMPETITION_DEPTH)
    .filter((result) => ids.has(result.storeAppId))
    .map((result) => result.title);
}

const minus = (left: Set<string>, right: Set<string>): Set<string> =>
  new Set([...left].filter((id) => !right.has(id)));

export function inspectionDelta(
  current: readonly KeywordInspectionResult[],
  previous: InspectionDetailRow,
): KeywordInspectionDelta | null {
  if (previous.completedAt === null) return null;
  const earlier = arrayOf<KeywordInspectionResult>(previous.results);
  const now = topTitles(current);
  const then = topTitles(earlier);
  const summary = toInspectionSummary(previous);
  return {
    inspectionId: previous.id,
    completedAt: previous.completedAt.toISOString(),
    volume: summary.volume,
    difficulty100: summary.difficulty100,
    resultCount: summary.resultCount,
    entered: titlesOf(current, minus(now, then)),
    left: titlesOf(earlier, minus(then, now)),
  };
}

export function toInspection(
  row: InspectionDetailRow,
  previous: InspectionDetailRow | null,
): KeywordInspection {
  const results = arrayOf<KeywordInspectionResult>(row.results);
  const signals = readScoreSignals(row.stats);
  const reference = row.completedAt ?? row.requestedAt;
  return {
    ...toInspectionSummary(row),
    provenance: provenanceOf(row),
    suggestReach: signals?.suggestReach ?? null,
    signals,
    competition: summarizeCompetition(results, reference),
    results,
    suggestions: arrayOf<KeywordInspectionSuggestion>(row.suggestions),
    previous: previous === null ? null : inspectionDelta(results, previous),
    failure: row.failure,
  };
}
