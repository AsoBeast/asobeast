import { InjectFlowProducer } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { FlowProducer } from 'bullmq';
import { ActionRunQueue } from '../actions/action-run.queue';
import { WorkspaceContext } from '../common/tenancy/workspace-context';
import { JOB_OPTIONS } from '../jobs/job-options';
import { FLOW_PRODUCERS, JOBS, QUEUES } from '../jobs/jobs.types';
import { FirstPositionChecks } from '../keywords/first-position-checks';

export interface FirstRunSchedule {
  ranked: number;
  actionsQueued: boolean;
}

@Injectable()
export class FirstRunScheduler {
  private readonly logger = new Logger(FirstRunScheduler.name);

  constructor(
    @InjectFlowProducer(FLOW_PRODUCERS.FIRST_RUN)
    private readonly flowProducer: FlowProducer,
    private readonly actionRuns: ActionRunQueue,
    private readonly workspace: WorkspaceContext,
    private readonly checks: FirstPositionChecks,
  ) {}

  async schedule(appId: string): Promise<FirstRunSchedule> {
    const scope = this.workspace.scopeFor('the first run of an imported app');
    const checks = await this.checks.jobsFor(appId, scope);

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
}
