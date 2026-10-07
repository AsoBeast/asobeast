import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import { WorkspaceContext } from '../common/tenancy/workspace-context';
import { READ_SCREENSHOTS_JOB_OPTIONS } from '../jobs/job-options';
import {
  JOBS,
  QUEUES,
  ReadScreenshotsPayload,
  readScreenshotsJobId,
} from '../jobs/jobs.types';

@Injectable()
export class ScreenshotQueue {
  private readonly logger = new Logger(ScreenshotQueue.name);

  constructor(
    @InjectQueue(QUEUES.SCREENSHOTS) private readonly queue: Queue,
    private readonly workspace: WorkspaceContext,
  ) {}

  async request(appId: string, snapshotId: string): Promise<void> {
    const payload: ReadScreenshotsPayload = {
      ...this.workspace.scopeFor('a screenshot read'),
      appId,
      snapshotId,
    };
    try {
      await this.queue.add(JOBS.READ_SCREENSHOTS, payload, {
        ...READ_SCREENSHOTS_JOB_OPTIONS,
        jobId: readScreenshotsJobId(snapshotId),
      });
    } catch (error: unknown) {
      this.logger.error(
        `could not queue the screenshot read for snapshot ${snapshotId}, so its captions wait for the next refresh: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
