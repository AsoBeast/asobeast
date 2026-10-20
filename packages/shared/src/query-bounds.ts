export const COUNTRY_PATTERN = /^[a-z]{2}$/;

export const CURRENCY_PATTERN = /^[A-Z]{3}$/;

export const UTC_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isUtcCalendarDate(value: string): boolean {
  if (!UTC_DATE_PATTERN.test(value)) return false;
  const instant = Date.parse(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(instant) && new Date(instant).toISOString().startsWith(value)
  );
}

export interface QueryBound {
  min: number;
  max: number;
  default?: number;
}

export const QUERY_BOUNDS = {
  actionsLimit: { min: 1, max: 200, default: 100 },
  actionActivityDays: { min: 7, max: 90, default: 30 },
  actionBulkIds: { min: 1, max: 100, default: 100 },
  reviewsLimit: { min: 1, max: 200, default: 50 },
  reviewScore: { min: 1, max: 5 },
  suggestionsLimit: { min: 1, max: 100, default: 30 },
  storeSearchLimit: { min: 1, max: 25, default: 10 },
  recentChangesLimit: { min: 1, max: 50, default: 20 },
  serpMoverDays: { min: 1, max: 30, default: 7 },
  changeTimelineDays: { min: 1, max: 365, default: 90 },
  chartDates: { min: 1, max: 365, default: 90 },
} as const satisfies Record<string, QueryBound>;

export type QueryBoundName = keyof typeof QUERY_BOUNDS;
