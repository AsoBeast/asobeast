import {
  CompetitorGapKeyword,
  CompetitorGaps,
  KeywordComparison,
  KeywordComparisonRow,
  TrackedKeywordItem,
} from '@asobeast/shared';
import { toDifficulty100 } from '../scoring/formulas';

export interface BestCompetitor {
  id: string;
  position: number;
}

export function bestCompetitor(
  row: KeywordComparisonRow,
  competitors: readonly { id: string }[],
): BestCompetitor | undefined {
  return competitors
    .map(({ id }) => ({ id, position: row.positions[id] ?? null }))
    .filter((entry): entry is BestCompetitor => entry.position !== null)
    .sort((a, b) => a.position - b.position)[0];
}

export function gapKeyword(
  row: KeywordComparisonRow,
  item: TrackedKeywordItem | undefined,
  best: BestCompetitor | undefined,
  gap: number | null,
): CompetitorGapKeyword {
  return {
    keywordId: row.keywordId,
    text: row.text,
    volume: item?.volume ?? null,
    difficulty:
      row.difficulty === null ? null : toDifficulty100(row.difficulty),
    opportunity: item?.opportunity ?? null,
    yourPosition: row.you,
    bestCompetitorPosition: best?.position ?? null,
    bestCompetitorId: best?.id ?? null,
    gap,
  };
}

export function existingGapLists(
  comparison: KeywordComparison,
  tracked: ReadonlyMap<string, TrackedKeywordItem>,
): CompetitorGaps {
  const theyRankYouDont: CompetitorGapKeyword[] = [];
  const youRankTheyDont: CompetitorGapKeyword[] = [];
  const outranked: CompetitorGapKeyword[] = [];

  for (const row of comparison.rows) {
    const best = bestCompetitor(row, comparison.competitors);
    const item = tracked.get(row.keywordId);

    if (row.you === null && best) {
      theyRankYouDont.push(gapKeyword(row, item, best, null));
    } else if (row.you !== null && !best) {
      youRankTheyDont.push(gapKeyword(row, item, best, null));
    } else if (row.you !== null && best && row.you > best.position) {
      outranked.push(gapKeyword(row, item, best, row.you - best.position));
    }
  }

  theyRankYouDont.sort((a, b) => (b.opportunity ?? 0) - (a.opportunity ?? 0));
  return { theyRankYouDont, youRankTheyDont, outranked };
}
