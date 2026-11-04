import type {
  AlertBatchAppSection,
  AppDelistedPayload,
  AppUnlistedMarketPayload,
  AlertBatchPayload,
  GranularAlertPayload,
  RatingDroppedPayload,
  ReviewSpikePayload,
} from '@asobeast/shared';

const occurredAt = '2026-11-03T03:10:00.000Z';
const app = { id: 'a', name: 'My App' };

export const ratingDropped = (
  overrides: Partial<RatingDroppedPayload> = {},
): RatingDroppedPayload => ({
  event: 'rating.dropped',
  occurredAt,
  app,
  country: 'us',
  from: 4.66,
  to: 4.44,
  fromCount: 1200,
  toCount: 1260,
  fromDate: '2026-10-27',
  toDate: '2026-11-03',
  dropTenths: 2,
  version: null,
  actionId: null,
  ...overrides,
});

export const reviewSpike = (
  overrides: Partial<ReviewSpikePayload> = {},
): ReviewSpikePayload => ({
  event: 'review.spike',
  occurredAt,
  app,
  date: '2026-11-02',
  count: 34,
  median: 4,
  threshold: 12,
  lowShare: 0.71,
  lowScoreMax: 2,
  topTheme: { phrase: 'crash on launch', kind: 'complaint', mentions: 9 },
  ...overrides,
});

const availabilityApp = { ...app, isCompetitor: false };

export const appDelisted = (
  overrides: Partial<AppDelistedPayload> = {},
): AppDelistedPayload => ({
  event: 'app.delisted',
  occurredAt,
  app: availabilityApp,
  store: 'APP_STORE',
  country: 'us',
  date: '2026-11-03',
  ...overrides,
});

export const appUnlistedMarket = (
  overrides: Partial<AppUnlistedMarketPayload> = {},
): AppUnlistedMarketPayload => ({
  event: 'app.unlisted_market',
  occurredAt,
  app: availabilityApp,
  store: 'APP_STORE',
  country: 'us',
  market: 'de',
  date: '2026-11-03',
  trackedKeywords: 12,
  ...overrides,
});

export const rival = { id: 'c', name: 'Rival', isCompetitor: true };

export const listingSection = (
  overrides: Partial<AlertBatchAppSection> = {},
): AlertBatchAppSection => ({
  app: { ...app, store: 'APP_STORE', country: 'us' },
  rankDrops: [],
  rankImprovements: [],
  rankMilestones: [],
  firstRankings: [],
  overtakes: [],
  serpEntrants: [],
  changes: [],
  negativeReviews: [],
  actions: [],
  competitors: [],
  ...overrides,
});

export const listingBatch = (
  section: AlertBatchAppSection,
  events: GranularAlertPayload[],
): AlertBatchPayload => ({
  event: 'alerts.batch',
  scope: 'owned_apps',
  occurredAt: '2026-11-03T04:00:00.000Z',
  window: { from: '2026-11-03T03:00:00.000Z', to: '2026-11-03T04:00:00.000Z' },
  totals: { events: events.length, apps: 1 },
  apps: [section],
  events,
});
