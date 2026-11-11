import type { TrackedKeywordItem } from "@asobeast/shared";
import { isCheckFresh } from "@asobeast/shared";

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
    .filter(
      (row) =>
        row.active &&
        typeof row.latestCheckedOn === "string" &&
        isCheckFresh(row.latestCheckedOn, today),
    )
    .map((row) => row.positionDelta1d ?? 0);
  return {
    up: deltas.filter((delta) => delta < 0).length,
    down: deltas.filter((delta) => delta > 0).length,
  };
}

export function movesSentence({ up, down }: KeywordMoves): string {
  if (up === 0 && down === 0) return "No ranked keyword moved since yesterday.";
  const parts = [
    ...(up > 0 ? [`${up} moved up`] : []),
    ...(down > 0 ? [`${down} moved down`] : []),
  ];
  return `${parts.join(" and ")} since yesterday.`;
}
