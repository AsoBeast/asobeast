import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { WorkspaceContext } from '../common/tenancy/workspace-context';
import type { SyncStoreReportsPayload } from '../jobs/jobs.types';
import type { ErrorTracking } from '../observability/error-tracking.service';
import type { StoreReportSyncService } from './store-report-sync.service';
import { StoreReportsWorker } from './store-reports.worker';

describe('StoreReportsWorker', () => {
  const job = {
    name: 'sync-store-reports',
    id: '1',
    data: { workspaceId: 'ws_1', store: 'APP_STORE' },
    queueName: 'store-connect',
    attemptsMade: 3,
    opts: { attempts: 3 },
    finishedOn: 1,
  } as unknown as Job<SyncStoreReportsPayload>;

  it("runs the sync inside the job's workspace scope", async () => {
    const workspace = new WorkspaceContext();
    let seen: string | undefined;
    const sync = {
      run: jest.fn(() => {
        seen = workspace.current;
        return Promise.resolve(null);
      }),
    };
    const worker = new StoreReportsWorker(
      sync as unknown as StoreReportSyncService,
      workspace,
      { capture: jest.fn() } as unknown as ErrorTracking,
    );

    await worker.process(job);

    expect(sync.run).toHaveBeenCalledWith('APP_STORE');
    expect(seen).toBe('ws_1');
  });

  it('reports a final failure', () => {
    const tracking = { capture: jest.fn() };
    const worker = new StoreReportsWorker(
      {} as StoreReportSyncService,
      new WorkspaceContext(),
      tracking as unknown as ErrorTracking,
    );

    worker.onFailed(job, new Error('boom'));

    expect(tracking.capture).toHaveBeenCalled();
  });
  it('logs every failed attempt with the store and the reason', () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    const worker = new StoreReportsWorker(
      {} as StoreReportSyncService,
      new WorkspaceContext(),
      { capture: jest.fn() } as unknown as ErrorTracking,
    );
    const attempt = {
      ...job,
      attemptsMade: 1,
      finishedOn: undefined,
    } as unknown as Job<SyncStoreReportsPayload>;

    worker.onFailed(attempt, new Error('database down'));

    expect(warn).toHaveBeenCalledWith(
      'store report sync APP_STORE failed on attempt 1 of 3: database down',
    );
    warn.mockRestore();
  });
});
