import type { TrackedKeywordItem } from "@asobeast/shared";
import { staleCheckDay } from "@/lib/keyword-checks";

export interface KeywordMoves {
  up: number;
  down: number;
}

type MovedRow = Pick<
  TrackedKeywordItem,
  "active" | "latestCheckedOn" | "positionDelta1d"
>;

export function keywordMoves(
  rows: readonly MovedRow[],
  today: string,
): KeywordMoves {
  const deltas = rows
    .filter((row) => staleCheckDay(row, today) === null)
    .map((row) => row.positionDelta1d ?? 0);
  return {
    up: deltas.filter((delta) => delta < 0).length,
    down: deltas.filter((delta) => delta > 0).length,
  };
}

export function movesSentence({ up, down }: KeywordMoves): string {
  if (up === 0 && down === 0) return "No position moved since yesterday.";
  const parts = [
    ...(up > 0 ? [`${up} moved up`] : []),
    ...(down > 0 ? [`${down} moved down`] : []),
  ];
  return `${parts.join(" and ")} since yesterday.`;
}
