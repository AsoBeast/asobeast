import type { DailyBudget, TrackedKeywordItem } from '@asobeast/shared';
import type { ActionContext, ActionContextApp } from '../action-context';

export const dailyBudget = (
  overrides: Partial<DailyBudget> = {},
): DailyBudget => ({
  apps: 1,
  keywords: 10,
  categories: 0,
  reviews: 1,
  total: 12,
  capacityPerDay: 100,
  utilization: 0.12,
  stores: [],
  quota: null,
  completion: { startsAt: null, completesAt: null, hours: null },
  ...overrides,
});

export const trackedKeyword = (
  overrides: Partial<TrackedKeywordItem> = {},
): TrackedKeywordItem => ({
  keywordId: 'kw_1',
  text: 'budget planner',
  country: 'us',
  source: 'MANUAL',
  active: true,
  latestPosition: null,
  latestDepth: null,
  previousPosition: null,
  positionDelta1d: null,
  positionDelta7d: null,
  traffic: null,
  difficulty: null,
  volume: null,
  relevance: null,
  opportunity: null,
  bucket: null,
  scoredAt: null,
  scoreProvenance: null,
  serpVolatility7d: null,
  ...overrides,
});

export const contextApp = (
  overrides: Partial<ActionContextApp> = {},
): ActionContextApp => ({
  id: 'app_1',
  name: 'Budget',
  store: 'APP_STORE',
  storeAppId: 'own-app',
  country: 'us',
  trackedKeywords: [],
  keywordsByCountry: new Map(),
  coverage: [],
  metadataFields: [],
  audit: null,
  changeEvents: [],
  visibilityByCountry: new Map(),
  rankingDaysByKeyword: new Map(),
  serpDaysByKeyword: new Map(),
  volatilityByKeyword: new Map(),
  competitorAppIdsByStoreAppId: new Map(),
  reviews: [],
  latestVersion: null,
  previousVersion: null,
  ...overrides,
});

export const actionContext = (
  apps: ActionContextApp[],
  overrides: Partial<Omit<ActionContext, 'apps'>> = {},
): ActionContext => ({
  workspaceId: 'ws_1',
  apps,
  budget: dailyBudget(),
  reviewScoreMax: 2,
  rankDropThreshold: 5,
  ...overrides,
});
