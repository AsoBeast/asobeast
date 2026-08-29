import { ON_DEMAND_ACTIONS, STORES, type PlanLimit } from '@asobeast/shared';
import type {
  AccountMailOutcomes,
  BackupFreshness,
  InstanceMetrics,
  StoreCanaryVerdicts,
} from './instance-metrics.service';
import type { ResourceUsage } from './resource-metrics.service';
import type { OperatorAlert } from './operator-alerts';
import type { MetricFamily, MetricSample } from './prometheus';
import type { WorkspaceMetrics } from './workspace-metrics.service';

const UNLIMITED = -1;

export function alertFamily(
  alerts: readonly OperatorAlert[],
  isolationAnomalies: number,
): MetricFamily[] {
  return [
    {
      name: 'asobeast_operator_alert',
      help: 'An operator alert that is firing right now',
      samples: alerts.map((alert) => ({
        labels: {
          alert: alert.id,
          severity: alert.severity,
          ...(alert.workspaceId ? { workspace: alert.workspaceId } : {}),
        },
        value: 1,
      })),
    },
    {
      name: 'asobeast_isolation_anomalies',
      help: 'Scoped queries that returned rows owned by another workspace',
      samples: [{ value: isolationAnomalies }],
    },
  ];
}

export function metricFamilies(
  workspaces: readonly WorkspaceMetrics[],
  instance: InstanceMetrics,
): MetricFamily[] {
  return [...workspaceFamilies(workspaces), ...instanceFamilies(instance)];
}

function workspaceFamilies(
  workspaces: readonly WorkspaceMetrics[],
): MetricFamily[] {
  const gauge = (
    name: string,
    help: string,
    select: (metrics: WorkspaceMetrics) => number,
  ): MetricFamily => ({
    name,
    help,
    samples: workspaces.map((metrics) => ({
      labels: { workspace: metrics.workspaceId },
      value: select(metrics),
    })),
  });

  return [
    {
      name: 'asobeast_workspace_plan_info',
      help: 'Effective plan of a workspace',
      samples: workspaces.map((metrics) => ({
        labels: { workspace: metrics.workspaceId, plan: metrics.plan },
        value: 1,
      })),
    },
    gauge(
      'asobeast_workspace_suspended',
      'Whether a workspace is suspended',
      (metrics) => (metrics.suspended ? 1 : 0),
    ),
    gauge(
      'asobeast_workspace_apps',
      'Apps tracked by a workspace',
      (metrics) => metrics.apps,
    ),
    gauge(
      'asobeast_workspace_competitors',
      'Competitor apps tracked by a workspace',
      (metrics) => metrics.competitors,
    ),
    gauge(
      'asobeast_workspace_keyword_markets',
      'Active keyword-market pairs tracked by a workspace',
      (metrics) => metrics.keywordMarkets,
    ),
    gauge(
      'asobeast_workspace_quota_apps_limit',
      'Plan limit on apps, -1 when unlimited',
      (metrics) => limitValue(metrics.limits.apps),
    ),
    gauge(
      'asobeast_workspace_quota_keyword_markets_limit',
      'Plan limit on keyword-market pairs, -1 when unlimited',
      (metrics) => limitValue(metrics.limits.keywordMarkets),
    ),
    {
      name: 'asobeast_workspace_daily_requests_estimated',
      help: 'Store requests a workspace demands from one daily run',
      samples: workspaces.flatMap((metrics) =>
        STORES.map((store) => ({
          labels: { workspace: metrics.workspaceId, store },
          value: metrics.estimatedRequests[store],
        })),
      ),
    },
    {
      name: 'asobeast_workspace_on_demand_used',
      help: 'On-demand operations a workspace spent in the current window',
      samples: workspaces.flatMap((metrics) =>
        ON_DEMAND_ACTIONS.map((action) => ({
          labels: { workspace: metrics.workspaceId, action },
          value: metrics.onDemandUsed[action],
        })),
      ),
    },
    gauge(
      'asobeast_workspace_rankings_captured',
      'Rankings captured for a workspace since the last daily trigger',
      (metrics) => metrics.capturedSinceTrigger,
    ),
    gauge(
      'asobeast_workspace_rankings_captured_yesterday',
      'Rankings captured for a workspace on the previous UTC date',
      (metrics) => metrics.capturedYesterday,
    ),
    gauge(
      'asobeast_workspace_rankings_unresolved',
      'Rankings captured with no position within the searched depth',
      (metrics) => metrics.unresolvedSinceTrigger,
    ),
    gauge(
      'asobeast_workspace_daily_run_completed_seconds',
      'Unix time of the last ranking captured for a workspace, 0 when none',
      (metrics) => seconds(metrics.runCompletedAt),
    ),
    gauge(
      'asobeast_workspace_daily_run_incomplete',
      'Whether a workspace has fewer captures than tracked keyword markets',
      (metrics) => (metrics.runIncomplete ? 1 : 0),
    ),
    gauge(
      'asobeast_workspace_stored_rankings',
      'Ranking rows stored for a workspace',
      (metrics) => metrics.storedRankings,
    ),
    gauge(
      'asobeast_workspace_stored_reviews',
      'Review rows stored for a workspace',
      (metrics) => metrics.storedReviews,
    ),
  ];
}

