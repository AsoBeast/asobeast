export type DotDirection = "left" | "right" | "up" | "down";

export interface NavDot {
  keywordId: string;
  text: string;
  difficulty: number;
  popularity: number;
  opportunity: number | null;
}

const DIRECTION_KEYS: Readonly<Record<string, DotDirection>> = {
  ArrowLeft: "left",
  ArrowRight: "right",
  ArrowUp: "up",
  ArrowDown: "down",
};

const SECONDARY_WEIGHT = 2;

const compareStrings = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;

const byTextThenId = (left: NavDot, right: NavDot): number =>
  compareStrings(left.text, right.text) ||
  compareStrings(left.keywordId, right.keywordId);

export function opportunityOrder<T extends NavDot>(dots: readonly T[]): T[] {
  return [...dots].sort(
    (left, right) =>
      (right.opportunity ?? -Infinity) - (left.opportunity ?? -Infinity) ||
      byTextThenId(left, right),
  );
}

export const entryDot = (dots: readonly NavDot[]): string | null =>
  opportunityOrder(dots)[0]?.keywordId ?? null;

export function edgeDot(
  dots: readonly NavDot[],
  edge: "first" | "last",
): string | null {
  const ordered = opportunityOrder(dots);
  const dot = edge === "first" ? ordered[0] : ordered.at(-1);
  return dot?.keywordId ?? null;
}

export const directionOfKey = (key: string): DotDirection | null =>
  Object.hasOwn(DIRECTION_KEYS, key) ? DIRECTION_KEYS[key] : null;

function stackNeighbour(
  dots: readonly NavDot[],
  from: NavDot,
  direction: DotDirection,
): string | null {
  const stack = opportunityOrder(
    dots.filter(
      (dot) =>
        dot.difficulty === from.difficulty &&
        dot.popularity === from.popularity,
    ),
  );
  const index = stack.findIndex((dot) => dot.keywordId === from.keywordId);
  const forward = direction === "right" || direction === "down";
  return stack[forward ? index + 1 : index - 1]?.keywordId ?? null;
}

function axisDistances(
  from: NavDot,
  to: NavDot,
  direction: DotDirection,
): { primary: number; secondary: number } {
  const dx = to.difficulty - from.difficulty;
  const dy = to.popularity - from.popularity;
  switch (direction) {
    case "right":
      return { primary: dx, secondary: dy };
    case "left":
      return { primary: -dx, secondary: dy };
    case "up":
      return { primary: dy, secondary: dx };
    case "down":
      return { primary: -dy, secondary: dx };
  }
}

export function neighbour(
  dots: readonly NavDot[],
  fromId: string,
  direction: DotDirection,
): string | null {
  const from = dots.find((dot) => dot.keywordId === fromId);
  if (from === undefined) return null;
  const stacked = stackNeighbour(dots, from, direction);
  if (stacked !== null) return stacked;
  let best: { dot: NavDot; score: number } | null = null;
  for (const dot of dots) {
    const { primary, secondary } = axisDistances(from, dot, direction);
    if (primary <= 0) continue;
    const score = primary + SECONDARY_WEIGHT * Math.abs(secondary);
    if (
      best === null ||
      score < best.score ||
      (score === best.score && byTextThenId(dot, best.dot) < 0)
    ) {
      best = { dot, score };
    }
  }
  return best?.dot.keywordId ?? null;
}
