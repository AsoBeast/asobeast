import { Store } from '@prisma/client';
import type { ChangesService } from '../changes/changes.service';
import type { KeywordsService } from '../keywords/keywords.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { ScreenshotQueue } from '../screenshots/screenshot-queue';
import type { ScreenshotRecorder } from '../screenshots/screenshot-recorder';
import type { ProxyEgress } from '../store-providers/egress/proxy-egress.service';
import type { StoreProviderRegistry } from '../store-providers/store-provider.registry';
import { ListingCaptureService } from './listing-capture.service';

const APP = {
  id: 'app_1',
  store: Store.APP_STORE,
  storeAppId: '1234567890',
  country: 'us',
  iconUrl: null,
};

const SNAPSHOT = {
  id: 'snap_2',
  appId: APP.id,
  title: 'Fixture',
  subtitle: null,
  summary: null,
  description: 'An app',
  version: '1.0',
  price: 0,
  raw: {},
  capturedAt: new Date('2026-10-08T03:00:00.000Z'),
};

const build = (overrides: {
  syncFromSnapshot?: jest.Mock;
  recordRefresh?: jest.Mock;
}) => {
  const tx = {
    appSnapshot: { create: jest.fn().mockResolvedValue(SNAPSHOT) },
    app: { update: jest.fn().mockResolvedValue(APP) },
  };
  const prisma = {
    app: { findFirst: jest.fn().mockResolvedValue(APP) },
    appSnapshot: { findFirst: jest.fn().mockResolvedValue(null) },
    withTransaction: jest.fn((work: (client: typeof tx) => unknown) =>
      work(tx),
    ),
  } as unknown as PrismaService;
  const registry = {
    get: () => ({
      getApp: jest.fn().mockResolvedValue({
        store: Store.APP_STORE,
        storeAppId: APP.storeAppId,
        title: 'Fixture',
        description: 'An app',
        raw: {},
        searchable: true,
      }),
    }),
  } as unknown as StoreProviderRegistry;
  const egress = {
    through: (_store: Store, _country: string, work: () => unknown) => work(),
  } as unknown as ProxyEgress;
  const keywords = {
    syncFromSnapshot:
      overrides.syncFromSnapshot ?? jest.fn().mockResolvedValue(undefined),
  } as unknown as KeywordsService;
  const changes = {
    recordRefresh: overrides.recordRefresh ?? jest.fn().mockResolvedValue([]),
  } as unknown as ChangesService;
  const screenshots = {
    record: jest.fn().mockResolvedValue(2),
  } as unknown as ScreenshotRecorder;
  const request = jest.fn().mockResolvedValue(undefined);
  const service = new ListingCaptureService(
    prisma,
    registry,
    egress,
    keywords,
    changes,
    screenshots,
    { request } as unknown as ScreenshotQueue,
  );
  return { service, request };
};

describe('ListingCaptureService.refresh', () => {
  it('queues the screenshot read of the new snapshot', async () => {
    const { service, request } = build({});

    await service.refresh(APP.id);

    expect(request).toHaveBeenCalledWith(APP.id, SNAPSHOT.id);
  });

  it('queues the screenshot read even when the keyword sync fails', async () => {
    const { service, request } = build({
      syncFromSnapshot: jest.fn().mockRejectedValue(new Error('sync failed')),
    });

    await expect(service.refresh(APP.id)).rejects.toThrow('sync failed');

    expect(request).toHaveBeenCalledWith(APP.id, SNAPSHOT.id);
  });

  it('queues the screenshot read even when recording the changes fails', async () => {
    const { service, request } = build({
      recordRefresh: jest.fn().mockRejectedValue(new Error('changes failed')),
    });

    await expect(service.refresh(APP.id)).rejects.toThrow('changes failed');

    expect(request).toHaveBeenCalledWith(APP.id, SNAPSHOT.id);
  });
});
