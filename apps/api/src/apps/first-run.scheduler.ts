import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Store } from '@prisma/client';
import { Queue } from 'bullmq';
import {
  WorkspaceContext,
  WorkspaceScope,
} from '../common/tenancy/workspace-context';
import { PrismaService } from '../prisma/prisma.service';
import { ActionRunQueue } from '../actions/action-run.queue';
import {
  firstRunCheckJobId,
  JOBS,
  QUEUES,
  queueNameForStore,
  utcDateKey,
} from '../jobs/jobs.types';

export interface FirstRunSchedule {
  ranked: number;
  actionsQueued: boolean;
}

@Injectable()
export class FirstRunScheduler {
  private readonly logger = new Logger(FirstRunScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUES.APP_STORE) private readonly appStoreQueue: Queue,
    @InjectQueue(QUEUES.GPLAY) private readonly gplayQueue: Queue,
    private readonly actionRuns: ActionRunQueue,
    private readonly workspace: WorkspaceContext,
  ) {}

  async schedule(appId: string): Promise<FirstRunSchedule> {
    const scope = this.workspace.scopeFor('the first run of an imported app');
    const date = utcDateKey();
    const schedule: FirstRunSchedule = {
      ranked: await this.enqueueRankChecks(appId, scope, date),
      actionsQueued: await this.enqueueActionRun(scope),
    };

    this.logger.log(`first run ${JSON.stringify(schedule)}`);
    return schedule;
  }

  private async enqueueRankChecks(
    appId: string,
    scope: WorkspaceScope,
    date: string,
  ): Promise<number> {
    const tracked = await this.prisma.trackedKeyword.findMany({
      where: { appId, active: true },
      select: { keywordId: true, keyword: { select: { store: true } } },
      orderBy: { createdAt: 'asc' },
    });

    for (const { keywordId, keyword } of tracked) {
      await this.queueFor(keyword.store).add(
        JOBS.CHECK_KEYWORD,
        { keywordId, ...scope },
        { jobId: firstRunCheckJobId(appId, keywordId, date) },
      );
    }
    return tracked.length;
  }

  private async enqueueActionRun(scope: WorkspaceScope): Promise<boolean> {
    return (await this.actionRuns.request(scope)).queued;
  }

  private queueFor(store: Store): Queue {
    return queueNameForStore(store) === QUEUES.GPLAY
      ? this.gplayQueue
      : this.appStoreQueue;
  }
}
