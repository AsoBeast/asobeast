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
  competitors: [],
  competitorChanges: [],
  competitorRankingDays: new Map(),
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

const SAMPLE_NOW = Date.UTC(2026, 6, 30);

const sampleDay = (offset: number): string =>
  new Date(SAMPLE_NOW - offset * 86_400_000).toISOString().slice(0, 10);

export const ruleSampleContext = (): ActionContext =>
  actionContext([
    contextApp({
      trackedKeywords: [
        trackedKeyword({
          keywordId: 'kw_push',
          text: 'habit tracker',
          latestPosition: 12,
          volume: 60,
          relevance: 80,
          opportunity: 44,
        }),
        trackedKeyword({
          keywordId: 'kw_new',
          text: 'focus timer',
          volume: 70,
          relevance: 90,
          opportunity: 72,
          scoreProvenance: {
            source: 'APPLE_SUGGEST_SEARCH',
            formulaVersion: 'app-store-v1',
            capturedAt: sampleDay(1),
            confidence: 'HIGH',
          },
        }),
      ],
      coverage: [
        {
          keywordId: 'kw_push',
          text: 'habit tracker',
          bucket: null,
          uncovered: false,
          fields: [
            { field: 'title', covered: false },
            { field: 'subtitle', covered: false },
            { field: 'keywordField', covered: true },
          ],
        },
        {
          keywordId: 'kw_new',
          text: 'focus timer',
          bucket: null,
          uncovered: true,
          fields: [
            { field: 'title', covered: false },
            { field: 'subtitle', covered: false },
          ],
        },
      ],
      metadataFields: [
        {
          field: 'title',
          value: 'Habit Tracker and Daily Planner!',
          chars: 32,
          limit: 30,
          indexed: true,
          issues: [
            {
              rule: 'over-limit',
              severity: 'error',
              message: 'Exceeds the 30 character limit (32).',
            },
          ],
        },
      ],
      rankingDaysByKeyword: new Map([
        [
          'kw_push',
          [22, 14, 13, 12, 12, 12, 12].map((position, index) => ({
            date: sampleDay(6 - index),
            position,
          })),
        ],
      ]),
    }),
  ]);