function resourceFamilies(resources: ResourceUsage): MetricFamily[] {
  const measured = (
    name: string,
    help: string,
    value: number | null,
  ): MetricFamily[] => (value === null ? [] : [single(name, help, value)]);

  return [
    ...measured(
      'asobeast_database_bytes',
      'Size of the application database on disk',
      resources.databaseBytes,
    ),
    single(
      'asobeast_disk_budget_bytes',
      'Storage the database is allowed to occupy, 0 when no budget is declared',
      resources.diskBudgetBytes,
    ),
    ...measured(
      'asobeast_queue_memory_bytes',
      'Memory redis reports as used',
      resources.redisUsedBytes,
    ),
    ...measured(
      'asobeast_queue_memory_max_bytes',
      'Memory ceiling redis reports, 0 when it is unlimited',
      resources.redisMaxBytes,
    ),
  ];
}

function instanceFamilies(instance: InstanceMetrics): MetricFamily[] {
  const { pool } = instance;
  const perStore = (
    name: string,
    help: string,
    select: (store: (typeof pool.stores)[number]) => number,
  ): MetricFamily => ({
    name,
    help,
    samples: pool.stores.map((store) => ({
      labels: { store: store.store },
      value: select(store),
    })),
  });

  return [
    perStore(
      'asobeast_pool_endpoints',
      'Proxy endpoints serving a store',
      (store) => store.endpoints,
    ),
    perStore(
      'asobeast_pool_endpoints_healthy',
      'Proxy endpoints not cooling down for a store',
      (store) => store.healthy,
    ),
    perStore(
      'asobeast_pool_success_rate',
      'Share of proxy requests that succeeded for a store',
      (store) => store.successRate ?? 1,
    ),
    perStore(
      'asobeast_pool_endpoints_blocked',
      'Proxy endpoints whose last outcome for a store was blocked',
      (store) => store.outcomes.BLOCKED,
    ),
    perStore(
      'asobeast_pool_endpoints_silent',
      'Proxy endpoints whose last outcome for a store was a silent failure',
      (store) => store.outcomes.SILENT,
    ),
    {
      name: 'asobeast_proxy_requests_month',
      help: 'Egress requests recorded this month by proxy tier',
      samples: Object.entries(instance.proxyRequests).map(([tier, value]) => ({
        labels: { tier },
        value,
      })),
    },
    single(
      'asobeast_residential_spend_usd',
      'Residential fallback spend this month',
      pool.residential.spendUsd,
    ),
    single(
      'asobeast_residential_cap_usd',
      'Residential fallback monthly cap',
      pool.residential.capUsd,
    ),
    {
      name: 'asobeast_billing_workspaces',
      help: 'Workspaces by stored plan',
      samples: labelled('plan', instance.workspacesByPlan),
    },
    {
      name: 'asobeast_billing_subscriptions',
      help: 'Workspaces by subscription status',
      samples: labelled('status', instance.subscriptionsByStatus),
    },
    single(
      'asobeast_billing_trials_active',
      'Workspaces inside an unexpired trial',
      instance.trialsActive,
    ),
    single(
      'asobeast_workspaces_suspended',
      'Suspended workspaces',
      instance.suspended,
    ),
    single(
      'asobeast_billing_events_unprocessed',
      'Stored billing events with no processed time',
      instance.billingEventsUnprocessed,
    ),
    single(
      'asobeast_billing_events_failed',
      'Stored billing events that recorded a failure',
      instance.billingEventsFailed,
    ),
    storeCanaryFamily(instance.storeCanary),
    ...backupFamilies(instance.backup),
    ...accountMailFamilies(instance.accountMail),
    ...resourceFamilies(instance.resources),
  ];
}

function storeCanaryFamily(verdicts: StoreCanaryVerdicts): MetricFamily {
  return {
    name: 'asobeast_store_canary',
    help: 'The most recent parser canary verdict for one store',
    samples: STORES.flatMap((store) => {
      const verdict = verdicts[store];
      return verdict
        ? [{ labels: { store, outcome: verdict.outcome }, value: 1 }]
        : [];
    }),
  };
}

function backupFamilies(backup: BackupFreshness): MetricFamily[] {
  return [
    single(
      'asobeast_backup_last_completed_seconds',
      'Unix time the last backup reported a completed run, 0 when none has',
      seconds(backup.lastCompletedAt),
    ),
    single(
      'asobeast_backup_max_age_hours',
      'Hours a backup may go without reporting in, 0 when none is expected',
      backup.maxAgeHours,
    ),
  ];
}

function accountMailFamilies(outcomes: AccountMailOutcomes): MetricFamily[] {
  return [
    {
      name: 'asobeast_account_mail_attempts',
      help: 'Account emails attempted in the last day, by outcome',
      samples: labelled('status', { ...outcomes }),
    },
  ];
}

function single(name: string, help: string, value: number): MetricFamily {
  return { name, help, samples: [{ value }] };
}

function labelled(
  label: string,
  counts: Record<string, number>,
): MetricSample[] {
  return Object.entries(counts).map(([value, count]) => ({
    labels: { [label]: value },
    value: count,
  }));
}

function limitValue(limit: PlanLimit): number {
  return limit ?? UNLIMITED;
}

function seconds(date: Date | null): number {
  return date === null ? 0 : Math.floor(date.getTime() / 1000);
}
