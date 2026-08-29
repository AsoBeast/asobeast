import { PLAN_LIMITS } from '@asobeast/shared';
import type { InstanceMetrics } from './instance-metrics.service';
import type { WorkspaceMetrics } from './workspace-metrics.service';

export function workspaceMetricsOf(
  overrides: Partial<WorkspaceMetrics> = {},
): WorkspaceMetrics {
  return {
    workspaceId: 'ws_a',
    plan: 'indie',
    limits: PLAN_LIMITS.indie,
    suspended: false,
    apps: 1,
    competitors: 0,
    keywordMarkets: 100,
    estimatedRequests: { APP_STORE: 100, GOOGLE_PLAY: 0 },
    capturedSinceTrigger: 100,
    capturedYesterday: 100,
    unresolvedSinceTrigger: 0,
    runCompletedAt: new Date('2026-08-14T03:10:00.000Z'),
    runIncomplete: false,
    storedRankings: 1_000,
    storedReviews: 10,
    onDemandUsed: { refresh: 0, runDaily: 0, score: 0, suggestions: 0 },
    ...overrides,
  };
}

export function instanceMetricsOf(
  overrides: Partial<InstanceMetrics> = {},
): InstanceMetrics {
  return {
    redisAvailable: true,
    backup: { lastCompletedAt: null, maxAgeHours: 0 },
    accountMail: { delivered: 0, failed: 0, skipped: 0 },
    storeCanary: {},
    resources: {
      databaseBytes: 11_534_336,
      diskBudgetBytes: 0,
      redisUsedBytes: 10_485_760,
      redisMaxBytes: 201_326_592,
    },
    pool: {
      enabled: true,
      provider: 'webshare',
      total: 4,
      pending: 0,
      retired: 0,
      stores: [
        {
          store: 'APP_STORE',
          endpoints: 4,
          healthy: 4,
          coolingDown: 0,
          successRate: 0.99,
          outcomes: {
            SUCCESS: 4,
            TRANSPORT: 0,
            RATE_LIMITED: 0,
            BLOCKED: 0,
            SILENT: 0,
          },
          requestsLastHour: 100,
          capacityPerHour: 1_000,
        },
      ],
      endpoints: [],
      residential: {
        configured: false,
        month: '2026-08',
        requests: 0,
        spendUsd: 0,
        capUsd: 0,
        fallbackRate: 0,
      },
      alerts: [],
    },
    proxyRequests: { DATACENTER: 100, RESIDENTIAL: 0 },
    workspacesByPlan: { indie: 1 },
    subscriptionsByStatus: { active: 1 },
    trialsActive: 0,
    trials: { started: 0, converted: 0 },
    suspended: 0,
    billingEventsUnprocessed: 0,
    billingEventsFailed: 0,
    ...overrides,
  };
}
