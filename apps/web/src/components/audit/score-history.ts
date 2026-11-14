import type { AuditScorePoint } from "@asobeast/shared";

export const CHANGE_WINDOW_DAYS = 7;

const BASELINE_SLACK_DAYS = 6;
const DAY_MS = 24 * 60 * 60 * 1000;

export type ScoredPoint = AuditScorePoint & { overall: number };

export interface CurrentScore {
  overall: number | null;
  generatedAt: string;
}

export function scoredPoints(points: AuditScorePoint[]): ScoredPoint[] {
  return points.filter((point): point is ScoredPoint => point.overall !== null);
}

const utcDay = (instant: string): number =>
  Date.parse(new Date(instant).toISOString().slice(0, 10));

export function weekChange(
  points: AuditScorePoint[],
  current: CurrentScore,
): number | null {
  if (current.overall === null) return null;
  const newest = utcDay(current.generatedAt) - CHANGE_WINDOW_DAYS * DAY_MS;
  const oldest = newest - BASELINE_SLACK_DAYS * DAY_MS;
  const baseline = scoredPoints(points).findLast(
    (point) => Date.parse(point.date) <= newest,
  );
  if (!baseline || Date.parse(baseline.date) < oldest) return null;
  return Math.round(current.overall) - Math.round(baseline.overall);
}
