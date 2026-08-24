import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CrossTenantAccess } from '../common/tenancy/cross-tenant-access';
import { WorkspaceContext } from '../common/tenancy/workspace-context';
import { Env } from '../config/env';
import { applyKeywordLimit } from '../jobs/over-limit';
import { PrismaService } from '../prisma/prisma.service';
import { isEntitled } from './entitlement';
import { QuotaService } from './quota.service';

const ROSTER_JUSTIFICATION =
  'one shared search serves many workspaces, and each must be judged before its own rows are written';

const COVERAGE_CONCURRENCY = 4;

interface MeteredWorkspace {
  id: string;
  overLimitSince: Date;
}

@Injectable()
export class CollectionEligibility {
  private readonly logger = new Logger(CollectionEligibility.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crossTenant: CrossTenantAccess,
    private readonly config: ConfigService<Env, true>,
    private readonly workspace: WorkspaceContext,
    private readonly quota: QuotaService,
  ) {}

  async forKeyword(
    workspaceIds: Iterable<string>,
    keywordId: string,
    now = new Date(),
  ): Promise<Set<string>> {
    const ids = [...new Set(workspaceIds)];
    if (ids.length === 0) return new Set();

    const rows = await this.crossTenant.becauseThisWorkIsNotOwnedByOneWorkspace(
      ROSTER_JUSTIFICATION,
      () => this.rosterOf(ids),
    );
    const metered = this.config.get('BILLING_ENABLED', { infer: true });

    const eligible = new Set<string>();
    const metering: MeteredWorkspace[] = [];
    for (const row of rows) {
      if (row.suspendedAt !== null) continue;
      if (metered && !isEntitled(row, now)) continue;
      if (row.overLimitSince === null) {
        eligible.add(row.id);
        continue;
      }
      metering.push({ id: row.id, overLimitSince: row.overLimitSince });
    }

    for (let from = 0; from < metering.length; from += COVERAGE_CONCURRENCY) {
      const batch = metering.slice(from, from + COVERAGE_CONCURRENCY);
      const covered = await Promise.all(
        batch.map((row) => this.covers(row, keywordId, now)),
      );
      batch.forEach((row, index) => {
        if (covered[index]) eligible.add(row.id);
      });
    }

    const skipped = ids.length - eligible.size;
    if (skipped > 0) {
      this.logger.debug(
        `keyword ${keywordId} skips ${skipped} suspended, unentitled or over-limit workspaces`,
      );
    }
    return eligible;
  }

  private covers(
    row: MeteredWorkspace,
    keywordId: string,
    now: Date,
  ): Promise<boolean> {
    return this.workspace.run(row.id, async () => {
      const limit = await this.quota.limitFor('keywordMarkets');
      if (limit === null) return true;

      const tracked = await this.prisma.trackedKeyword.findMany({
        where: { active: true },
        select: { keywordId: true },
        distinct: ['keywordId'],
      });
      const { covered } = applyKeywordLimit({
        keywords: tracked,
        limit,
        overLimitSince: row.overLimitSince,
        now,
      });
      return covered.some((entry) => entry.keywordId === keywordId);
    });
  }

  private rosterOf(ids: string[]) {
    return this.prisma.workspace.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        plan: true,
        trialEndsAt: true,
        planExpiresAt: true,
        suspendedAt: true,
        overLimitSince: true,
      },
    });
  }
}
