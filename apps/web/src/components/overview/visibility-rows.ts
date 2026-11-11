import type { VisibilityPoint } from "@asobeast/shared";
import { dayBefore } from "@/lib/utc-day";

export interface VisibilityRow extends VisibilityPoint {
  previous: number | null;
}

export function previousRange(
  range: { from: string; to: string },
  days: number,
): { from: string; to: string } {
  return { from: dayBefore(range.from, days), to: dayBefore(range.to, days) };
}

export function withPrevious(
  points: readonly VisibilityPoint[],
  earlier: readonly VisibilityPoint[],
  days: number,
): VisibilityRow[] {
  const before = new Map(
    earlier.map((point) => [point.date, point.visibility]),
  );
  return points.map((point) => ({
    ...point,
    previous: before.get(dayBefore(point.date, days)) ?? null,
  }));
}
