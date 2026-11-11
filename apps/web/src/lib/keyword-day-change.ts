import { addUtcDays, type TrackedKeywordItem } from "@asobeast/shared";
import { formatList } from "./format";
import { staleCheckDay } from "./keyword-checks";

export type DayChange =
  | { kind: "lost" }
  | { kind: "entered" }
  | { kind: "moved"; places: number }
  | { kind: "steady" };

export type DayChangeRow = Pick<
  TrackedKeywordItem,
  | "active"
  | "latestPosition"
  | "latestDepth"
  | "latestCheckedOn"
  | "previousPosition"
  | "positionDelta1d"
  | "recentPositions"
>;

const LOST: DayChange = { kind: "lost" };
const ENTERED: DayChange = { kind: "entered" };
const STEADY: DayChange = { kind: "steady" };

function wasNotFoundTheDayBefore(row: DayChangeRow): boolean {
  const latest = row.recentPositions?.at(-1);
  const before = row.recentPositions?.at(-2);
  return (
    latest !== undefined &&
    before?.position === null &&
    before.date === addUtcDays(latest.date, -1)
  );
}

export function dayChange(row: DayChangeRow, today: string): DayChange | null {
  if (row.latestDepth === null || staleCheckDay(row, today) !== null) {
    return null;
  }
  if (row.latestPosition === null) {
    return row.previousPosition === null ? null : LOST;
  }
  if (row.previousPosition === null) {
    return wasNotFoundTheDayBefore(row) ? ENTERED : null;
  }
  const places =
    row.positionDelta1d ?? row.latestPosition - row.previousPosition;
  return places === 0 ? STEADY : { kind: "moved", places };
}

export const countedDayChange = (
  row: DayChangeRow,
  today: string,
): DayChange | null => (row.active ? dayChange(row, today) : null);

const EDGE_RANK = 1000;

export function dayChangeRank(change: DayChange | null): number | null {
  if (change === null) return null;
  if (change.kind === "lost") return EDGE_RANK;
  if (change.kind === "entered") return -EDGE_RANK;
  return change.kind === "moved" ? change.places : 0;
}

export const KEYWORD_MOVE_FILTERS = ["moved", "fell", "lost"] as const;
export type KeywordMoveFilter = (typeof KEYWORD_MOVE_FILTERS)[number];

export const MOVE_FILTER_LABELS: Record<KeywordMoveFilter, string> = {
  moved: "Moved",
  fell: "Fell",
  lost: "Lost",
};

const MOVE_FILTER_TESTS: Record<
  KeywordMoveFilter,
  (change: DayChange) => boolean
> = {
  moved: (change) => change.kind !== "steady",
  fell: (change) =>
    change.kind === "lost" || (change.kind === "moved" && change.places > 0),
  lost: (change) => change.kind === "lost",
};

export const matchesMoveFilter = (
  row: DayChangeRow,
  today: string,
  filter: KeywordMoveFilter,
): boolean => {
  const change = countedDayChange(row, today);
  return change !== null && MOVE_FILTER_TESTS[filter](change);
};

export interface KeywordMoves {
  compared: number;
  up: number;
  down: number;
  lost: number;
  entered: number;
}

export function keywordMoves(
  rows: readonly DayChangeRow[],
  today: string,
): KeywordMoves {
  const moves: KeywordMoves = {
    compared: 0,
    up: 0,
    down: 0,
    lost: 0,
    entered: 0,
  };
  for (const row of rows) {
    const change = countedDayChange(row, today);
    if (change === null) continue;
    moves.compared += 1;
    if (change.kind === "steady") continue;
    if (change.kind === "moved") moves[change.places < 0 ? "up" : "down"] += 1;
    else moves[change.kind] += 1;
  }
  return moves;
}

export function movesSentence({
  compared,
  up,
  down,
  lost,
  entered,
}: KeywordMoves): string | null {
  if (compared === 0) return null;
  const parts = [
    ...(up > 0 ? [`${up} moved up`] : []),
    ...(down > 0 ? [`${down} moved down`] : []),
    ...(lost > 0 ? [`${lost} dropped out`] : []),
    ...(entered > 0 ? [`${entered} entered the results`] : []),
  ];
  return parts.length === 0
    ? "No keyword moved since yesterday."
    : `${formatList(parts)} since yesterday.`;
}
