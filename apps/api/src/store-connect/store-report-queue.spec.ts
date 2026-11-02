import { Store } from '@prisma/client';
import type { Queue } from 'bullmq';
import { JOBS, storeReportsDeduplicationId } from '../jobs/jobs.types';
import { STORE_REPORT_JOB_OPTIONS } from '../jobs/job-options';
import { StoreReportQueue } from './store-report-queue';

describe('StoreReportQueue.enqueue', () => {
  it('queues the report for the workspace and store', async () => {
    const add = jest
      .fn()
      .mockResolvedValue({ getState: () => Promise.resolve('queued') });
    const queue = new StoreReportQueue({ add } as unknown as Queue);

    await expect(queue.enqueue('ws_1', Store.APP_STORE)).resolves.toEqual({
      outcome: 'queued',
    });
    expect(add).toHaveBeenCalledWith(
      JOBS.SYNC_STORE_REPORTS,
      { workspaceId: 'ws_1', store: Store.APP_STORE },
      {
        ...STORE_REPORT_JOB_OPTIONS,
        deduplication: {
          id: storeReportsDeduplicationId('ws_1', Store.APP_STORE),
          keepLastIfActive: true,
        },
      },
    );
  });

  it('answers running when the deduplicated job is already active', async () => {
    const add = jest
      .fn()
      .mockResolvedValue({ getState: () => Promise.resolve('active') });
    const queue = new StoreReportQueue({ add } as unknown as Queue);

    await expect(queue.enqueue('ws_1', Store.APP_STORE)).resolves.toEqual({
      outcome: 'running',
    });
  });
});
