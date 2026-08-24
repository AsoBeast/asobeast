export const COUNTRY_PATTERN = /^[a-z]{2}$/;

export const UTC_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export interface QueryBound {
  min: number;
  max: number;
  default?: number;
}

export const QUERY_BOUNDS = {
  actionsLimit: { min: 1, max: 200, default: 100 },
  reviewsLimit: { min: 1, max: 200, default: 50 },
  reviewScore: { min: 1, max: 5 },
  suggestionsLimit: { min: 1, max: 100, default: 30 },
  recentChangesLimit: { min: 1, max: 50, default: 20 },
  serpMoverDays: { min: 1, max: 30, default: 7 },
  changeTimelineDays: { min: 1, max: 365, default: 90 },
} as const satisfies Record<string, QueryBound>;

export type QueryBoundName = keyof typeof QUERY_BOUNDS;
