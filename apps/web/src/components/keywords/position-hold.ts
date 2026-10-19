import type { TrackedKeywordItem } from "@asobeast/shared";

export function positionHoldLines(keyword: TrackedKeywordItem): string[] {
  const best = keyword.bestPosition ?? null;
  const delta = keyword.positionDeltaFromBest ?? null;
  const held = keyword.daysInTier ?? null;
  const tier = keyword.heldTier ?? null;

  const lines: string[] = [];
  if (best !== null) {
    lines.push(`Best position: ${best}`);
  }
  if (delta !== null) {
    lines.push(
      delta === 0
        ? "At its best position"
        : `${delta} ${delta === 1 ? "place" : "places"} below its best`,
    );
  }
  if (held !== null && tier !== null) {
    lines.push(
      `Held in the top ${tier} for ${held} ${held === 1 ? "day" : "days"}`,
    );
  }
  return lines;
}
