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
});
