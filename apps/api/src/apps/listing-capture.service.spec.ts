import { Logger } from '@nestjs/common';
import { Store } from '@prisma/client';
import type { ChangesService } from '../changes/changes.service';
import type { KeywordsService } from '../keywords/keywords.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { ScreenshotQueue } from '../screenshots/screenshot-queue';
import type { ScreenshotRecorder } from '../screenshots/screenshot-recorder';
import type { ProxyEgress } from '../store-providers/egress/proxy-egress.service';
import type { StoreProviderRegistry } from '../store-providers/store-provider.registry';
import { ListingCaptureService } from './listing-capture.service';
import type { LocalizationDetection } from './localization-detection.service';
import type { LocalizedListingCapture } from './localized-listing-capture.service';

const APP = {
  id: 'app_1',
  store: Store.APP_STORE,
  storeAppId: '1234567890',
  country: 'us',
  iconUrl: null,
  isCompetitor: false,
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

const REORDERED = {
  field: 'screenshotImages',
  before: '3 screenshots',
  after: '3 screenshots, reordered',
  detail: {
    kind: 'images',
    before: [],
    after: [],
    added: [],
    removed: [],
    reordered: true,
  },
};

const build = (overrides: {
  syncFromSnapshot?: jest.Mock;
  recordRefresh?: jest.Mock;
  recordMarketRefresh?: jest.Mock;
  localized?: unknown[];
  app?: typeof APP;
  previous?: typeof SNAPSHOT | null;
  detect?: jest.Mock;
}) => {
  const tx = {
    appSnapshot: { create: jest.fn().mockResolvedValue(SNAPSHOT) },
    app: { update: jest.fn().mockResolvedValue(APP) },
  };
  const prisma = {
    app: { findFirst: jest.fn().mockResolvedValue(overrides.app ?? APP) },
    appSnapshot: {
      findFirst: jest.fn().mockResolvedValue(overrides.previous ?? null),
    },
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
        subtitleUnavailable: false,
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
    recordMarketRefresh:
      overrides.recordMarketRefresh ?? jest.fn().mockResolvedValue([]),
  } as unknown as ChangesService;
  const record = jest.fn().mockResolvedValue(2);
  const screenshots = { record } as unknown as ScreenshotRecorder;
  const request = jest.fn().mockResolvedValue(undefined);
  const capture = jest.fn().mockResolvedValue(overrides.localized ?? []);
  const detect =
    overrides.detect ??
    jest.fn().mockResolvedValue({ queued: 0, candidates: [] });
  const service = new ListingCaptureService(
    prisma,
    registry,
    egress,
    keywords,
    changes,
    screenshots,
    { request } as unknown as ScreenshotQueue,
    { capture } as unknown as LocalizedListingCapture,
    { request: detect } as unknown as LocalizationDetection,
  );
  return { service, request, record, capture, detect };
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

describe('ListingCaptureService refresh answer', () => {
  it('answers with the screenshot change the home refresh recorded', async () => {
    const { service } = build({
      recordRefresh: jest.fn().mockResolvedValue([REORDERED]),
    });

    await expect(service.refresh(APP.id)).resolves.toEqual({
      snapshotId: SNAPSHOT.id,
      changes: [
        {
          field: 'screenshotImages',
          before: '3 screenshots',
          after: '3 screenshots, reordered',
        },
      ],
      country: 'us',
    });
  });

  it('answers with the screenshot change a market refresh recorded', async () => {
    const { service } = build({
      recordMarketRefresh: jest.fn().mockResolvedValue([REORDERED]),
    });

    await expect(service.refreshListing(APP.id, 'de')).resolves.toMatchObject({
      changes: [
        {
          field: 'screenshotImages',
          before: '3 screenshots',
          after: '3 screenshots, reordered',
        },
      ],
      country: 'de',
    });
  });
});

describe('ListingCaptureService localized listings', () => {
  it('appends the changes of the localized listings to the refresh answer', async () => {
    const titled = {
      field: 'title',
      before: 29,
      after: 31,
      localization: 'pl',
    };
    const { service } = build({ localized: [titled] });

    const answer = await service.refresh(APP.id);

    expect(answer.changes).toEqual([titled]);
  });

  it('captures the localizations after the default listing and compares them with it', async () => {
    const { service, capture } = build({});

    await service.refresh(APP.id);

    expect(capture).toHaveBeenCalledWith(
      expect.objectContaining({ id: APP.id }),
      'us',
      { ...SNAPSHOT, subtitleUnavailable: false },
    );
  });

  it('captures the localizations before the keyword sync reads them', async () => {
    const order: string[] = [];
    const { service, capture } = build({
      syncFromSnapshot: jest.fn(() => {
        order.push('sync');
        return Promise.resolve();
      }),
    });
    capture.mockImplementation(() => {
      order.push('localizations');
      return Promise.resolve([]);
    });

    await service.refresh(APP.id);

    expect(order).toEqual(['localizations', 'sync']);
  });

  it('records the changes of the default listing before it asks for a localization', async () => {
    const order: string[] = [];
    const { service, capture } = build({
      recordRefresh: jest.fn(() => {
        order.push('record');
        return Promise.resolve([]);
      }),
    });
    capture.mockImplementation(() => {
      order.push('localizations');
      return Promise.resolve([]);
    });

    await service.refresh(APP.id);

    expect(order).toEqual(['record', 'localizations']);
  });

  it('records the changes of a market listing before it asks for a localization', async () => {
    const order: string[] = [];
    const { service, capture } = build({
      recordMarketRefresh: jest.fn(() => {
        order.push('record');
        return Promise.resolve([]);
      }),
    });
    capture.mockImplementation(() => {
      order.push('localizations');
      return Promise.resolve([]);
    });

    await service.refreshListing(APP.id, 'pl');

    expect(order).toEqual(['record', 'localizations']);
  });
});

describe('ListingCaptureService screenshots', () => {
  it('records the home screenshots with the home storefront', async () => {
    const { service, record } = build({});

    await service.refresh(APP.id);

    expect(record).toHaveBeenCalledWith(
      expect.anything(),
      { store: Store.APP_STORE, country: 'us' },
      SNAPSHOT,
    );
  });

  it('records the screenshots of a market listing with that storefront and queues their read', async () => {
    const { service, record, request } = build({});

    await service.refreshListing(APP.id, 'de');

    expect(record).toHaveBeenCalledWith(
      expect.anything(),
      { store: Store.APP_STORE, country: 'de' },
      SNAPSHOT,
    );
    expect(request).toHaveBeenCalledWith(APP.id, SNAPSHOT.id);
  });
});

describe('ListingCaptureService localization detection', () => {
  it('asks for the localizations of a market after its first capture', async () => {
    const { service, detect } = build({});

    await service.refreshListing(APP.id, 'de');

    expect(detect).toHaveBeenCalledTimes(1);
    expect(detect).toHaveBeenCalledWith(APP.id, expect.any(Function), 'de');
    const [[, spend]] = detect.mock.calls as [[string, () => Promise<void>]];
    await expect(spend()).resolves.toBeUndefined();
  });

  it('asks nothing on a later capture of the same market', async () => {
    const { service, detect } = build({ previous: SNAPSHOT });

    await service.refreshListing(APP.id, 'de');

    expect(detect).not.toHaveBeenCalled();
  });

  it('asks nothing for the home market or a competitor', async () => {
    const home = build({});
    await home.service.refreshListing(APP.id, 'us');
    expect(home.detect).not.toHaveBeenCalled();

    const rival = build({ app: { ...APP, isCompetitor: true } });
    await rival.service.refreshListing(APP.id, 'de');
    expect(rival.detect).not.toHaveBeenCalled();
  });

  it('asks nothing for a google play market', async () => {
    const warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    const { service, detect } = build({
      app: { ...APP, store: Store.GOOGLE_PLAY },
    });

    try {
      await service.refreshListing(APP.id, 'de');

      expect(detect).not.toHaveBeenCalled();
      expect(warn).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });

  it('keeps the capture when the detection request fails', async () => {
    const warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    const { service } = build({
      detect: jest.fn().mockRejectedValue(new Error('redis is down')),
    });

    try {
      await expect(service.refreshListing(APP.id, 'de')).resolves.toMatchObject(
        { snapshotId: SNAPSHOT.id, country: 'de' },
      );
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('redis is down'),
      );
    } finally {
      warn.mockRestore();
    }
  });
});
