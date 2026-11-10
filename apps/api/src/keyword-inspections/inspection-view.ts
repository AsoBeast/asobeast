import {
  isScoringConfidence,
  isScoringSource,
  KEYWORD_INSPECTION_STATUSES,
  KEYWORD_WORD_MATCHES,
  KeywordInspection,
  KeywordInspectionApp,
  KeywordInspectionDelta,
  KeywordInspectionProvenance,
  KeywordInspectionResult,
  KeywordInspectionStatus,
  KeywordInspectionSuggestion,
  KeywordInspectionSummary,
  SERP_TITLE_MATCHES,
  toDifficulty100,
  toVolume,
} from '@asobeast/shared';
import { Prisma } from '@prisma/client';
import { computeOpportunity } from '../scoring/opportunity';
import { readScoreSignals } from '../scoring/score-signals';
import { staleFailureOf } from './inspection-failures';
import { COMPETITION_DEPTH, summarizeCompetition } from './inspection-results';

export const INSPECTION_SUMMARY_SELECT = {
  id: true,
  keywordId: true,
  status: true,
  requestedAt: true,
  startedAt: true,
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

function statusOf(value: string): KeywordInspectionStatus {
  return (
    KEYWORD_INSPECTION_STATUSES.find((status) => status === value) ?? 'FAILED'
  );
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
    status: staleFailureOf(row) === null ? statusOf(row.status) : 'FAILED',
    requestedAt: row.requestedAt.toISOString(),
    startedAt: row.startedAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
    volume,
    difficulty100,
    opportunity: computeOpportunity(volume, difficulty100),
    resultCount: row.resultCount,
  };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const isText = (value: unknown): value is string => typeof value === 'string';

const isNumberOrNull = (value: unknown): value is number | null =>
  value === null || isNumber(value);

const isTextOrNull = (value: unknown): value is string | null =>
  value === null || isText(value);

const isSegment = (value: unknown): boolean =>
  isRecord(value) &&
  isText(value.text) &&
  KEYWORD_WORD_MATCHES.some((match) => match === value.match);

const isResult = (value: unknown): value is KeywordInspectionResult =>
  isRecord(value) &&
  isNumber(value.position) &&
  isText(value.storeAppId) &&
  isText(value.title) &&
  isTextOrNull(value.developer) &&
  isTextOrNull(value.iconUrl) &&
  isNumberOrNull(value.ratingAvg) &&
  isNumberOrNull(value.ratingCount) &&
  isTextOrNull(value.releasedAt) &&
  isTextOrNull(value.updatedAt) &&
  SERP_TITLE_MATCHES.some((match) => match === value.titleMatch) &&
  Array.isArray(value.titleSegments) &&
  value.titleSegments.every(isSegment);

const isSuggestion = (value: unknown): value is KeywordInspectionSuggestion =>
  isRecord(value) && isNumber(value.position) && isText(value.term);

const arrayOf = <T>(
  value: Prisma.JsonValue | null,
  isItem: (item: unknown) => item is T,
): T[] =>
  Array.isArray(value)
    ? value.flatMap((item) => (isItem(item) ? [item] : []))
    : [];

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

const topIds = (results: readonly KeywordInspectionResult[]): Set<string> =>
  new Set(
    results.slice(0, COMPETITION_DEPTH).map((result) => result.storeAppId),
  );

function appsOf(
  results: readonly KeywordInspectionResult[],
  ids: ReadonlySet<string>,
): KeywordInspectionApp[] {
  return results
    .slice(0, COMPETITION_DEPTH)
    .filter((result) => ids.has(result.storeAppId))
    .map(({ storeAppId, title }) => ({ storeAppId, title }));
}

const minus = (left: Set<string>, right: Set<string>): Set<string> =>
  new Set([...left].filter((id) => !right.has(id)));

export function inspectionDelta(
  current: readonly KeywordInspectionResult[],
  previous: InspectionDetailRow,
): KeywordInspectionDelta | null {
  if (previous.completedAt === null) return null;
  const earlier = arrayOf(previous.results, isResult);
  const now = topIds(current);
  const then = topIds(earlier);
  const summary = toInspectionSummary(previous);
  return {
    inspectionId: previous.id,
    completedAt: previous.completedAt.toISOString(),
    volume: summary.volume,
    difficulty100: summary.difficulty100,
    resultCount: summary.resultCount,
    entered: appsOf(current, minus(now, then)),
    left: appsOf(earlier, minus(then, now)),
  };
}

export function toInspection(
  row: InspectionDetailRow,
  previous: InspectionDetailRow | null,
): KeywordInspection {
  const results = arrayOf(row.results, isResult);
  const signals = readScoreSignals(row.stats);
  const reference = row.completedAt ?? row.requestedAt;
  return {
    ...toInspectionSummary(row),
    provenance: provenanceOf(row),
    suggestReach: signals?.suggestReach ?? null,
    signals,
    competition: summarizeCompetition(results, reference),
    results,
    suggestions: arrayOf(row.suggestions, isSuggestion),
    previous: previous === null ? null : inspectionDelta(results, previous),
    failure: staleFailureOf(row) ?? row.failure,
  };
}
