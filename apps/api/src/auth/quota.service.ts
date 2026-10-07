import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import {
  nextPlan,
  PaidPlanName,
  PlanLimit,
  PlanLimits,
  PlanName,
  QuotaDetail,
  QuotaResource,
} from '@asobeast/shared';
import { WorkspaceContext } from '../common/tenancy/workspace-context';
import { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { countKeywordMarkets } from './keyword-markets';
import { planScopeOf, selfHostedLimits, type PlanScope } from './plan-limits';
import { QuotaExceededError } from './quota.errors';

const ADMISSION_LOCK = 4_711_903;

type Tx = Prisma.TransactionClient;

export interface WorkspaceUsage {
  plan: PlanName;
  limits: PlanLimits;
  apps: number;
  keywordMarkets: number;
}

export type QuotaAdmission = <T>(tx: Tx, write: () => Promise<T>) => Promise<T>;

interface Admission<T> {
  tx: Tx;
  resource: QuotaResource;
  scope: string;
  write: () => Promise<T>;
  count: () => Promise<number>;
}

@Injectable()
export class QuotaService {
  private readonly selfHosted: PlanLimits;

  constructor(
    private readonly prisma: PrismaService,
    private readonly workspace: WorkspaceContext,
    private readonly config: ConfigService<Env, true>,
  ) {
    this.selfHosted = selfHostedLimits(
      config.get('AI_CALLS_PER_MONTH', { infer: true }),
    );
  }

  get enforced(): boolean {
    return this.config.get('BILLING_ENABLED', { infer: true });
  }

  upgradeFrom(plan: PlanName): PaidPlanName | null {
    return this.enforced ? nextPlan(plan) : null;
  }

  admitApp(): QuotaAdmission {
    return (tx, write) =>
      this.admit({
        tx,
        resource: 'apps',
        scope: '',
        write,
        count: () => countApps(tx),
      });
  }

  admitCompetitor(appId: string): QuotaAdmission {
    return (tx, write) =>
      this.admit({
        tx,
        resource: 'competitors',
        scope: appId,
        write,
        count: () => countCompetitors(tx, appId),
      });
  }

  admitKeywordMarkets<T>(write: (tx: Tx) => Promise<T>): Promise<T> {
    return this.prisma.withTransaction((tx) =>
      this.admit({
        tx,
        resource: 'keywordMarkets',
        scope: '',
        write: () => write(tx),
        count: () => countKeywordMarkets(tx),
      }),
    );
  }

  async assertRoom(resource: QuotaResource, scope = ''): Promise<void> {
    const { plan, limits } = await this.entitlement(this.prisma);
    const limit = limitOf(limits, resource);
    if (limit === null) return;

    const used = await this.countOf(resource, scope);
    if (used < limit) return;

    throw this.exceeded({ resource, plan, limit, used, requested: 1 });
  }

  async usage(): Promise<WorkspaceUsage> {
    const [{ plan, limits }, apps, keywordMarkets] = await Promise.all([
      this.entitlement(this.prisma),
      countApps(this.prisma),
      countKeywordMarkets(this.prisma),
    ]);
    return { plan, limits, apps, keywordMarkets };
  }

  planScope(): Promise<PlanScope> {
    return this.entitlement(this.prisma);
  }

  async limitsOf(): Promise<PlanLimits> {
    return (await this.planScope()).limits;
  }

  async limitFor(resource: QuotaResource): Promise<PlanLimit> {
    return limitOf(await this.limitsOf(), resource);
  }

  private async admit<T>({
    tx,
    resource,
    scope,
    write,
    count,
  }: Admission<T>): Promise<T> {
    const { plan, limits } = await this.entitlement(tx);
    const limit = limitOf(limits, resource);
    if (limit === null) return write();

    await this.serialize(tx, resource, scope);

    const before = await count();
    const result = await write();
    const after = await count();

    if (after > limit && after > before) {
      throw this.exceeded({
        resource,
        plan,
        limit,
        used: before,
        requested: after - before,
      });
    }
    return result;
  }

  private exceeded(detail: Omit<QuotaDetail, 'upgradeTo'>): QuotaExceededError {
    return new QuotaExceededError({
      ...detail,
      upgradeTo: this.upgradeFrom(detail.plan),
    });
  }

  private serialize(
    tx: Tx,
    resource: QuotaResource,
    scope: string,
  ): Promise<number> {
    const key = `${this.workspace.require('a quota admission')}~${resource}~${scope}`;
    return tx.$executeRaw`SELECT pg_advisory_xact_lock(${ADMISSION_LOCK}, hashtext(${key}))`;
  }

  private countOf(resource: QuotaResource, scope: string): Promise<number> {
    if (resource === 'apps') return countApps(this.prisma);
    if (resource === 'keywordMarkets') return countKeywordMarkets(this.prisma);
    return this.prisma.app.count({
      where: { primaryAppId: scope, isCompetitor: true },
    });
  }

  private async entitlement(client: Tx | PrismaService): Promise<PlanScope> {
    const workspace = this.enforced
      ? await client.workspace.findFirst({
          select: { plan: true, trialEndsAt: true, planExpiresAt: true },
        })
      : null;
    return planScopeOf(this.enforced, workspace, new Date(), this.selfHosted);
  }
}

function countApps(client: Tx | PrismaService): Promise<number> {
  return client.app.count({ where: { isCompetitor: false } });
}

function countCompetitors(client: Tx, appId: string): Promise<number> {
  return client.app.count({
    where: { primaryAppId: appId, isCompetitor: true },
  });
}

function limitOf(limits: PlanLimits, resource: QuotaResource): PlanLimit {
  if (resource === 'apps') return limits.apps;
  if (resource === 'keywordMarkets') return limits.keywordMarkets;
  return limits.competitorsPerApp;
}
