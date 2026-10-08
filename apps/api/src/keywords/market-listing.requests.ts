import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import { listingIn } from '../apps/listing';
import { WorkspaceContext } from '../common/tenancy/workspace-context';
import { enqueueReplacingFailed } from '../jobs/enqueue-replacing-failed';
import { JOB_OPTIONS } from '../jobs/job-options';
import { JOBS, QUEUES, refreshJobId, utcDateKey } from '../jobs/jobs.types';
import { PrismaService } from '../prisma/prisma.service';
import { KeywordApp, queueFor } from './keywords.support';

@Injectable()
export class MarketListingRequests {
  private readonly logger = new Logger(MarketListingRequests.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUES.APP_STORE) private readonly appStoreQueue: Queue,
    @InjectQueue(QUEUES.GPLAY) private readonly gplayQueue: Queue,
    private readonly workspace: WorkspaceContext,
  ) {}

  async request(app: KeywordApp, market: string): Promise<number> {
    if (market === app.country) return 0;
    try {
      return await this.queueMissing(app, market);
    } catch (error: unknown) {
      this.logger.error(
        `could not queue the ${market} listing of ${app.id}, so it waits for the next daily run: ${reason(error)}`,
      );
      return 0;
    }
  }

  private async queueMissing(app: KeywordApp, market: string): Promise<number> {
    const family = await this.prisma.app.findMany({
      where: { OR: [{ id: app.id }, { primaryAppId: app.id }] },
      select: { id: true },
    });
    const captured = await this.prisma.appSnapshot.groupBy({
      by: ['appId'],
      where: {
        appId: { in: family.map((member) => member.id) },
        ...listingIn(app.country, market),
      },
    });
    const have = new Set(captured.map((row) => row.appId));
    const scope = this.workspace.scopeFor('a market listing request');
    const date = utcDateKey();
    const queue = queueFor(app.store, this.appStoreQueue, this.gplayQueue);
    const queued = await Promise.all(
      family
        .filter((member) => !have.has(member.id))
        .map((member) =>
          enqueueReplacingFailed(
            queue,
            JOBS.REFRESH_APP,
            { appId: member.id, country: market, ...scope },
            { ...JOB_OPTIONS, jobId: refreshJobId(member.id, date, market) },
          ),
        ),
    );
    return queued.filter(Boolean).length;
  }
}

function reason(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
