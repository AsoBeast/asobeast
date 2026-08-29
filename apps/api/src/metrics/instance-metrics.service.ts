import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ProxyTier, Store } from '@prisma/client';
import { Queue } from 'bullmq';
import type { ProxyPoolHealth } from '@asobeast/shared';
import { CrossTenantAccess } from '../common/tenancy/cross-tenant-access';
import type { Env } from '../config/env';
import { ACCOUNT_MAIL_CHANNEL } from '../alerts/mailer.service';
import { LAST_BACKUP_KEY, QUEUES } from '../jobs/jobs.types';
import { PrismaService } from '../prisma/prisma.service';
import type { StoreCanaryRecord } from '../store-providers/canary/store-canary.service';
import { StoreCanaryService } from '../store-providers/canary/store-canary.service';
import { ProxyLedger } from '../store-providers/egress/proxy-ledger.service';
import { ProxyPoolHealthReport } from '../store-providers/egress/proxy-pool-health.service';
import {
  ResourceMetricsCollector,
  type ResourceUsage,
} from './resource-metrics.service';

const BILLING_JUSTIFICATION =
  'billing totals are an operator signal across every workspace';

const ACCOUNT_MAIL_JUSTIFICATION =
  'account email is addressed to a person before any workspace is in scope';

const NO_POOL: ProxyPoolHealth = {
  enabled: false,
  provider: 'none',
  total: 0,
  pending: 0,
  retired: 0,
  stores: [],
  endpoints: [],
  residential: {
    configured: false,
    month: '',
    requests: 0,
    spendUsd: 0,
    capUsd: 0,
    fallbackRate: 0,
  },
  alerts: [],
};

const NO_BILLING = {
  workspacesByPlan: {},
  subscriptionsByStatus: {},
  trialsActive: 0,
  trials: { started: 0, converted: 0 },
  suspended: 0,
  billingEventsUnprocessed: 0,
  billingEventsFailed: 0,
};

const NO_RESOURCES: ResourceUsage = {
  databaseBytes: null,
  diskBudgetBytes: 0,
  redisUsedBytes: null,
  redisMaxBytes: null,
};

export interface TrialFunnel {
  started: number;
  converted: number;
}

export const ACCOUNT_MAIL_WINDOW_HOURS = 24;

export interface AccountMailOutcomes {
  delivered: number;
  failed: number;
  skipped: number;
}

const NO_ACCOUNT_MAIL: AccountMailOutcomes = {
  delivered: 0,
  failed: 0,
  skipped: 0,
};

export interface BackupFreshness {
  lastCompletedAt: Date | null;
  maxAgeHours: number;
}

export type StoreCanaryVerdicts = Partial<Record<Store, StoreCanaryRecord>>;

const NO_CANARY: StoreCanaryVerdicts = {};

export interface InstanceMetrics {
  pool: ProxyPoolHealth;
  backup: BackupFreshness;
  resources: ResourceUsage;
  accountMail: AccountMailOutcomes;
  storeCanary: StoreCanaryVerdicts;
  redisAvailable: boolean;
  proxyRequests: Record<ProxyTier, number>;
  workspacesByPlan: Record<string, number>;
  subscriptionsByStatus: Record<string, number>;
  trialsActive: number;
  trials: TrialFunnel;
  suspended: number;
  billingEventsUnprocessed: number;
  billingEventsFailed: number;
}

@Injectable()
export class InstanceMetricsCollector {
  private readonly logger = new Logger(InstanceMetricsCollector.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crossTenant: CrossTenantAccess,
    private readonly pool: ProxyPoolHealthReport,
    private readonly ledger: ProxyLedger,
    private readonly resources: ResourceMetricsCollector,
    private readonly canary: StoreCanaryService,
    private readonly config: ConfigService<Env, true>,
    @InjectQueue(QUEUES.PIPELINE) private readonly queue: Queue,
  ) {}

