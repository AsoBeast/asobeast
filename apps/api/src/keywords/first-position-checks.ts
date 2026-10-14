import { InjectFlowProducer } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { FlowJobNode, FlowProducer } from 'bullmq';
import {
  WorkspaceContext,
  WorkspaceScope,
} from '../common/tenancy/workspace-context';
import { JOB_OPTIONS } from '../jobs/job-options';
import {
  FLOW_PRODUCERS,
  firstRunCheckJobId,
  JOBS,
  queueNameForStore,
  utcDateKey,
} from '../jobs/jobs.types';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FirstPositionChecks {
  constructor(
    private readonly prisma: PrismaService,
    @InjectFlowProducer(FLOW_PRODUCERS.FIRST_RUN)
    private readonly flowProducer: FlowProducer,
    private readonly workspace: WorkspaceContext,
  ) {}

  async schedule(appId: string, keywordIds: string[]): Promise<number> {
    if (keywordIds.length === 0) return 0;
    const scope = this.workspace.scopeFor(
      'the first positions of new keywords',
    );
    const checks = await this.jobsFor(appId, scope, keywordIds);
    if (checks.length > 0) {
      await this.flowProducer.addBulk(checks);
    }
    return checks.length;
  }

  async jobsFor(
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
