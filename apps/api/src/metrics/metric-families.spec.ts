import { PLAN_LIMITS, SELF_HOSTED_LIMITS } from '@asobeast/shared';
import type { InstanceMetrics } from './instance-metrics.service';
import { metricFamilies } from './metric-families';
import { instanceMetricsOf, workspaceMetricsOf } from './metrics.fixture';
import { renderMetrics } from './prometheus';
import type { WorkspaceMetrics } from './workspace-metrics.service';

const workspace: WorkspaceMetrics = {
  workspaceId: 'ws_a',
  plan: 'indie',
  limits: PLAN_LIMITS.indie,
  suspended: false,
  apps: 2,
  competitors: 4,
  keywordMarkets: 120,
  estimatedRequests: { APP_STORE: 90, GOOGLE_PLAY: 260 },
  capturedSinceTrigger: 100,
  capturedYesterday: 120,
  unresolvedSinceTrigger: 7,
  runCompletedAt: new Date('2026-08-14T03:42:00.000Z'),
  runIncomplete: true,
  storedRankings: 4_200,
  storedReviews: 310,
  onDemandUsed: { refresh: 3, runDaily: 1, score: 0, suggestions: 12 },
};

const instance: InstanceMetrics = {
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
    total: 10,
    pending: 0,
    retired: 1,
    stores: [
      {
        store: 'APP_STORE',
        endpoints: 10,
        healthy: 9,
        coolingDown: 1,
        successRate: 0.97,
        outcomes: {
          SUCCESS: 8,
          TRANSPORT: 0,
          RATE_LIMITED: 1,
          BLOCKED: 1,
          SILENT: 0,
        },
        requestsLastHour: 400,
        capacityPerHour: 8_100,
      },
    ],
    endpoints: [],
    residential: {
      configured: true,
      month: '2026-08',
      requests: 400,
      spendUsd: 1.4,
      capUsd: 20,
      fallbackRate: 0.01,
    },
    alerts: [],
  },
  proxyRequests: { DATACENTER: 12_000, RESIDENTIAL: 400 },
  workspacesByPlan: { indie: 3, free: 1 },
  subscriptionsByStatus: { active: 3 },
  trialsActive: 2,
  trials: { started: 20, converted: 9 },
  suspended: 1,
  billingEventsUnprocessed: 0,
  billingEventsFailed: 1,
};

describe('metricFamilies', () => {
  const render = (
    workspaces: WorkspaceMetrics[] = [workspace],
    overrides: Partial<InstanceMetrics> = {},
  ) => renderMetrics(metricFamilies(workspaces, { ...instance, ...overrides }));

  it('labels every workspace series with its workspace id', () => {
    const text = render();

    expect(text).toContain('asobeast_workspace_apps{workspace="ws_a"} 2');
    expect(text).toContain(
      'asobeast_workspace_keyword_markets{workspace="ws_a"} 120',
    );
    expect(text).toContain(
      'asobeast_workspace_plan_info{workspace="ws_a",plan="indie"} 1',
    );
  });

  it('splits estimated store demand by store', () => {
    const text = render();

    expect(text).toContain(
      'asobeast_workspace_daily_requests_estimated{workspace="ws_a",store="APP_STORE"} 90',
    );
    expect(text).toContain(
      'asobeast_workspace_daily_requests_estimated{workspace="ws_a",store="GOOGLE_PLAY"} 260',
    );
  });

  it('flags a run that captured fewer keywords than it tracks', () => {
    expect(render()).toContain(
      'asobeast_workspace_daily_run_incomplete{workspace="ws_a"} 1',
    );
    expect(render()).toContain(
      'asobeast_workspace_daily_run_completed_seconds{workspace="ws_a"} 1786678920',
    );
  });

  it('reports an unlimited plan limit as -1', () => {
    const text = render([
      { ...workspace, plan: 'free', limits: SELF_HOSTED_LIMITS },
    ]);

    expect(text).toContain(
      'asobeast_workspace_quota_keyword_markets_limit{workspace="ws_a"} -1',
    );
  });

  it('reports pool, spend and billing totals once for the instance', () => {
    const text = render();

    expect(text).toContain(
      'asobeast_pool_endpoints_healthy{store="APP_STORE"} 9',
    );
    expect(text).toContain(
      'asobeast_proxy_requests_month{tier="RESIDENTIAL"} 400',
    );
    expect(text).toContain('asobeast_residential_spend_usd 1.4');
    expect(text).toContain('asobeast_billing_workspaces{plan="indie"} 3');
    expect(text).toContain('asobeast_billing_trials_active 2');
    expect(text).toContain('asobeast_billing_events_failed 1');
  });

  it('keeps one series per workspace per metric', () => {
    const text = render([workspace, { ...workspace, workspaceId: 'ws_b' }]);
    const appSeries = text
      .split('\n')
      .filter((line) => line.startsWith('asobeast_workspace_apps{'));

    expect(appSeries).toHaveLength(2);
  });

  it('reports an unmeasured success rate as fully healthy', () => {
    const text = render([workspace], {
      pool: {
        ...instance.pool,
        stores: [{ ...instance.pool.stores[0], successRate: null }],
      },
    });

    expect(text).toContain('asobeast_pool_success_rate{store="APP_STORE"} 1');
  });
});