  async collect(now = new Date()): Promise<InstanceMetrics> {
    const [
      pool,
      datacenter,
      residential,
      billing,
      redisAvailable,
      backup,
      resources,
      accountMail,
      storeCanary,
    ] = await Promise.all([
      this.degradable('the proxy pool', () => this.pool.build(now), NO_POOL),
      this.degradable(
        'datacenter egress',
        () => this.ledger.count(ProxyTier.DATACENTER),
        0,
      ),
      this.degradable(
        'residential egress',
        () => this.ledger.count(ProxyTier.RESIDENTIAL),
        0,
      ),
      this.degradable(
        'billing totals',
        () =>
          this.crossTenant.becauseThisWorkIsNotOwnedByOneWorkspace(
            BILLING_JUSTIFICATION,
            () => this.billing(now),
          ),
        NO_BILLING,
      ),
      this.redisAvailable(),
      this.backup(),
      this.degradable(
        'host resources',
        () => this.resources.collect(),
        NO_RESOURCES,
      ),
      this.degradable(
        'account mail outcomes',
        () => this.accountMail(now),
        NO_ACCOUNT_MAIL,
      ),
      this.degradable(
        'the store parser canary',
        () => this.canary.records(),
        NO_CANARY,
      ),
    ]);

    return {
      pool,
      backup,
      resources,
      accountMail,
      storeCanary,
      redisAvailable,
      proxyRequests: {
        [ProxyTier.DATACENTER]: datacenter,
        [ProxyTier.RESIDENTIAL]: residential,
      },
      ...billing,
    };
  }

  private async billing(now: Date) {
    const [
      plans,
      statuses,
      trialsActive,
      trialsStarted,
      trialsConverted,
      suspended,
      unprocessed,
      failed,
    ] = await Promise.all([
      this.prisma.workspace.groupBy({
        by: ['plan'],
        _count: { _all: true },
      }),
      this.prisma.workspace.groupBy({
        by: ['subscriptionStatus'],
        _count: { _all: true },
      }),
      this.prisma.workspace.count({ where: { trialEndsAt: { gt: now } } }),
      this.prisma.workspace.count({
        where: { trialStartedAt: { not: null } },
      }),
      this.prisma.workspace.count({
        where: { trialStartedAt: { not: null }, subscriptionId: { not: null } },
      }),
      this.prisma.workspace.count({ where: { suspendedAt: { not: null } } }),
      this.prisma.billingEvent.count({ where: { processedAt: null } }),
      this.prisma.billingEvent.count({ where: { failure: { not: null } } }),
    ]);

    return {
      workspacesByPlan: tally(plans.map((row) => [row.plan, row._count._all])),
      subscriptionsByStatus: tally(
        statuses
          .filter((row) => row.subscriptionStatus !== null)
          .map((row) => [row.subscriptionStatus!, row._count._all]),
      ),
      trialsActive,
      trials: { started: trialsStarted, converted: trialsConverted },
      suspended,
      billingEventsUnprocessed: unprocessed,
      billingEventsFailed: failed,
    };
  }

  private accountMail(now: Date): Promise<AccountMailOutcomes> {
    return this.crossTenant.becauseThisWorkIsNotOwnedByOneWorkspace(
      ACCOUNT_MAIL_JUSTIFICATION,
      async () => {
        const rows = await this.prisma.alertDelivery.groupBy({
          by: ['status'],
          where: {
            channel: ACCOUNT_MAIL_CHANNEL,
            createdAt: {
              gte: new Date(
                now.getTime() - ACCOUNT_MAIL_WINDOW_HOURS * 60 * 60 * 1000,
              ),
            },
          },
          _count: { _all: true },
        });
        return rows.reduce<AccountMailOutcomes>(
          (totals, row) =>
            row.status in totals
              ? { ...totals, [row.status]: row._count._all }
              : totals,
          { ...NO_ACCOUNT_MAIL },
        );
      },
    );
  }

  private async degradable<T>(
    measure: string,
    work: () => Promise<T>,
    fallback: T,
  ): Promise<T> {
    try {
      return await work();
    } catch (error) {
      this.logger.warn(
        `${measure} could not be collected, so this scrape reports it as unknown rather than failing: ${error instanceof Error ? error.message : String(error)}`,
      );
      return fallback;
    }
  }

  private async backup(): Promise<BackupFreshness> {
    const maxAgeHours = this.config.get('BACKUP_MAX_AGE_HOURS', {
      infer: true,
    });
    return {
      maxAgeHours,
      lastCompletedAt: maxAgeHours > 0 ? await this.lastBackupAt() : null,
    };
  }

  private async lastBackupAt(): Promise<Date | null> {
    try {
      const client = (await this.queue.getBackend().client) as unknown as {
        get(key: string): Promise<string | null>;
      };
      const recorded = await client.get(LAST_BACKUP_KEY);
      if (!recorded) return null;
      const at = new Date(recorded);
      return Number.isNaN(at.getTime()) ? null : at;
    } catch {
      return null;
    }
  }

  private async redisAvailable(): Promise<boolean> {
    try {
      const client = (await this.queue.getBackend().client) as unknown as {
        ping(): Promise<string>;
      };
      await client.ping();
      return true;
    } catch {
      return false;
    }
  }
}

function tally(entries: [string, number][]): Record<string, number> {
  return Object.fromEntries(entries);
}
