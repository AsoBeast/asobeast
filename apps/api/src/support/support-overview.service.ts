import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { STORES, type AdminOverview } from '@asobeast/shared';
import { SPENDING_STATUSES } from '../ai/ai-gateway.service';
import { aiPeriodOf } from '../ai/ai-period';
import { CrossTenantAccess } from '../common/tenancy/cross-tenant-access';
import { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import {
  countsByKey,
  signupSeries,
  signupWindowStart,
  tallyWorkspaces,
  type DailyCount,
} from './overview-tallies';

const OVERVIEW_JUSTIFICATION =
  'the operator overview counts every workspace without reading their data';

const DAY_MS = 24 * 60 * 60_000;

@Injectable()
export class SupportOverviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crossTenant: CrossTenantAccess,
    private readonly config: ConfigService<Env, true>,
  ) {}

  overview(now = new Date()): Promise<AdminOverview> {
    return this.crossTenant.becauseThisWorkIsNotOwnedByOneWorkspace(
      OVERVIEW_JUSTIFICATION,
      async () => {
        const billing = this.config.get('BILLING_ENABLED', { infer: true });
        const since = signupWindowStart(now);
        const [workspaces, users, apps, keywords, aiCallsThisMonth, signups] =
          await Promise.all([
            this.workspaceRows(),
            this.userTotals(now),
            this.appTotals(),
            this.keywordTotals(),
            this.aiCallsSince(aiPeriodOf(now).start),
            this.signupsSince(since),
          ]);
        return {
          generatedAt: now.toISOString(),
          billing,
          workspaces: tallyWorkspaces(workspaces, billing, now),
          users,
          apps,
          keywords,
          aiCallsThisMonth,
          signups: signupSeries(signups.users, signups.workspaces, now),
        };
      },
    );
  }

  private workspaceRows() {
    return this.prisma.workspace.findMany({
      select: {
        plan: true,
        trialEndsAt: true,
        planExpiresAt: true,
        suspendedAt: true,
        deletionDueAt: true,
      },
    });
  }

  private async userTotals(now: Date): Promise<AdminOverview['users']> {
    const joinedSince = (days: number) => ({
      createdAt: { gte: new Date(now.getTime() - days * DAY_MS) },
    });
    const [total, emailVerified, joinedLast7Days, joinedLast30Days] =
      await Promise.all([
        this.prisma.user.count(),
        this.prisma.user.count({ where: { emailVerifiedAt: { not: null } } }),
        this.prisma.user.count({ where: joinedSince(7) }),
        this.prisma.user.count({ where: joinedSince(30) }),
      ]);
    return { total, emailVerified, joinedLast7Days, joinedLast30Days };
  }

  private async appTotals(): Promise<AdminOverview['apps']> {
    const rows = await this.prisma.app.groupBy({
      by: ['store', 'isCompetitor'],
      _count: { _all: true },
    });
    const sum = (competitor: boolean) =>
      rows
        .filter((row) => row.isCompetitor === competitor)
        .reduce((total, row) => total + row._count._all, 0);
    return {
      tracked: sum(false),
      competitors: sum(true),
      byStore: countsByKey(
        STORES,
        rows
          .filter((row) => !row.isCompetitor)
          .map((row) => ({ key: row.store, count: row._count._all })),
      ),
    };
  }

  private async keywordTotals(): Promise<AdminOverview['keywords']> {
    const [row] = await this.prisma.$queryRaw<AdminOverview['keywords'][]>`
      SELECT COUNT(*)::int AS "trackedMarkets",
             COUNT(DISTINCT t."keywordId")::int AS "searched",
             COUNT(DISTINCT (k."store", k."country"))::int AS "storefronts"
      FROM "TrackedKeyword" t
      JOIN "Keyword" k ON k."id" = t."keywordId"
      WHERE t."active" = true
    `;
    return row;
  }

  private aiCallsSince(start: Date): Promise<number> {
    return this.prisma.aiCall.count({
      where: { status: { in: SPENDING_STATUSES }, createdAt: { gte: start } },
    });
  }

  private async signupsSince(
    since: Date,
  ): Promise<{ users: DailyCount[]; workspaces: DailyCount[] }> {
    const [users, workspaces] = await Promise.all([
      this.prisma.$queryRaw<DailyCount[]>`
        SELECT to_char("createdAt", 'YYYY-MM-DD') AS "date", COUNT(*)::int AS "count"
        FROM "User"
        WHERE "createdAt" >= ${since}
        GROUP BY 1
      `,
      this.prisma.$queryRaw<DailyCount[]>`
        SELECT to_char("createdAt", 'YYYY-MM-DD') AS "date", COUNT(*)::int AS "count"
        FROM "Workspace"
        WHERE "createdAt" >= ${since}
        GROUP BY 1
      `,
    ]);
    return { users, workspaces };
  }
}
