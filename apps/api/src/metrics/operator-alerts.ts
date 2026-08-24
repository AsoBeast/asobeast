import { PLANS } from '@asobeast/shared';
import type {
  AccountMailOutcomes,
  InstanceMetrics,
} from './instance-metrics.service';
import type { ResourceUsage } from './resource-metrics.service';
import type { WorkspaceMetrics } from './workspace-metrics.service';

export const OPERATOR_ALERT_SEVERITIES = [
  'page',
  'investigate',
  'review',
] as const;

export type OperatorAlertSeverity = (typeof OPERATOR_ALERT_SEVERITIES)[number];

export const DAILY_RUN_GRACE_HOURS = 20;
export const BACKUP_STALE_PAGE_MULTIPLIER = 2;
export const STORAGE_HEADROOM_ALERT = 0.8;
export const STORAGE_HEADROOM_PAGE = 0.9;
export const QUEUE_MEMORY_ALERT = 0.8;
export const QUEUE_MEMORY_PAGE = 0.9;
export const ACCOUNT_MAIL_FAILURE_RATE_ALERT = 0.2;
export const ACCOUNT_MAIL_FAILURE_RATE_PAGE = 0.5;
export const ACCOUNT_MAIL_MIN_SAMPLE = 5;
export const BILLING_BACKLOG_ALERT = 10;
export const COST_TO_REVENUE_RATIO_ALERT = 3;
export const UNPAID_DEMAND_SHARE_ALERT = 0.1;
export const CAPACITY_HEADROOM_ALERT = 0.8;
export const TRIAL_CONVERSION_ALERT = 0.2;
export const TRIAL_CONVERSION_MIN_SAMPLE = 10;

export interface OperatorAlert {
  id: string;
  severity: OperatorAlertSeverity;
  summary: string;
  workspaceId?: string;
}

export interface OperatorAlertInput {
  workspaces: readonly WorkspaceMetrics[];
  instance: InstanceMetrics;
  isolationAnomalies: number;
  redisAvailable: boolean;
  hoursSinceTrigger: number;
  hoursSinceBackup: number | null;
}

const POOL_ALERT_SEVERITY: Record<string, OperatorAlertSeverity> = {
  'pool.healthy.low': 'page',
  'pool.blocked.rising': 'investigate',
  'pool.silent.rising': 'investigate',
  'residential.spend.near-cap': 'investigate',
};

export function operatorAlerts(input: OperatorAlertInput): OperatorAlert[] {
  const alerts = [
    ...pageAlerts(input),
    ...poolAlerts(input),
    ...investigateAlerts(input),
    ...costAlerts(input.workspaces),
    ...backupAlerts(input),
    ...resourceAlerts(input.instance.resources),
    ...accountMailAlerts(input.instance.accountMail),
    ...reviewAlerts(input),
  ];
  return [...alerts].sort(
    (left, right) => rank(left.severity) - rank(right.severity),
  );
}

function rank(severity: OperatorAlertSeverity): number {
  return OPERATOR_ALERT_SEVERITIES.indexOf(severity);
}

function pageAlerts(input: OperatorAlertInput): OperatorAlert[] {
  const alerts: OperatorAlert[] = [];

  if (input.isolationAnomalies > 0) {
    alerts.push({
      id: 'isolation.anomaly',
      severity: 'page',
      summary: `${input.isolationAnomalies} scoped queries returned rows owned by another workspace`,
    });
  }

  if (!input.redisAvailable) {
    alerts.push({
      id: 'dependency.redis.unavailable',
      severity: 'page',
      summary: 'redis did not answer, so no queue work is running',
    });
  }

  if (input.hoursSinceTrigger >= DAILY_RUN_GRACE_HOURS) {
    for (const workspace of input.workspaces.filter(
      (candidate) => candidate.runIncomplete,
    )) {
      alerts.push({
        id: 'daily.run.incomplete',
        severity: 'page',
        workspaceId: workspace.workspaceId,
        summary: `captured ${workspace.capturedSinceTrigger} of ${workspace.keywordMarkets} keyword markets before the next daily trigger`,
      });
    }
  }

  if (input.instance.billingEventsFailed > 0) {
    alerts.push({
      id: 'billing.webhooks.failing',
      severity: 'page',
      summary: `${input.instance.billingEventsFailed} stored billing events recorded a failure`,
    });
  }

  return alerts;
}

