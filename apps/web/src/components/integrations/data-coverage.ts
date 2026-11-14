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

const reported = (app: StoreConnectionApp) =>
  app.firstDate !== null && app.lastDate !== null;

export function coverageScale(
  apps: readonly StoreConnectionApp[],
  lastSyncedAt: string | null,
): CoverageScale | null {
  const firsts = apps.flatMap((app) => (reported(app) ? [app.firstDate!] : []));
  const lasts = apps.flatMap((app) => (reported(app) ? [app.lastDate!] : []));
  if (firsts.length === 0) return null;
  const ends = lastSyncedAt ? [...lasts, lastSyncedAt.slice(0, 10)] : lasts;
  return { from: firsts.toSorted()[0], to: ends.toSorted().at(-1)! };
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
