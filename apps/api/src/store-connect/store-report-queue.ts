import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import type { Store, StoreConnectionSyncResult } from '@asobeast/shared';
import { STORE_REPORT_JOB_OPTIONS } from '../jobs/job-options';
import {
  JOBS,
  QUEUES,
  storeReportsDeduplicationId,
  type SyncStoreReportsPayload,
} from '../jobs/jobs.types';

@Injectable()
export class StoreReportQueue {
  constructor(
    @InjectQueue(QUEUES.STORE_CONNECT) private readonly queue: Queue,
  ) {}

  async enqueue(
    workspaceId: string,
    store: Store,
  ): Promise<StoreConnectionSyncResult> {
    const payload: SyncStoreReportsPayload = { workspaceId, store };
    const job = await this.queue.add(JOBS.SYNC_STORE_REPORTS, payload, {
      ...STORE_REPORT_JOB_OPTIONS,
      deduplication: {
        id: storeReportsDeduplicationId(workspaceId, store),
        keepLastIfActive: true,
      },
    });
    const state = await job.getState();
    return { outcome: state === 'active' ? 'running' : 'queued' };
  }
}
