import type { StoreConnectionApp } from "@asobeast/shared";

const DAY_MS = 86_400_000;

const dayOf = (value: string): number => Date.parse(value.slice(0, 10));

export interface CoverageScale {
  from: string;
  to: string;
}

export interface CoverageSpan {
  days: number;
  left: number;
  width: number;
}

const syncDay = (lastSyncedAt: string) =>
  new Date(lastSyncedAt).toISOString().slice(0, 10);

export const endsOnSync = (
  scale: CoverageScale,
  lastSyncedAt: string | null,
): boolean => lastSyncedAt !== null && syncDay(lastSyncedAt) === scale.to;

const reportedRange = ({ firstDate, lastDate }: StoreConnectionApp) =>
  firstDate !== null && lastDate !== null
    ? [{ from: firstDate, to: lastDate }]
    : [];

export function coverageScale(
  apps: readonly StoreConnectionApp[],
  lastSyncedAt: string | null,
): CoverageScale | null {
  const ranges = apps.flatMap(reportedRange);
  const from = ranges
    .map((range) => range.from)
    .toSorted()
    .at(0);
  const to = [
    ...ranges.map((range) => range.to),
    ...(lastSyncedAt ? [syncDay(lastSyncedAt)] : []),
  ]
    .toSorted()
    .at(-1);
  return from !== undefined && to !== undefined ? { from, to } : null;
}

export function coverageSpan(
  app: StoreConnectionApp,
  scale: CoverageScale | null,
): CoverageSpan | null {
  if (!scale || !app.firstDate || !app.lastDate) return null;
  const start = dayOf(scale.from);
  const total = dayOf(scale.to) - start + DAY_MS;
  const first = dayOf(app.firstDate);
  const span = dayOf(app.lastDate) - first + DAY_MS;
  if (span <= 0) return null;
  return {
    days: Math.round(span / DAY_MS),
    left: ((first - start) / total) * 100,
    width: (span / total) * 100,
  };
}
