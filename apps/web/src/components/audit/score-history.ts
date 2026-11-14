import type { AuditScorePoint } from "@asobeast/shared";

export const CHANGE_WINDOW_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

export type ScoredPoint = AuditScorePoint & { overall: number };

export function scoredPoints(points: AuditScorePoint[]): ScoredPoint[] {
  return points.filter((point): point is ScoredPoint => point.overall !== null);
}

export function weekChange(points: AuditScorePoint[]): number | null {
  const scored = scoredPoints(points);
  const current = scored.at(-1);
  if (!current) return null;
  const target = Date.parse(current.date) - CHANGE_WINDOW_DAYS * DAY_MS;
  const baseline = scored.findLast((point) => Date.parse(point.date) <= target);
  if (!baseline) return null;
  return Math.round(current.overall) - Math.round(baseline.overall);
}
