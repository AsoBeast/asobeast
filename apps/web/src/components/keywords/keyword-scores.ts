import { toDifficulty100 } from "@asobeast/shared";
import type { KeywordSort, TrackedKeywordItem } from "@asobeast/shared";

export function scoreValue(
  keyword: TrackedKeywordItem,
  column: KeywordSort,
): number | null {
  switch (column) {
    case "traffic":
      return keyword.volume;
    case "difficulty":
      return keyword.difficulty === null
        ? null
        : toDifficulty100(keyword.difficulty);
    case "opportunity":
      return keyword.opportunity;
    default:
      return null;
  }
}

export const isScoreOutdated = (keyword: TrackedKeywordItem): boolean =>
  keyword.scoreOutdated === true;

export const shownScore = (value: number | null): number | null =>
  value === null ? null : Math.round(value);