describe('metricFamilies on the backup schedule', () => {
  const familyOf = (name: string, instance: InstanceMetrics) =>
    metricFamilies([workspaceMetricsOf()], instance).find(
      (family) => family.name === name,
    );

  it('reports no completion time when nothing has reported in', () => {
    expect(
      familyOf(
        'asobeast_backup_last_completed_seconds',
        instanceMetricsOf({
          backup: { lastCompletedAt: null, maxAgeHours: 24 },
        }),
      )?.samples,
    ).toEqual([{ value: 0 }]);
  });

  it('reports the completion time in whole seconds', () => {
    expect(
      familyOf(
        'asobeast_backup_last_completed_seconds',
        instanceMetricsOf({
          backup: {
            lastCompletedAt: new Date('2026-08-20T02:00:00.500Z'),
            maxAgeHours: 24,
          },
        }),
      )?.samples,
    ).toEqual([{ value: 1787191200 }]);
  });

  it('reports the window an operator declared', () => {
    expect(
      familyOf(
        'asobeast_backup_max_age_hours',
        instanceMetricsOf({
          backup: { lastCompletedAt: null, maxAgeHours: 36 },
        }),
      )?.samples,
    ).toEqual([{ value: 36 }]);
  });
});

describe('metricFamilies on host resources', () => {
  const namesOf = (resources: InstanceMetrics['resources']) =>
    metricFamilies(
      [workspaceMetricsOf()],
      instanceMetricsOf({ resources }),
    ).map((family) => family.name);

  const valueOf = (name: string, resources: InstanceMetrics['resources']) =>
    metricFamilies([workspaceMetricsOf()], instanceMetricsOf({ resources }))
      .find((family) => family.name === name)
      ?.samples.at(0)?.value;

  const measured: InstanceMetrics['resources'] = {
    databaseBytes: 11_534_336,
    diskBudgetBytes: 500_000_000,
    redisUsedBytes: 10_485_760,
    redisMaxBytes: 201_326_592,
  };

  it('reports every reading it took', () => {
    expect(valueOf('asobeast_database_bytes', measured)).toBe(11_534_336);
    expect(valueOf('asobeast_disk_budget_bytes', measured)).toBe(500_000_000);
    expect(valueOf('asobeast_queue_memory_bytes', measured)).toBe(10_485_760);
    expect(valueOf('asobeast_queue_memory_max_bytes', measured)).toBe(
      201_326_592,
    );
  });

  it('omits a family it could not measure rather than reporting zero', () => {
    const names = namesOf({
      ...measured,
      databaseBytes: null,
      redisUsedBytes: null,
    });

    expect(names).not.toContain('asobeast_database_bytes');
    expect(names).not.toContain('asobeast_queue_memory_bytes');
    expect(names).toContain('asobeast_queue_memory_max_bytes');
    expect(names).toContain('asobeast_disk_budget_bytes');
  });

  it('keeps reporting an undeclared budget, so the zero is visible', () => {
    expect(
      valueOf('asobeast_disk_budget_bytes', {
        ...measured,
        diskBudgetBytes: 0,
      }),
    ).toBe(0);
  });
});

describe('store canary family', () => {
  const canaryOf = (storeCanary: InstanceMetrics['storeCanary']) =>
    metricFamilies([], instanceMetricsOf({ storeCanary })).find(
      (family) => family.name === 'asobeast_store_canary',
    );

  const brokenRecord = {
    outcome: 'broken' as const,
    detail: 'parsed app is missing title',
    checkedAt: '2026-08-28T02:00:00.000Z',
    failingSince: '2026-08-28T02:00:00.000Z',
    consecutiveFailures: 1,
  };

  it('carries the outcome as a label rather than a value', () => {
    const family = canaryOf({
      APP_STORE: brokenRecord,
      GOOGLE_PLAY: { ...brokenRecord, outcome: 'ok', detail: null },
    });

    expect(family?.samples).toEqual([
      { labels: { store: 'APP_STORE', outcome: 'broken' }, value: 1 },
      { labels: { store: 'GOOGLE_PLAY', outcome: 'ok' }, value: 1 },
    ]);
  });

  it('reports nothing for a store the canary has not answered for', () => {
    expect(canaryOf({})?.samples).toEqual([]);
    expect(canaryOf({ APP_STORE: brokenRecord })?.samples).toHaveLength(1);
  });
});
