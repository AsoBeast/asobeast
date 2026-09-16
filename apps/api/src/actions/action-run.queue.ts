import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { ActionRunResult } from '@asobeast/shared';
import { WorkspaceScope } from '../common/tenancy/workspace-context';
import { actionsRunDeduplicationId, JOBS, QUEUES } from '../jobs/jobs.types';

@Injectable()
export class ActionRunQueue {
  constructor(@InjectQueue(QUEUES.PIPELINE) private readonly pipeline: Queue) {}

  async request(scope: WorkspaceScope): Promise<ActionRunResult> {
    const job = await this.pipeline.add(JOBS.ACTIONS, scope, {
      deduplication: { id: actionsRunDeduplicationId(scope.workspaceId) },
    });
    return { queued: true, jobId: job.id ?? '' };
  }
}
