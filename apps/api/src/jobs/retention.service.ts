import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CrossTenantAccess } from '../common/tenancy/cross-tenant-access';
import { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';

const SUGGEST_PROBE_DAYS = 7;

@Injectable()
export class RetentionService {
  private readonly logger = new Logger(RetentionService.name);

  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly prisma: PrismaService,
    private readonly crossTenant: CrossTenantAccess,
  ) {}

  prune(): Promise<Record<string, number>> {
    return this.crossTenant.becauseThisWorkIsNotOwnedByOneWorkspace(
      'retention prunes every workspace by age',
      () => this.pruneEveryWorkspace(),
    );
  }

  private async pruneEveryWorkspace(): Promise<Record<string, number>> {
    const now = new Date();
    const rules: [string, () => Promise<number>][] = [
      ['keywordRanking', () => this.pruneRankings(now)],
      ['serpEntry', () => this.pruneSerp(now)],
      ['categoryRank', () => this.pruneCategoryRanks(now)],
      ['changeEvent', () => this.pruneChangeEvents(now)],
      ['appSnapshot', () => this.pruneSnapshots(now)],
      ['alertDelivery', () => this.pruneDeliveries(now)],
      ['alertEvent', () => this.pruneAlertEvents(now)],
      ['suggestProbe', () => this.pruneSuggestProbes(now)],
      ['auditScore', () => this.pruneAuditScores(now)],
      ['actionItem', () => this.pruneActions(now)],
      ['billingEvent', () => this.pruneBillingEvents(now)],
    ];

    const settled = await Promise.allSettled(rules.map(([, run]) => run()));

    const deleted: Record<string, number> = {};
    let failures = 0;
    settled.forEach((result, index) => {
      const [table] = rules[index];
      if (result.status === 'fulfilled') {
        deleted[table] = result.value;
        return;
      }
      failures += 1;
      this.logger.error(`retention ${table} failed`, result.reason);
    });

    if (failures === rules.length) {
      throw new Error('data retention failed for every table');
    }

    this.logger.log(`retention ${JSON.stringify(deleted)}`);
    return deleted;
  }

  private cutoff(days: number, now: Date): Date {
    const midnight = Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
    );
    return new Date(midnight - days * 86_400_000);
  }

  private async pruneRankings(now: Date): Promise<number> {
    const days = this.config.get('RETENTION_RANKINGS_DAYS', { infer: true });
    if (days === 0) {
      return 0;
    }
    const { count } = await this.prisma.keywordRanking.deleteMany({
      where: { date: { lt: this.cutoff(days, now) } },
    });
    return count;
  }

  private async pruneSerp(now: Date): Promise<number> {
    const days = this.config.get('RETENTION_SERP_DAYS', { infer: true });
    if (days === 0) {
      return 0;
    }
    const { count } = await this.prisma.serpEntry.deleteMany({
      where: { date: { lt: this.cutoff(days, now) } },
    });
    return count;
  }

  private async pruneCategoryRanks(now: Date): Promise<number> {
    const days = this.config.get('RETENTION_CATEGORY_RANKS_DAYS', {
      infer: true,
    });
    if (days === 0) {
      return 0;
    }
    const { count } = await this.prisma.categoryRank.deleteMany({
      where: { date: { lt: this.cutoff(days, now) } },
    });
    return count;
  }

  private async pruneChangeEvents(now: Date): Promise<number> {
    const days = this.config.get('RETENTION_CHANGE_EVENTS_DAYS', {
      infer: true,
    });
    if (days === 0) {
      return 0;
    }
    const { count } = await this.prisma.changeEvent.deleteMany({
      where: { capturedAt: { lt: this.cutoff(days, now) } },
    });
    return count;
  }

  private async pruneBillingEvents(now: Date): Promise<number> {
    const days = this.config.get('RETENTION_BILLING_EVENTS_DAYS', {
      infer: true,
    });
    if (days === 0) {
      return 0;
    }
    const { count } = await this.prisma.billingEvent.deleteMany({
      where: { receivedAt: { lt: this.cutoff(days, now) } },
    });
    return count;
  }

  private async pruneDeliveries(now: Date): Promise<number> {
    const days = this.config.get('RETENTION_DELIVERIES_DAYS', { infer: true });
    if (days === 0) {
      return 0;
    }
    const { count } = await this.prisma.alertDelivery.deleteMany({
      where: { createdAt: { lt: this.cutoff(days, now) } },
    });
    return count;
  }

  private async pruneAlertEvents(now: Date): Promise<number> {
    const days = this.config.get('RETENTION_ALERT_EVENTS_DAYS', {
      infer: true,
    });
    if (days === 0) {
      return 0;
    }
    const { count } = await this.prisma.alertEvent.deleteMany({
      where: {
        flushedAt: { not: null, lt: this.cutoff(days, now) },
      },
    });
    return count;
  }

  private async pruneSuggestProbes(now: Date): Promise<number> {
    const { count } = await this.prisma.suggestProbe.deleteMany({
      where: { day: { lt: this.cutoff(SUGGEST_PROBE_DAYS, now) } },
    });
    return count;
  }

  private async pruneAuditScores(now: Date): Promise<number> {
    const days = this.config.get('RETENTION_AUDIT_SCORES_DAYS', {
      infer: true,
    });
    if (days === 0) {
      return 0;
    }
    const { count } = await this.prisma.auditScore.deleteMany({
      where: { date: { lt: this.cutoff(days, now) } },
    });
    return count;
  }

  private async pruneActions(now: Date): Promise<number> {
    const days = this.config.get('RETENTION_ACTIONS_DAYS', { infer: true });
    if (days === 0) {
      return 0;
    }
    const cutoff = this.cutoff(days, now);
    const { count } = await this.prisma.actionItem.deleteMany({
      where: {
        status: { in: ['DONE', 'DISMISSED', 'RESOLVED'] },
        OR: [
          { closedAt: { lt: cutoff } },
          { closedAt: null, resolvedAt: { lt: cutoff } },
        ],
      },
    });
    return count;
  }

  private async pruneSnapshots(now: Date): Promise<number> {
    const days = this.config.get('RETENTION_SNAPSHOTS_DAYS', { infer: true });
    if (days === 0) {
      return 0;
    }
    const latest = await this.prisma.appSnapshot.findMany({
      distinct: ['appId'],
      orderBy: { capturedAt: 'desc' },
      select: { id: true },
    });
    const keepIds = latest.map((row) => row.id);
    const { count } = await this.prisma.appSnapshot.deleteMany({
      where: {
        capturedAt: { lt: this.cutoff(days, now) },
        id: { notIn: keepIds },
      },
    });
    return count;
  }
}
