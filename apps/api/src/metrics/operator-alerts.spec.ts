import type { InstanceMetrics } from './instance-metrics.service';
import { instanceMetricsOf, workspaceMetricsOf } from './metrics.fixture';
import {
  ACCOUNT_MAIL_MIN_SAMPLE,
  BACKUP_STALE_PAGE_MULTIPLIER,
  CAPACITY_HEADROOM_ALERT,
  QUEUE_MEMORY_ALERT,
  QUEUE_MEMORY_PAGE,
  STORAGE_HEADROOM_ALERT,
  STORAGE_HEADROOM_PAGE,
  COST_TO_REVENUE_RATIO_ALERT,
  DAILY_RUN_GRACE_HOURS,
  TRIAL_CONVERSION_MIN_SAMPLE,
  UNPAID_DEMAND_SHARE_ALERT,
  operatorAlerts,
  type OperatorAlertInput,
} from './operator-alerts';

function inputOf(overrides: Partial<OperatorAlertInput> = {}) {
  return {
    workspaces: [workspaceMetricsOf()],
    instance: instanceMetricsOf(),
    isolationAnomalies: 0,
    redisAvailable: true,
    hoursSinceTrigger: 1,
    hoursSinceBackup: 1,
    ...overrides,
  } satisfies OperatorAlertInput;
}

const idsOf = (input: OperatorAlertInput) =>
  operatorAlerts(input).map((alert) => alert.id);

describe('operatorAlerts', () => {
  it('stays quiet on a healthy instance', () => {
    expect(operatorAlerts(inputOf())).toEqual([]);
  });

  it('pages on an isolation anomaly', () => {
    const [alert] = operatorAlerts(inputOf({ isolationAnomalies: 2 }));

    expect(alert).toMatchObject({ id: 'isolation.anomaly', severity: 'page' });
    expect(alert.summary).toContain('2');
  });

  it('pages when redis did not answer', () => {
    expect(idsOf(inputOf({ redisAvailable: false }))).toContain(
      'dependency.redis.unavailable',
    );
  });

  it('pages a workspace whose run never completed before the next trigger', () => {
    const incomplete = workspaceMetricsOf({
      runIncomplete: true,
      capturedSinceTrigger: 10,
    });

    expect(
      idsOf(
        inputOf({
          workspaces: [incomplete],
          hoursSinceTrigger: DAILY_RUN_GRACE_HOURS,
        }),
      ),
    ).toContain('daily.run.incomplete');
  });

  it('stays quiet on an incomplete run inside the grace window', () => {
    expect(
      idsOf(
        inputOf({
          workspaces: [workspaceMetricsOf({ runIncomplete: true })],
          hoursSinceTrigger: DAILY_RUN_GRACE_HOURS - 0.1,
        }),
      ),
    ).not.toContain('daily.run.incomplete');
  });

  it('pages on a failing billing webhook and a low pool', () => {
    const ids = idsOf(
      inputOf({
        instance: instanceMetricsOf({
          billingEventsFailed: 1,
          pool: { ...instanceMetricsOf().pool, alerts: ['pool.healthy.low'] },
        }),
      }),
    );

    expect(ids).toEqual(
      expect.arrayContaining(['billing.webhooks.failing', 'pool.healthy.low']),
    );
  });

  it('sorts a silent-failure pool alert into the same day tier', () => {
    const [alert] = operatorAlerts(
      inputOf({
        instance: instanceMetricsOf({
          pool: { ...instanceMetricsOf().pool, alerts: ['pool.silent.rising'] },
        }),
      }),
    );

    expect(alert).toMatchObject({
      id: 'pool.silent.rising',
      severity: 'investigate',
    });
  });

  it('flags an unpaid workspace taking a real share of the pool', () => {
    const paying = workspaceMetricsOf({ workspaceId: 'ws_paid' });
    const free = workspaceMetricsOf({
      workspaceId: 'ws_free',
      plan: 'trial',
      estimatedRequests: {
        APP_STORE: Math.ceil(
          (100 * UNPAID_DEMAND_SHARE_ALERT) / (1 - UNPAID_DEMAND_SHARE_ALERT),
        ),
        GOOGLE_PLAY: 0,
      },
    });

    const alert = operatorAlerts(inputOf({ workspaces: [paying, free] })).find(
      (candidate) => candidate.id === 'workspace.cost.unpaid',
    );

    expect(alert).toMatchObject({
      workspaceId: 'ws_free',
      severity: 'investigate',
    });
  });

  it('flags a paying workspace consuming far past its revenue share', () => {
    const heavy = workspaceMetricsOf({
      workspaceId: 'ws_heavy',
      estimatedRequests: { APP_STORE: 0, GOOGLE_PLAY: 1_000 },
    });
    const light = workspaceMetricsOf({
      workspaceId: 'ws_light',
      plan: 'ultimate',
      estimatedRequests: { APP_STORE: 10, GOOGLE_PLAY: 0 },
    });

    const ids = idsOf(inputOf({ workspaces: [heavy, light] }));

    expect(ids).toContain('workspace.cost.exceeds-revenue');
    expect(COST_TO_REVENUE_RATIO_ALERT).toBeGreaterThan(1);
  });

  it('reviews capacity headroom once demand crosses the share', () => {
    const capacityPerDay = 1_000 * 24;
    const hungry = workspaceMetricsOf({
      estimatedRequests: {
        APP_STORE: Math.ceil(capacityPerDay * CAPACITY_HEADROOM_ALERT),
        GOOGLE_PLAY: 0,
      },
    });

    expect(idsOf(inputOf({ workspaces: [hungry] }))).toContain(
      'capacity.headroom.low',
    );
  });

  it('reviews trial conversion only with enough trials to judge', () => {
    const thin = instanceMetricsOf({
      trials: { started: TRIAL_CONVERSION_MIN_SAMPLE - 1, converted: 0 },
    });
    const enough = instanceMetricsOf({
      trials: { started: TRIAL_CONVERSION_MIN_SAMPLE, converted: 1 },
    });

    expect(idsOf(inputOf({ instance: thin }))).not.toContain(
      'trial.conversion.low',
    );
    expect(idsOf(inputOf({ instance: enough }))).toContain(
      'trial.conversion.low',
    );
  });

  it('flags a suspended workspace for the same day', () => {
    expect(
      idsOf(inputOf({ workspaces: [workspaceMetricsOf({ suspended: true })] })),
    ).toContain('workspace.suspended');
  });
});