function investigateAlerts(input: OperatorAlertInput): OperatorAlert[] {
  const alerts: OperatorAlert[] = [];

  if (input.instance.billingEventsUnprocessed >= BILLING_BACKLOG_ALERT) {
    alerts.push({
      id: 'billing.reconcile.discrepancy',
      severity: 'investigate',
      summary: `${input.instance.billingEventsUnprocessed} billing events are still waiting to be processed`,
    });
  }

  for (const workspace of input.workspaces.filter(
    (candidate) => candidate.suspended,
  )) {
    alerts.push({
      id: 'workspace.suspended',
      severity: 'investigate',
      workspaceId: workspace.workspaceId,
      summary: 'the workspace is suspended and every write is refused',
    });
  }

  return alerts;
}

function reviewAlerts(input: OperatorAlertInput): OperatorAlert[] {
  const alerts: OperatorAlert[] = [];
  const demand = totalDemand(input.workspaces);
  const capacity = capacityPerDay(input.instance);

  if (capacity > 0 && demand / capacity >= CAPACITY_HEADROOM_ALERT) {
    alerts.push({
      id: 'capacity.headroom.low',
      severity: 'review',
      summary: `daily demand of ${demand} requests is ${percent(demand / capacity)} of pool capacity`,
    });
  }

  const { started, converted } = input.instance.trials;
  if (
    started >= TRIAL_CONVERSION_MIN_SAMPLE &&
    converted / started < TRIAL_CONVERSION_ALERT
  ) {
    alerts.push({
      id: 'trial.conversion.low',
      severity: 'review',
      summary: `${converted} of ${started} trials converted to a paid plan`,
    });
  }

  return alerts;
}

function costAlerts(workspaces: readonly WorkspaceMetrics[]): OperatorAlert[] {
  const demand = totalDemand(workspaces);
  const revenue = workspaces.reduce(
    (total, workspace) => total + monthlyRevenue(workspace),
    0,
  );
  if (demand === 0) return [];

  return workspaces.flatMap((workspace) => {
    const demandShare = workspaceDemand(workspace) / demand;
    const workspaceRevenue = monthlyRevenue(workspace);

    if (workspaceRevenue === 0) {
      return demandShare >= UNPAID_DEMAND_SHARE_ALERT
        ? [
            {
              id: 'workspace.cost.unpaid',
              severity: 'investigate' as const,
              workspaceId: workspace.workspaceId,
              summary: `an unpaid workspace consumes ${percent(demandShare)} of daily pool demand`,
            },
          ]
        : [];
    }

    const revenueShare = revenue === 0 ? 0 : workspaceRevenue / revenue;
    return revenueShare > 0 &&
      demandShare / revenueShare >= COST_TO_REVENUE_RATIO_ALERT
      ? [
          {
            id: 'workspace.cost.exceeds-revenue',
            severity: 'investigate' as const,
            workspaceId: workspace.workspaceId,
            summary: `the workspace takes ${percent(demandShare)} of pool demand against ${percent(revenueShare)} of revenue`,
          },
        ]
      : [];
  });
}

function accountMailAlerts(outcomes: AccountMailOutcomes): OperatorAlert[] {
  const attempts = outcomes.delivered + outcomes.failed;
  if (attempts < ACCOUNT_MAIL_MIN_SAMPLE) return [];

  const rate = outcomes.failed / attempts;
  if (rate < ACCOUNT_MAIL_FAILURE_RATE_ALERT) return [];

  return [
    {
      id: 'mail.failures.clustered',
      severity: rate >= ACCOUNT_MAIL_FAILURE_RATE_PAGE ? 'page' : 'investigate',
      summary: `${outcomes.failed} of ${attempts} account emails were refused in the last day, so confirmation and recovery are not reaching customers`,
    },
  ];
}

