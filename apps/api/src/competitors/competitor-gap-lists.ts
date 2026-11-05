import {
  CompetitorGapCoverage,
  CompetitorGapKeyword,
  CompetitorGapMarket,
  CompetitorGaps,
  GAP_TOP,
  GAP_YOU_BELOW,
  KeywordComparisonRow,
  TrackedKeywordItem,
  WINNABLE_COMPETITOR_FROM,
} from '@asobeast/shared';
import { BestCompetitor, bestCompetitor, gapKeyword } from './competitor-gaps';
import { CheckSeries, strongestThreat } from './competitor-threats';

export interface GapCompetitor {
  id: string;
  delisted: boolean;
}

export interface GapRow {
  row: KeywordComparisonRow;
  item: TrackedKeywordItem | undefined;
}

export interface GapScope {
  primaryId: string;
  competitors: readonly GapCompetitor[];
}

export const comparable = (scope: GapScope): GapCompetitor[] =>
  scope.competitors.filter((competitor) => !competitor.delisted);

const wasChecked = (row: KeywordComparisonRow, id: string): boolean =>
  !(row.unchecked ?? []).includes(id);

export const checkedRows = (
  rows: readonly GapRow[],
  scope: GapScope,
): GapRow[] => rows.filter(({ row }) => wasChecked(row, scope.primaryId));

export const bestComparable = (
  row: KeywordComparisonRow,
  scope: GapScope,
): BestCompetitor | undefined =>
  bestCompetitor(
    row,
    comparable(scope).filter((competitor) => wasChecked(row, competitor.id)),
  );

export const isKeywordGap = (
  you: number | null,
  best: BestCompetitor | undefined,
): best is BestCompetitor =>
  best !== undefined &&
  best.position <= GAP_TOP &&
  (you === null || you > GAP_YOU_BELOW);

export const isWinnable = (gap: CompetitorGapKeyword): boolean =>
  (gap.difficulty !== null &&
    gap.volume !== null &&
    gap.difficulty < gap.volume) ||
  (gap.bestCompetitorPosition !== null &&
    gap.bestCompetitorPosition >= WINNABLE_COMPETITOR_FROM);

export function isLead(
  row: KeywordComparisonRow,
  scope: GapScope,
  best: BestCompetitor | undefined,
): row is KeywordComparisonRow & { you: number } {
  const competitors = comparable(scope);
  return (
    row.you !== null &&
    competitors.length > 0 &&
    competitors.every((competitor) => wasChecked(row, competitor.id)) &&
    (best === undefined || row.you < best.position)
  );
}

const descending = (x: number | null, y: number | null): number =>
  (y ?? -1) - (x ?? -1);

export const byOpportunity = (
  a: CompetitorGapKeyword,
  b: CompetitorGapKeyword,
): number =>
  descending(a.opportunity, b.opportunity) ||
  descending(a.volume, b.volume) ||
  a.text.localeCompare(b.text);

export const gapRow = (
  entry: GapRow,
  best: BestCompetitor | undefined,
  gap: number | null,
): CompetitorGapKeyword => ({
  ...gapKeyword(entry.row, entry.item, best, gap),
  country: entry.row.country,
  lastCheckedOn: entry.item?.latestCheckedOn ?? null,
});

export function keywordGapsOf(
  rows: readonly GapRow[],
  scope: GapScope,
): CompetitorGapKeyword[] {
  return checkedRows(rows, scope)
    .flatMap((entry) => {
      const best = bestComparable(entry.row, scope);
      return isKeywordGap(entry.row.you, best)
        ? [gapRow(entry, best, null)]
        : [];
    })
    .sort(byOpportunity);
}

export const winnableOf = (
  gaps: readonly CompetitorGapKeyword[],
): CompetitorGapKeyword[] => gaps.filter(isWinnable);

export function leadsOf(
  rows: readonly GapRow[],
  scope: GapScope,
): CompetitorGapKeyword[] {
  return checkedRows(rows, scope)
    .flatMap((entry) => {
      const best = bestComparable(entry.row, scope);
      if (!isLead(entry.row, scope, best)) return [];
      const margin = best === undefined ? null : best.position - entry.row.you;
      return [gapRow(entry, best, margin)];
    })
    .sort(byOpportunity);
}

export function gapCoverage(
  rows: readonly GapRow[],
  scope: GapScope,
): CompetitorGapCoverage {
  const competitors = comparable(scope);
  const markets = new Map<string, CompetitorGapMarket>();
  for (const { row } of rows) {
    const market = markets.get(row.country) ?? {
      country: row.country,
      keywords: 0,
      compared: 0,
    };
    market.keywords += 1;
    const compared =
      wasChecked(row, scope.primaryId) &&
      competitors.some((competitor) => wasChecked(row, competitor.id));
    if (compared) market.compared += 1;
    markets.set(row.country, market);
  }
  return {
    competitors: competitors.length,
    delisted: scope.competitors.length - competitors.length,
    markets: [...markets.values()].sort((a, b) =>
      a.country.localeCompare(b.country),
    ),
  };
}

export type RecentChecks = ReadonlyMap<
  string,
  ReadonlyMap<string, CheckSeries>
>;

export interface ThreatReadScope {
  appIds: string[];
  keywordIds: string[];
}

export const threatReadScope = (
  rows: readonly GapRow[],
  scope: GapScope,
): ThreatReadScope => ({
  appIds: [scope.primaryId, ...comparable(scope).map(({ id }) => id)],
  keywordIds: checkedRows(rows, scope)
    .filter(({ row }) => row.you !== null && row.you <= GAP_TOP)
    .map(({ row }) => row.keywordId),
});

export function threatRows(
  rows: readonly GapRow[],
  scope: GapScope,
  recent: RecentChecks,
  today: string,
): CompetitorGapKeyword[] {
  const rivals = comparable(scope);
  return checkedRows(rows, scope)
    .flatMap((entry) => {
      const checks = recent.get(entry.row.keywordId);
      const threat = strongestThreat({
        you: checks?.get(scope.primaryId) ?? [],
        rivals: rivals.map(({ id }) => ({ id, series: checks?.get(id) ?? [] })),
        today,
      });
      if (threat === null) return [];
      const best = {
        id: threat.competitorId,
        position: threat.competitorPosition,
      };
      return [
        {
          ...gapRow(entry, best, null),
          threat: threat.kind,
          competitorDelta: threat.competitorDelta,
          overtookOn: threat.overtookOn,
        },
      ];
    })
    .sort(byOpportunity);
}

export interface GapListsInput {
  scope: GapScope;
  rows: readonly GapRow[];
  recent: RecentChecks;
  today: string;
}

export type GapLists = Required<
  Pick<
    CompetitorGaps,
    'keywordGaps' | 'winnable' | 'threats' | 'lead' | 'coverage'
  >
>;

export function competitorGapLists({
  scope,
  rows,
  recent,
  today,
}: GapListsInput): GapLists {
  const keywordGaps = keywordGapsOf(rows, scope);
  return {
    keywordGaps,
    winnable: winnableOf(keywordGaps),
    threats: threatRows(rows, scope, recent, today),
    lead: leadsOf(rows, scope),
    coverage: gapCoverage(rows, scope),
  };
}
