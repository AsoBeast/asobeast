import { InjectFlowProducer } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { FlowJobNode, FlowProducer } from 'bullmq';
import { ActionRunQueue } from '../actions/action-run.queue';
import {
  WorkspaceContext,
  WorkspaceScope,
} from '../common/tenancy/workspace-context';
import { JOB_OPTIONS } from '../jobs/job-options';
import {
  FLOW_PRODUCERS,
  firstRunCheckJobId,
  JOBS,
  QUEUES,
  queueNameForStore,
  utcDateKey,
} from '../jobs/jobs.types';
import { PrismaService } from '../prisma/prisma.service';

export interface FirstRunSchedule {
  ranked: number;
  actionsQueued: boolean;
}

@Injectable()
export class FirstRunScheduler {
  private readonly logger = new Logger(FirstRunScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectFlowProducer(FLOW_PRODUCERS.FIRST_RUN)
    private readonly flowProducer: FlowProducer,
    private readonly actionRuns: ActionRunQueue,
    private readonly workspace: WorkspaceContext,
  ) {}

  async schedule(appId: string): Promise<FirstRunSchedule> {
    const scope = this.workspace.scopeFor('the first run of an imported app');
    const checks = await this.rankChecks(appId, scope);

    if (checks.length === 0) {
      await this.actionRuns.request(scope);
    } else {
      await this.flowProducer.add(
        {
          name: JOBS.ACTIONS,
          queueName: QUEUES.PIPELINE,
          data: scope,
          opts: JOB_OPTIONS,
          children: checks,
        },
        {
          queuesOptions: {
            [QUEUES.PIPELINE]: { defaultJobOptions: JOB_OPTIONS },
            [QUEUES.APP_STORE]: { defaultJobOptions: JOB_OPTIONS },
            [QUEUES.GPLAY]: { defaultJobOptions: JOB_OPTIONS },
          },
        },
      );
    }

    const schedule: FirstRunSchedule = {
      ranked: checks.length,
      actionsQueued: true,
    };
    this.logger.log(`first run ${JSON.stringify(schedule)}`);
    return schedule;
  }

  async checkKeywords(appId: string, keywordIds: string[]): Promise<number> {
    if (keywordIds.length === 0) return 0;
    const scope = this.workspace.scopeFor(
      'the first positions of new keywords',
    );
    const checks = await this.rankChecks(appId, scope, keywordIds);
    if (checks.length > 0) {
      await this.flowProducer.addBulk(checks);
    }
    return checks.length;
  }

  private async rankChecks(
    appId: string,
    scope: WorkspaceScope,
    keywordIds?: string[],
  ): Promise<FlowJobNode[]> {
    const date = utcDateKey();
    const tracked = await this.prisma.trackedKeyword.findMany({
      where: {
        appId,
        active: true,
        ...(keywordIds ? { keywordId: { in: keywordIds } } : {}),
      },
      select: { keywordId: true, keyword: { select: { store: true } } },
      orderBy: { createdAt: 'asc' },
    });

    return tracked.map(({ keywordId, keyword }) => ({
      name: JOBS.CHECK_KEYWORD,
      queueName: queueNameForStore(keyword.store),
      data: { keywordId, ...scope },
      opts: {
        ...JOB_OPTIONS,
        jobId: firstRunCheckJobId(appId, keywordId, date),
        removeDependencyOnFailure: true,
      },
    }));
  }
}
