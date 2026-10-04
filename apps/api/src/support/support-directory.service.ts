import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ADMIN_LIST_LIMIT,
  type AdminAppList,
  type AdminUserList,
} from '@asobeast/shared';
import { planScopeOf } from '../auth/plan-limits';
import { isPlatformOperator } from '../auth/platform-operator';
import { CrossTenantAccess } from '../common/tenancy/cross-tenant-access';
import { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';

const DIRECTORY_JUSTIFICATION =
  'the operator directory lists accounts and apps across every workspace';

const NEWEST_FIRST = [{ createdAt: 'desc' }, { id: 'desc' }] satisfies {
  createdAt?: 'desc';
  id?: 'desc';
}[];

const inWorkspace = (workspaceId: string | undefined) =>
  workspaceId ? { workspaceId } : {};

@Injectable()
export class SupportDirectoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crossTenant: CrossTenantAccess,
    private readonly config: ConfigService<Env, true>,
  ) {}

  users(
    workspaceId: string | undefined,
    now = new Date(),
  ): Promise<AdminUserList> {
    return this.crossTenant.becauseThisWorkIsNotOwnedByOneWorkspace(
      DIRECTORY_JUSTIFICATION,
      async () => {
        const where = inWorkspace(workspaceId);
        const [rows, total] = await Promise.all([
          this.prisma.user.findMany({
            where,
            orderBy: NEWEST_FIRST,
            take: ADMIN_LIST_LIMIT,
            select: {
              id: true,
              email: true,
              name: true,
              role: true,
              emailVerifiedAt: true,
              createdAt: true,
              workspaceId: true,
              workspace: {
                select: {
                  name: true,
                  plan: true,
                  trialEndsAt: true,
                  planExpiresAt: true,
                },
              },
            },
          }),
          this.prisma.user.count({ where }),
        ]);
        const billing = this.config.get('BILLING_ENABLED', { infer: true });
        return {
          items: rows.map((row) => ({
            id: row.id,
            email: row.email,
            name: row.name,
            role: row.role,
            emailVerified: row.emailVerifiedAt !== null,
            platformOperator: isPlatformOperator(row),
            createdAt: row.createdAt.toISOString(),
            workspaceId: row.workspaceId,
            workspaceName: row.workspace.name,
            workspacePlan: planScopeOf(billing, row.workspace, now).plan,
          })),
          total,
          limit: ADMIN_LIST_LIMIT,
        };
      },
    );
  }

  apps(workspaceId: string | undefined): Promise<AdminAppList> {
    return this.crossTenant.becauseThisWorkIsNotOwnedByOneWorkspace(
      DIRECTORY_JUSTIFICATION,
      async () => {
        const where = { isCompetitor: false, ...inWorkspace(workspaceId) };
        const [rows, total] = await Promise.all([
          this.prisma.app.findMany({
            where,
            orderBy: NEWEST_FIRST,
            take: ADMIN_LIST_LIMIT,
            select: {
              id: true,
              workspaceId: true,
              store: true,
              storeAppId: true,
              country: true,
              name: true,
              iconUrl: true,
              createdAt: true,
              workspace: { select: { name: true } },
              _count: { select: { competitors: true } },
            },
          }),
          this.prisma.app.count({ where }),
        ]);
        const markets = await this.keywordMarketsOf(rows.map((row) => row.id));
        return {
          items: rows.map((row) => ({
            id: row.id,
            workspaceId: row.workspaceId,
            workspaceName: row.workspace.name,
            store: row.store,
            storeAppId: row.storeAppId,
            country: row.country,
            name: row.name,
            iconUrl: row.iconUrl,
            competitors: row._count.competitors,
            keywordMarkets: markets.get(row.id) ?? 0,
            createdAt: row.createdAt.toISOString(),
          })),
          total,
          limit: ADMIN_LIST_LIMIT,
        };
      },
    );
  }

  private async keywordMarketsOf(
    appIds: string[],
  ): Promise<Map<string, number>> {
    const rows = await this.prisma.trackedKeyword.groupBy({
      by: ['appId'],
      where: { active: true, appId: { in: appIds } },
      _count: { _all: true },
    });
    return new Map(rows.map((row) => [row.appId, row._count._all]));
  }
}
