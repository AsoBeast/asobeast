import { GRADE_SCALES, grade, type Grade, type GradeMetric } from "@/lib/grade";

export type ActivityStatus = "all" | "active" | "paused";

export const POSITION_BANDS = [
  "top3",
  "top10",
  "top30",
  "beyond",
  "unranked",
] as const;

export type PositionBand = (typeof POSITION_BANDS)[number];

const [TOP3, TOP10, TOP30] = GRADE_SCALES.position.cuts;

export const POSITION_BAND_LABELS: Record<PositionBand, string> = {
  top3: `Top ${TOP3}`,
  top10: `${TOP3 + 1} to ${TOP10}`,
  top30: `${TOP10 + 1} to ${TOP30}`,
  beyond: `Beyond ${TOP30}`,
  unranked: "Not ranking",
};

export function oneOf<T>(
  value: T | undefined,
  selected: readonly T[],
): boolean {
  return value !== undefined && selected.includes(value);
}

export function statusFilter(
  row: { active: boolean },
  status: ActivityStatus,
): boolean {
  return status === "all" || row.active === (status === "active");
}

export function gradeIn(
  metric: GradeMetric,
  value: number | null,
  selected: readonly Grade[],
): boolean {
  return oneOf(grade(metric, value) ?? undefined, selected);
}

export function positionBandOf(
  position: number | null,
  depth: number | null,
): PositionBand | null {
  if (position === null) return depth === null ? null : "unranked";
  if (position <= TOP3) return "top3";
  if (position <= TOP10) return "top10";
  if (position <= TOP30) return "top30";
  return "beyond";
}

export function positionBandIn(
  position: number | null,
  depth: number | null,
  selected: readonly PositionBand[],
): boolean {
  return oneOf(positionBandOf(position, depth) ?? undefined, selected);
}

export function countBy<T, K>(
  items: readonly T[],
  key: (item: T) => K | null,
): Map<K, number> {
  const counts = new Map<K, number>();
  for (const item of items) {
    const value = key(item);
    if (value !== null) counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return counts;
}