function resourceAlerts(resources: ResourceUsage): OperatorAlert[] {
  return [
    saturation({
      id: 'storage.headroom.low',
      used: resources.databaseBytes,
      ceiling: resources.diskBudgetBytes,
      describe: (share) =>
        `the database occupies ${percent(share)} of the ${resources.diskBudgetBytes} byte storage budget`,
      alertAt: STORAGE_HEADROOM_ALERT,
      pageAt: STORAGE_HEADROOM_PAGE,
    }),
    saturation({
      id: 'queue.memory.high',
      used: resources.redisUsedBytes,
      ceiling: resources.redisMaxBytes ?? 0,
      describe: (share) =>
        `redis holds ${percent(share)} of its memory ceiling, and refuses writes at it rather than evicting queue state`,
      alertAt: QUEUE_MEMORY_ALERT,
      pageAt: QUEUE_MEMORY_PAGE,
    }),
  ].filter((alert): alert is OperatorAlert => alert !== null);
}

interface Saturation {
  id: string;
  used: number | null;
  ceiling: number;
  describe: (share: number) => string;
  alertAt: number;
  pageAt: number;
}

function saturation(measure: Saturation): OperatorAlert | null {
  if (measure.used === null || measure.ceiling <= 0) return null;

  const share = measure.used / measure.ceiling;
  if (share < measure.alertAt) return null;

  return {
    id: measure.id,
    severity: share >= measure.pageAt ? 'page' : 'investigate',
    summary: measure.describe(share),
  };
}

function backupAlerts(input: OperatorAlertInput): OperatorAlert[] {
  const window = input.instance.backup.maxAgeHours;
  if (window <= 0 || !input.redisAvailable) return [];

  const alert = backupAlert(input.hoursSinceBackup, window);
  return alert === null ? [] : [alert];
}

function backupAlert(
  hoursSinceBackup: number | null,
  window: number,
): OperatorAlert | null {
  if (hoursSinceBackup === null) {
    return {
      id: 'backup.stale',
      severity: 'page',
      summary:
        'the backup schedule has never reported a completed run, so no archive is known to exist',
    };
  }
  if (hoursSinceBackup < 0) {
    return {
      id: 'backup.stale',
      severity: 'page',
      summary:
        'the last backup reported a completion time in the future, so its clock disagrees with the api and its age cannot be trusted',
    };
  }
  if (hoursSinceBackup < window) return null;

  return {
    id: 'backup.stale',
    severity:
      hoursSinceBackup >= window * BACKUP_STALE_PAGE_MULTIPLIER
        ? 'page'
        : 'investigate',
    summary: `the last backup completed ${Math.floor(hoursSinceBackup)} hours ago, past the ${window} hour window`,
  };
}

function poolAlerts(input: OperatorAlertInput): OperatorAlert[] {
  return input.instance.pool.alerts
    .filter((alert) => POOL_ALERT_SEVERITY[alert] !== undefined)
    .map((alert) => ({
      id: alert,
      severity: POOL_ALERT_SEVERITY[alert],
      summary: `the egress pool reported ${alert}`,
    }));
}

function workspaceDemand(workspace: WorkspaceMetrics): number {
  return Object.values(workspace.estimatedRequests).reduce(
    (total, requests) => total + requests,
    0,
  );
}

function totalDemand(workspaces: readonly WorkspaceMetrics[]): number {
  return workspaces.reduce(
    (total, workspace) => total + workspaceDemand(workspace),
    0,
  );
}

function monthlyRevenue(workspace: WorkspaceMetrics): number {
  return PLANS[workspace.plan].prices.monthlyUsd ?? 0;
}

function capacityPerDay(instance: InstanceMetrics): number {
  return instance.pool.stores.reduce(
    (total, store) => total + store.capacityPerHour * 24,
    0,
  );
}

function percent(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}