describe('operatorAlerts on the backup schedule', () => {
  const WINDOW = 36;

  const withWindow = (
    hoursSinceBackup: number | null,
    maxAgeHours = WINDOW,
  ): OperatorAlertInput =>
    inputOf({
      hoursSinceBackup,
      instance: instanceMetricsOf({
        backup: { lastCompletedAt: null, maxAgeHours },
      }),
    });

  it('stays quiet on a backup taken inside its window', () => {
    expect(idsOf(withWindow(WINDOW - 1))).not.toContain('backup.stale');
  });

  it('investigates a backup exactly at its window', () => {
    const [alert] = operatorAlerts(withWindow(WINDOW)).filter(
      (candidate) => candidate.id === 'backup.stale',
    );

    expect(alert).toMatchObject({
      id: 'backup.stale',
      severity: 'investigate',
    });
    expect(alert.summary).toContain(String(WINDOW));
  });

  it('investigates a backup one second past its window', () => {
    expect(idsOf(withWindow(WINDOW + 1 / 3600))).toContain('backup.stale');
  });

  it('pages a backup past the escalation threshold', () => {
    const [alert] = operatorAlerts(
      withWindow(WINDOW * BACKUP_STALE_PAGE_MULTIPLIER),
    ).filter((candidate) => candidate.id === 'backup.stale');

    expect(alert.severity).toBe('page');
  });

  it('pages when no backup has ever reported in', () => {
    const [alert] = operatorAlerts(withWindow(null)).filter(
      (candidate) => candidate.id === 'backup.stale',
    );

    expect(alert).toMatchObject({ severity: 'page' });
    expect(alert.summary).toContain('never');
  });

  it('pages rather than falling silent when the recorded time is in the future', () => {
    const [alert] = operatorAlerts(withWindow(-1)).filter(
      (candidate) => candidate.id === 'backup.stale',
    );

    expect(alert).toMatchObject({ severity: 'page' });
    expect(alert.summary).toContain('clock');
  });

  it('says nothing while redis itself is the thing that is down', () => {
    expect(
      idsOf(
        inputOf({
          redisAvailable: false,
          hoursSinceBackup: null,
          instance: instanceMetricsOf({
            backup: { lastCompletedAt: null, maxAgeHours: WINDOW },
          }),
        }),
      ),
    ).not.toContain('backup.stale');
  });

  it('says nothing at all when no window is declared', () => {
    expect(idsOf(withWindow(null, 0))).not.toContain('backup.stale');
    expect(idsOf(withWindow(10_000, 0))).not.toContain('backup.stale');
  });
});

