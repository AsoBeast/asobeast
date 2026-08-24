import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job, Queue } from 'bullmq';
import type { Workspace } from '@prisma/client';
import {
  type SupportFailedJob,
  type SupportRunDay,
  type SupportWorkspaceDetail,
  type SupportWorkspaceSummary,
} from '@asobeast/shared';
import { planScopeOf } from '../auth/plan-limits';
import { scrubText } from '../common/logging/log-redaction';
import { CrossTenantAccess } from '../common/tenancy/cross-tenant-access';
import { Env } from '../config/env';
import { QUEUES } from '../jobs/jobs.types';
import { PrismaService } from '../prisma/prisma.service';
import { SupportAudit } from './support-audit.service';

const SUPPORT_JUSTIFICATION =
  'support answers operational questions about a workspace other than the operator own';

const RUN_HISTORY_DAYS = 7;
const FAILED_JOBS_SCANNED = 200;
const FAILED_JOBS_SHOWN = 20;
const REASON_LENGTH = 200;
const DAY_MS = 24 * 60 * 60_000;

interface CountRow {
  workspaceId: string;
  count: number;
}

interface RunRow {
  date: Date;
  captured: number;
  unresolved: number;
}

@Injectable()
export class SupportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crossTenant: CrossTenantAccess,
    private readonly config: ConfigService<Env, true>,
    private readonly audit: SupportAudit,
    @InjectQueue(QUEUES.APP_STORE) private readonly appStore: Queue,
    @InjectQueue(QUEUES.GPLAY) private readonly gplay: Queue,
  ) {}

  list(now = new Date()): Promise<SupportWorkspaceSummary[]> {
    return this.crossTenant.becauseThisWorkIsNotOwnedByOneWorkspace(
      SUPPORT_JUSTIFICATION,
      async () => {
        const workspaces = await this.prisma.workspace.findMany({
          orderBy: { createdAt: 'asc' },
        });
        const counts = await this.counts();
        return workspaces.map((workspace) =>
          this.summarize(workspace, counts, now),
        );
      },
    );
  }

  async detail(
    workspaceId: string,
    now = new Date(),
  ): Promise<SupportWorkspaceDetail> {
    const [summary, workspace] =
      await this.crossTenant.becauseThisWorkIsNotOwnedByOneWorkspace(
        SUPPORT_JUSTIFICATION,
        async () => {
          const row = await this.prisma.workspace.findUnique({
            where: { id: workspaceId },
          });
          if (!row) throw new NotFoundException('Workspace not found');
          return [this.summarize(row, await this.counts(), now), row] as const;
        },
      );

    const [runHistory, failedJobs, recentAccess] = await Promise.all([
      this.runHistory(workspaceId, now),
      this.failedJobs(workspaceId),
      this.audit.recent(workspaceId),
    ]);

    return {
      ...summary,
      limits: this.scopeOf(workspace, now).limits,
      runHistory,
      failedJobs,
      recentAccess,
    };
  }

  private summarize(
    workspace: Workspace,
    counts: {
      members: CountRow[];
      apps: CountRow[];
      competitors: CountRow[];
      keywords: CountRow[];
    },
    now: Date,
  ): SupportWorkspaceSummary {
    return {
      workspaceId: workspace.id,
      name: workspace.name,
      plan: this.scopeOf(workspace, now).plan,
      storedPlan: workspace.plan,
      createdAt: workspace.createdAt.toISOString(),
      suspendedAt: workspace.suspendedAt?.toISOString() ?? null,
      suspendedReason: workspace.suspendedReason,
      trialEndsAt: workspace.trialEndsAt?.toISOString() ?? null,
      planExpiresAt: workspace.planExpiresAt?.toISOString() ?? null,
      subscriptionStatus: workspace.subscriptionStatus,
      hasSubscription: workspace.subscriptionId !== null,
      members: countOf(counts.members, workspace.id),
      apps: countOf(counts.apps, workspace.id),
      competitors: countOf(counts.competitors, workspace.id),
      keywordMarkets: countOf(counts.keywords, workspace.id),
    };
  }

  private scopeOf(workspace: Workspace, now: Date) {
    return planScopeOf(
      this.config.get('BILLING_ENABLED', { infer: true }),
      workspace,
      now,
    );
  }

  private async counts() {
    const [members, apps, keywords] = await Promise.all([
      this.prisma.user.groupBy({
        by: ['workspaceId'],
        _count: { _all: true },
      }),
      this.prisma.app.groupBy({
        by: ['workspaceId', 'isCompetitor'],
        _count: { _all: true },
      }),
      this.prisma.$queryRaw<CountRow[]>`
        SELECT a."workspaceId", COUNT(*)::int AS count
        FROM "TrackedKeyword" t
        JOIN "App" a ON a."id" = t."appId"
        WHERE t."active" = true
        GROUP BY 1
      `,
    ]);

    return {
      members: members.map((row) => ({
        workspaceId: row.workspaceId,
        count: row._count._all,
      })),
      apps: apps
        .filter((row) => !row.isCompetitor)
        .map((row) => ({
          workspaceId: row.workspaceId,
          count: row._count._all,
        })),
      competitors: apps
        .filter((row) => row.isCompetitor)
        .map((row) => ({
          workspaceId: row.workspaceId,
          count: row._count._all,
        })),
      keywords,
    };
  }

  private runHistory(workspaceId: string, now: Date): Promise<SupportRunDay[]> {
    const since = new Date(now.getTime() - RUN_HISTORY_DAYS * DAY_MS);
    return this.crossTenant.becauseThisWorkIsNotOwnedByOneWorkspace(
      SUPPORT_JUSTIFICATION,
      async () => {
        const rows = await this.prisma.$queryRaw<RunRow[]>`
          SELECT "date",
                 COUNT(*)::int AS captured,
                 COUNT(*) FILTER (WHERE "position" IS NULL)::int AS unresolved
          FROM "KeywordRanking"
          WHERE "workspaceId" = ${workspaceId} AND "date" >= ${since}
          GROUP BY 1
          ORDER BY 1 DESC
        `;
        return rows.map((row) => ({
          date: row.date.toISOString().slice(0, 10),
          captured: row.captured,
          unresolved: row.unresolved,
        }));
      },
    );
  }

  private async failedJobs(workspaceId: string): Promise<SupportFailedJob[]> {
    const queues = [
      [QUEUES.APP_STORE, this.appStore],
      [QUEUES.GPLAY, this.gplay],
    ] as const;
    const perQueue = await Promise.all(
      queues.map(async ([name, queue]) => {
        const jobs = await queue.getFailed(0, FAILED_JOBS_SCANNED);
        return jobs
          .filter((job) => workspaceOfJob(job) === workspaceId)
          .map((job) => toFailedJob(job, name));
      }),
    );
    return perQueue
      .flat()
      .sort((left, right) =>
        (right.failedAt ?? '').localeCompare(left.failedAt ?? ''),
      )
      .slice(0, FAILED_JOBS_SHOWN);
  }
}

function workspaceOfJob(job: Job): string | undefined {
  const data = job.data as { workspaceId?: string } | undefined;
  return data?.workspaceId;
}

function toFailedJob(job: Job, queue: string): SupportFailedJob {
  return {
    id: job.id ?? 'unknown',
    name: job.name,
    queue,
    attempts: job.attemptsMade,
    failedAt: job.finishedOn ? new Date(job.finishedOn).toISOString() : null,
    reason: scrubText(job.failedReason ?? 'unknown', []).slice(
      0,
      REASON_LENGTH,
    ),
  };
}

function countOf(rows: CountRow[], workspaceId: string): number {
  return rows.find((row) => row.workspaceId === workspaceId)?.count ?? 0;
}
