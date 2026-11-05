import {
  KEYWORD_INSPECTION_RESULT_DEPTH,
  KEYWORD_INSPECTION_SUGGESTION_LIMIT,
  KeywordInspectionCompetition,
  KeywordInspectionResult,
  KeywordInspectionSuggestion,
  KeywordInspectionTitleMatch,
  searchKey,
} from '@asobeast/shared';
import {
  EVIDENCE_ALL_WORDS,
  EVIDENCE_EXACT,
  titleEvidence,
} from '../scoring/serp-signals';
import { SearchItem, SuggestItem } from '../store-providers/types';

export const COMPETITION_DEPTH = 10;
export const HEAVYWEIGHT_RATINGS = 100_000;
export const FRESH_UPDATE_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

export function titleMatchOf(
  title: string,
  keyword: string,
): KeywordInspectionTitleMatch {
  const evidence = titleEvidence(title, keyword);
  if (evidence >= EVIDENCE_EXACT) return 'exact';
  if (evidence >= EVIDENCE_ALL_WORDS) return 'allWords';
  return evidence > 0 ? 'someWords' : 'none';
}

export function toInspectionResults(
  items: readonly SearchItem[],
  keyword: string,
): KeywordInspectionResult[] {
  return items.slice(0, KEYWORD_INSPECTION_RESULT_DEPTH).map((item, index) => ({
    position: index + 1,
    storeAppId: item.storeAppId,
    title: item.title,
    developer: item.developer ?? null,
    iconUrl: item.iconUrl ?? null,
    ratingAvg: item.ratingAvg ?? null,
    ratingCount: item.ratingCount ?? null,
    releasedAt: item.releasedAt?.toISOString() ?? null,
    updatedAt: item.updatedAt?.toISOString() ?? null,
    titleMatch: titleMatchOf(item.title, keyword),
  }));
}

export function toInspectionSuggestions(
  items: readonly SuggestItem[],
): KeywordInspectionSuggestion[] {
  const seen = new Set<string>();
  const suggestions: KeywordInspectionSuggestion[] = [];
  for (const item of items) {
    const key = searchKey(item.term);
    if (key.length === 0 || seen.has(key)) continue;
    seen.add(key);
    suggestions.push({ position: suggestions.length + 1, term: item.term });
    if (suggestions.length === KEYWORD_INSPECTION_SUGGESTION_LIMIT) break;
  }
  return suggestions;
}

function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function mean(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

const present = (values: readonly (number | null)[]): number[] =>
  values.filter((value): value is number => value !== null);

function daysSince(iso: string | null, now: Date): number | null {
  if (iso === null) return null;
  return Math.max(
    0,
    Math.floor((now.getTime() - new Date(iso).getTime()) / DAY_MS),
  );
}

export function summarizeCompetition(
  results: readonly KeywordInspectionResult[],
  now: Date,
): KeywordInspectionCompetition | null {
  const top = results.slice(0, COMPETITION_DEPTH);
  if (top.length === 0) return null;
  const ratings = present(top.map((result) => result.ratingCount));
  const averages = present(top.map((result) => result.ratingAvg));
  const updateAges = present(
    top.map((result) => daysSince(result.updatedAt, now)),
  );
  const rounded = (value: number | null, digits: number): number | null =>
    value === null ? null : Number(value.toFixed(digits));
  return {
    topCount: top.length,
    medianRatingCount: rounded(median(ratings), 0),
    strongestRatingCount: ratings.length === 0 ? null : Math.max(...ratings),
    averageRating: rounded(mean(averages), 2),
    exactTitleMatches: top.filter((result) => result.titleMatch === 'exact')
      .length,
    titleMatches: top.filter(
      (result) =>
        result.titleMatch === 'exact' || result.titleMatch === 'allWords',
    ).length,
    appsOverHundredThousandRatings: ratings.filter(
      (count) => count >= HEAVYWEIGHT_RATINGS,
    ).length,
    medianDaysSinceUpdate: rounded(median(updateAges), 0),
    freshlyUpdated: updateAges.filter((days) => days <= FRESH_UPDATE_DAYS)
      .length,
  };
}
