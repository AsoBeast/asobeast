import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { WorkspaceContext } from '../common/tenancy/workspace-context';
import type { SyncStoreReportsPayload } from '../jobs/jobs.types';
import type { ErrorTracking } from '../observability/error-tracking.service';
import type { AscReportSync } from './asc-report-sync.service';
import type { PlayReportSync } from './play/play-report-sync.service';
import { StoreReportSyncService } from './store-report-sync.service';
import { StoreReportsWorker } from './store-reports.worker';
import { emptySummary } from './store-sync-summary';

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

    expect(sync.run).toHaveBeenCalledWith('APP_STORE', true);
    expect(seen).toBe('ws_1');
  });

  describe('a sync that leaves apps or reports behind', () => {
    const partial = { ...emptySummary(), instances: 4, failed: 1 };
    const workerOver = () => {
      const appStore = { run: jest.fn().mockResolvedValue(partial) };
      const worker = new StoreReportsWorker(
        new StoreReportSyncService(
          appStore as unknown as AscReportSync,
          {} as PlayReportSync,
        ),
        new WorkspaceContext(),
        { capture: jest.fn() } as unknown as ErrorTracking,
      );
      return { worker, appStore };
    };

    it('fails an attempt that is not the last so the job tries the failures again', async () => {
      const { worker, appStore } = workerOver();
      const firstAttempt = {
        ...job,
        attemptsMade: 0,
      } as unknown as Job<SyncStoreReportsPayload>;

      await expect(worker.process(firstAttempt)).rejects.toThrow(
        'the sync tries again after 1 failure',
      );
      expect(appStore.run).toHaveBeenCalledWith(false);
    });

    it('completes an attempt a rate limit ended, since a retry would meet the same limit', async () => {
      const { worker, appStore } = workerOver();
      appStore.run.mockResolvedValue({ ...partial, rateLimited: true });
      const firstAttempt = {
        ...job,
        attemptsMade: 0,
      } as unknown as Job<SyncStoreReportsPayload>;

      await expect(worker.process(firstAttempt)).resolves.toBeUndefined();
    });

    it('completes the last attempt and leaves the warning to the sync', async () => {
      const { worker, appStore } = workerOver();
      const lastAttempt = {
        ...job,
        attemptsMade: 2,
      } as unknown as Job<SyncStoreReportsPayload>;

      await expect(worker.process(lastAttempt)).resolves.toBeUndefined();
      expect(appStore.run).toHaveBeenCalledWith(true);
    });
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