describe('operatorAlerts on host resources', () => {
  const GIGABYTE = 1024 ** 3;

  const withResources = (
    resources: Partial<InstanceMetrics['resources']>,
  ): OperatorAlertInput =>
    inputOf({
      instance: instanceMetricsOf({
        resources: {
          databaseBytes: null,
          diskBudgetBytes: 0,
          redisUsedBytes: null,
          redisMaxBytes: null,
          ...resources,
        },
      }),
    });

  it('stays quiet on a database well inside its budget', () => {
    expect(
      idsOf(
        withResources({
          databaseBytes: GIGABYTE,
          diskBudgetBytes: 10 * GIGABYTE,
        }),
      ),
    ).not.toContain('storage.headroom.low');
  });

  it('investigates a database exactly at the headroom threshold', () => {
    const [alert] = operatorAlerts(
      withResources({
        databaseBytes: STORAGE_HEADROOM_ALERT * 10 * GIGABYTE,
        diskBudgetBytes: 10 * GIGABYTE,
      }),
    ).filter((candidate) => candidate.id === 'storage.headroom.low');

    expect(alert).toMatchObject({ severity: 'investigate' });
  });

  it('pages a database at the escalation threshold', () => {
    const [alert] = operatorAlerts(
      withResources({
        databaseBytes: STORAGE_HEADROOM_PAGE * 10 * GIGABYTE,
        diskBudgetBytes: 10 * GIGABYTE,
      }),
    ).filter((candidate) => candidate.id === 'storage.headroom.low');

    expect(alert).toMatchObject({ severity: 'page' });
  });

  it('says nothing about storage when no budget is declared', () => {
    expect(
      idsOf(
        withResources({ databaseBytes: 500 * GIGABYTE, diskBudgetBytes: 0 }),
      ),
    ).not.toContain('storage.headroom.low');
  });

  it('says nothing about storage when the size could not be measured', () => {
    expect(
      idsOf(
        withResources({ databaseBytes: null, diskBudgetBytes: 10 * GIGABYTE }),
      ),
    ).not.toContain('storage.headroom.low');
  });

  it('stays quiet on a queue well inside its ceiling', () => {
    expect(
      idsOf(
        withResources({
          redisUsedBytes: 10_000_000,
          redisMaxBytes: 200_000_000,
        }),
      ),
    ).not.toContain('queue.memory.high');
  });

  it('investigates a queue exactly at its threshold', () => {
    const [alert] = operatorAlerts(
      withResources({
        redisUsedBytes: QUEUE_MEMORY_ALERT * 200_000_000,
        redisMaxBytes: 200_000_000,
      }),
    ).filter((candidate) => candidate.id === 'queue.memory.high');

    expect(alert).toMatchObject({ severity: 'investigate' });
  });

  it('pages a queue at the escalation threshold', () => {
    const [alert] = operatorAlerts(
      withResources({
        redisUsedBytes: QUEUE_MEMORY_PAGE * 200_000_000,
        redisMaxBytes: 200_000_000,
      }),
    ).filter((candidate) => candidate.id === 'queue.memory.high');

    expect(alert).toMatchObject({ severity: 'page' });
  });

  it('never divides by an unlimited redis, which reports maxmemory as zero', () => {
    expect(
      idsOf(withResources({ redisUsedBytes: 500_000_000, redisMaxBytes: 0 })),
    ).not.toContain('queue.memory.high');
  });

  it('says nothing about the queue when the reading could not be taken', () => {
    expect(
      idsOf(
        withResources({ redisUsedBytes: null, redisMaxBytes: 200_000_000 }),
      ),
    ).not.toContain('queue.memory.high');
  });
});

describe('operatorAlerts on account email', () => {
  const withMail = (
    delivered: number,
    failed: number,
    skipped = 0,
  ): OperatorAlertInput =>
    inputOf({
      instance: instanceMetricsOf({
        accountMail: { delivered, failed, skipped },
      }),
    });

  const severityOf = (input: OperatorAlertInput) =>
    operatorAlerts(input).find(
      (alert) => alert.id === 'mail.failures.clustered',
    )?.severity;

  it('stays quiet while account email is getting through', () => {
    expect(severityOf(withMail(20, 1))).toBeUndefined();
  });

  it('stays quiet below the sample it takes to call it a cluster', () => {
    expect(
      severityOf(withMail(0, ACCOUNT_MAIL_MIN_SAMPLE - 1)),
    ).toBeUndefined();
  });

  it('investigates once the failure rate crosses its threshold', () => {
    expect(severityOf(withMail(8, 2))).toBe('investigate');
  });

  it('pages once half the attempts are being refused', () => {
    expect(severityOf(withMail(5, 5))).toBe('page');
  });

  it('never counts a message it never attempted against the rate', () => {
    expect(severityOf(withMail(10, 0, 40))).toBeUndefined();
  });

  it('names what stops working rather than only the count', () => {
    const alert = operatorAlerts(withMail(0, 10)).find(
      (candidate) => candidate.id === 'mail.failures.clustered',
    );

    expect(alert?.summary).toContain('recovery');
  });
});
