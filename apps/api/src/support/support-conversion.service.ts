import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ADMIN_LIST_LIMIT,
  type AdminConversion,
  type AdminConversionWindow,
  type AdminDeparture,
  type AdminDepartureList,
} from '@asobeast/shared';
import { deletionReasonOf, isPlanName } from '../account/workspace-departures';
import { OWNER_ROLE } from '../auth/workspace-roles';
import {
  WORKSPACE_STAGE_SELECT,
  isWorkspaceStage,
} from '../billing/workspace-stage';
import { CrossTenantAccess } from '../common/tenancy/cross-tenant-access';
import { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import {
  cohortStartOf,
  conversionOf,
  windowStartOf,
  type FunnelWorkspace,
} from './conversion-tallies';

const CONVERSION_JUSTIFICATION =
  'the operator conversion report counts every workspace without reading their data';

const DEPARTURES_MIGRATION = '20261115131151_record_workspace_departures';

const CONVERSION_SOURCE = {
  id: true,
  createdAt: true,
  ...WORKSPACE_STAGE_SELECT,
} as const;

const dayOf = (moment: Date) => moment.toISOString().slice(0, 10);

interface DepartureRecord {
  id: string;
  erasedOn: Date;
  createdOn: Date;
  requestedOn: Date;
  stage: string;
  plan: string;
  everPaid: boolean;
  apps: number;
  keywordMarkets: number;
  members: number;
  reason: string | null;
}

function adminDepartureOf(row: DepartureRecord): AdminDeparture[] {
  const { stage, plan } = row;
  if (!isWorkspaceStage(stage) || !isPlanName(plan)) return [];
  return [
    {
      ...row,
      erasedOn: dayOf(row.erasedOn),
      createdOn: dayOf(row.createdOn),
      requestedOn: dayOf(row.requestedOn),
      stage,
      plan,
      reason: deletionReasonOf(row.reason),
    },
  ];
}

@Injectable()
export class SupportConversionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crossTenant: CrossTenantAccess,
    private readonly config: ConfigService<Env, true>,
  ) {}

  conversion(
    days: AdminConversionWindow,
    now = new Date(),
  ): Promise<AdminConversion> {
    return this.crossTenant.becauseThisWorkIsNotOwnedByOneWorkspace(
      CONVERSION_JUSTIFICATION,
      async () => {
        const start = windowStartOf(now, days);
        const since = new Date(
          Math.min(start.getTime(), cohortStartOf(now).getTime()),
        );
        const [funnel, workspaces, departures, recordedSince] =
          await Promise.all([
            this.funnelSince(since),
            this.prisma.workspace.findMany({ select: CONVERSION_SOURCE }),
            this.prisma.workspaceDeparture.findMany({
              where: { erasedOn: { gte: new Date(dayOf(start)) } },
              select: { stage: true, reason: true },
            }),
            this.departuresRecordedSince(),
          ]);
        return conversionOf({
          billing: this.config.get('BILLING_ENABLED', { infer: true }),
          days,
          now,
          funnel,
          workspaces,
          departures,
          departuresRecordedSince: recordedSince,
        });
      },
    );
  }

  departures(): Promise<AdminDepartureList> {
    return this.crossTenant.becauseThisWorkIsNotOwnedByOneWorkspace(
      CONVERSION_JUSTIFICATION,
      async () => {
        const [rows, total] = await Promise.all([
          this.prisma.workspaceDeparture.findMany({
            orderBy: [{ erasedOn: 'desc' }, { id: 'desc' }],
            take: ADMIN_LIST_LIMIT,
          }),
          this.prisma.workspaceDeparture.count(),
        ]);
        return {
          items: rows.flatMap(adminDepartureOf),
          total,
          limit: ADMIN_LIST_LIMIT,
        };
      },
    );
  }

  private funnelSince(since: Date): Promise<FunnelWorkspace[]> {
    return this.prisma.$queryRaw<FunnelWorkspace[]>`
      SELECT w."id", w."createdAt", w."plan", w."trialEndsAt", w."planExpiresAt",
             w."subscriptionId", w."subscriptionStatus", w."trialStartedAt", w."firstPaidAt",
             EXISTS (
               SELECT 1 FROM "User" u
               WHERE u."workspaceId" = w."id"
                 AND u."role" = ${OWNER_ROLE}
                 AND u."emailVerifiedAt" IS NOT NULL
             ) AS "confirmedEmail",
             (
               SELECT MIN(a."createdAt") FROM "App" a
               WHERE a."workspaceId" = w."id" AND a."isCompetitor" = false
             ) AS "firstAppAt",
             EXISTS (
               SELECT 1 FROM "App" a
               JOIN "KeywordRanking" r ON r."appId" = a."id"
               WHERE a."workspaceId" = w."id"
                 AND a."isCompetitor" = false
                 AND r."position" IS NOT NULL
                 AND r."createdAt" <= a."createdAt" + interval '1 day'
             ) AS "rankedWithinADay"
      FROM "Workspace" w
      WHERE w."createdAt" >= ${since}
    `;
  }

  private async departuresRecordedSince(): Promise<string | null> {
    const [row] = await this.prisma.$queryRaw<{ finishedAt: Date | null }[]>`
      SELECT "finished_at" AS "finishedAt" FROM "_prisma_migrations"
      WHERE "migration_name" = ${DEPARTURES_MIGRATION}
    `;
    return row?.finishedAt ? dayOf(row.finishedAt) : null;
  }
}
