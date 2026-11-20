export const DAY_MS = 24 * 60 * 60 * 1000;

export interface Metric {
  traffic: number | null;
  difficulty: number | null;
  date: Date;
  formulaVersion?: string | null;
}

export interface Ranking {
  position: number | null;
  date: Date;
  depth: number;
}

export const addDays = (date: Date, days: number): Date =>
  new Date(date.getTime() + days * DAY_MS);

export const startOfUtcDay = (date: Date): Date =>
  new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );

export const utcToday = (): Date => startOfUtcDay(new Date());

export const toDateKey = (date: Date): string =>
  date.toISOString().slice(0, 10);

export const isSameDay = (a: Date, b: Date): boolean =>
  a.getTime() === b.getTime();

export const rankingAt = (rankings: Ranking[], date: Date): Ranking | null =>
  rankings.find((ranking) => isSameDay(ranking.date, date)) ?? null;

export const positionAt = (rankings: Ranking[], date: Date): number | null =>
  rankingAt(rankings, date)?.position ?? null;

export const metricAt = (metrics: Metric[], date: Date): Metric | null =>
  metrics.find((metric) => metric.date.getTime() <= date.getTime()) ?? null;
