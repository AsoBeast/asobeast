import { App, AppSnapshot, Store } from '@prisma/client';
import { Queue } from 'bullmq';
import { WorkspaceContext } from '../common/tenancy/workspace-context';
import { JOBS } from '../jobs/jobs.types';
import { KeywordsService } from '../keywords/keywords.service';
import { PrismaService } from '../prisma/prisma.service';
import { StoreRequestError } from '../store-providers/errors';
import { StoreProviderRegistry } from '../store-providers/store-provider.registry';
import { NormalizedApp } from '../store-providers/types';
import { FirstRunScheduler } from './first-run.scheduler';
import { SubtitleBackfill } from './subtitle-backfill.service';

const APP_ID = 'app_1';
const SNAPSHOT_ID = 'snap_1';
const CAPTURED_AT = new Date('2026-09-17T09:15:02Z');
const PAYLOAD = {
  appId: APP_ID,
  snapshotId: SNAPSHOT_ID,
  workspaceId: 'ws_1',
};

function backfillWith(listing: Partial<NormalizedApp> = {}) {
  const add = jest.fn().mockResolvedValue({});
  const appFindFirst = jest.fn().mockResolvedValue({
    store: Store.APP_STORE,
    storeAppId: '6473753684',
    country: 'pl',
  });
  const snapshotFindFirst = jest
    .fn()
    .mockResolvedValue({ capturedAt: CAPTURED_AT });
  const updateMany = jest.fn().mockResolvedValue({ count: 1 });
  const getApp = jest.fn().mockResolvedValue({
    subtitle: 'AI assistant for life and work',
    subtitleUnavailable: false,
    ...listing,
  });
  const syncFromSnapshot = jest.fn().mockResolvedValue(undefined);
  const trackedFindMany = jest.fn().mockResolvedValue([]);
  const checkKeywords = jest.fn().mockResolvedValue(0);
  const workspace = new WorkspaceContext();
  const backfill = new SubtitleBackfill(
    {
      app: { findFirst: appFindFirst },
      appSnapshot: { findFirst: snapshotFindFirst, updateMany },
      trackedKeyword: { findMany: trackedFindMany },
    } as unknown as PrismaService,
    { get: () => ({ getApp }) } as unknown as StoreProviderRegistry,
    { syncFromSnapshot } as unknown as KeywordsService,
    { checkKeywords } as unknown as FirstRunScheduler,
    workspace,
    { add } as unknown as Queue,
  );
  const inWorkspace = <T>(work: () => Promise<T>): Promise<T> =>
    workspace.runScope({ workspaceId: 'ws_1' }, work);

  return {
    backfill,
    add,
    appFindFirst,
    updateMany,
    getApp,
    syncFromSnapshot,
    trackedFindMany,
    checkKeywords,
    inWorkspace,
  };
}

describe('SubtitleBackfill', () => {
  describe('request', () => {
    const app = { id: APP_ID } as App;
    const snapshot = { id: SNAPSHOT_ID } as AppSnapshot;

    it('queues once per app', async () => {
      const { backfill, add, inWorkspace } = backfillWith();

      await inWorkspace(() => backfill.request(app, snapshot));

      expect(add).toHaveBeenCalledWith(
        JOBS.RESOLVE_SUBTITLE,
        expect.objectContaining(PAYLOAD),
        expect.objectContaining({
          jobId: 'subtitle~app_1',
          attempts: 6,
          delay: 15_000,
        }),
      );
    });

    it('lets the import succeed when the queue is unreachable', async () => {
      const { backfill, add, inWorkspace } = backfillWith();
      add.mockRejectedValueOnce(new Error('connect ECONNREFUSED'));

      await expect(
        inWorkspace(() => backfill.request(app, snapshot)),
      ).resolves.toBeUndefined();
    });
  });

  describe('resolve', () => {
    it('fails the attempt while the product page is unreadable', async () => {
      const { backfill, updateMany } = backfillWith({
        subtitle: undefined,
        subtitleUnavailable: true,
      });

      await expect(backfill.resolve(PAYLOAD)).rejects.toBeInstanceOf(
        StoreRequestError,
      );
      expect(updateMany).not.toHaveBeenCalled();
    });

    it('keeps the stored null when the listing has no subtitle', async () => {
      const { backfill, updateMany } = backfillWith({
        subtitle: undefined,
        subtitleUnavailable: false,
      });

      await expect(backfill.resolve(PAYLOAD)).resolves.toBeUndefined();
      expect(updateMany).not.toHaveBeenCalled();
    });

    it('fills the empty snapshots since the import and ranks the keywords it adds', async () => {
      const {
        backfill,
        updateMany,
        getApp,
        syncFromSnapshot,
        trackedFindMany,
        checkKeywords,
      } = backfillWith();
      trackedFindMany
        .mockResolvedValueOnce([{ keywordId: 'k1' }])
        .mockResolvedValueOnce([{ keywordId: 'k1' }, { keywordId: 'k2' }]);

      await backfill.resolve(PAYLOAD);

      expect(getApp).toHaveBeenCalledWith('6473753684', 'pl');
      expect(updateMany).toHaveBeenCalledWith({
        where: {
          appId: APP_ID,
          subtitle: null,
          capturedAt: { gte: CAPTURED_AT },
        },
        data: { subtitle: 'AI assistant for life and work' },
      });
      expect(syncFromSnapshot).toHaveBeenCalledWith(APP_ID);
      expect(checkKeywords).toHaveBeenCalledWith(APP_ID, ['k2']);
    });

    it('leaves a snapshot a refresh already filled alone', async () => {
      const { backfill, updateMany, syncFromSnapshot, checkKeywords } =
        backfillWith();
      updateMany.mockResolvedValueOnce({ count: 0 });

      await backfill.resolve(PAYLOAD);

      expect(syncFromSnapshot).not.toHaveBeenCalled();
      expect(checkKeywords).not.toHaveBeenCalled();
    });

    it('completes quietly when the app was deleted meanwhile', async () => {
      const { backfill, appFindFirst, getApp } = backfillWith();
      appFindFirst.mockResolvedValueOnce(null);

      await expect(backfill.resolve(PAYLOAD)).resolves.toBeUndefined();
      expect(getApp).not.toHaveBeenCalled();
    });
  });
});
