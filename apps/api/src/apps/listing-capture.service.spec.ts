import { Logger } from '@nestjs/common';
import { Store } from '@prisma/client';
import type { ChangesService } from '../changes/changes.service';
import type { KeywordsService } from '../keywords/keywords.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { ScreenshotQueue } from '../screenshots/screenshot-queue';
import type { ScreenshotRecorder } from '../screenshots/screenshot-recorder';
import type { ProxyEgress } from '../store-providers/egress/proxy-egress.service';
import { StoreAppNotFoundError } from '../store-providers/errors';
import type { StoreProviderRegistry } from '../store-providers/store-provider.registry';
import { ListingCaptureService } from './listing-capture.service';
import type { LocalizationDetection } from './localization-detection.service';
import type { LocalizedListingCapture } from './localized-listing-capture.service';
import type { MarketLocalizationRecorder } from './market-localization-recorder';

const APP = {
  id: 'app_1',
  store: Store.APP_STORE,
  storeAppId: '1234567890',
  country: 'us',
  iconUrl: null,
  isCompetitor: false,
  unlistedMarkets: [] as string[],
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

const captured = (changes: unknown[]) => ({
  changes,
  listings: [],
  complete: true,
});

const build = (overrides: {
  syncFromSnapshot?: jest.Mock;
  recordRefresh?: jest.Mock;
  recordMarketRefresh?: jest.Mock;
  localized?: unknown[];
  app?: typeof APP | null;
  previous?: typeof SNAPSHOT | null;
  detect?: jest.Mock;
  recordDefault?: jest.Mock;
  raw?: Record<string, unknown>;
  getApp?: jest.Mock;
}) => {
  const tx = {
    appSnapshot: {
      create: jest
        .fn()
        .mockResolvedValue({ ...SNAPSHOT, raw: overrides.raw ?? SNAPSHOT.raw }),
    },
    app: { update: jest.fn().mockResolvedValue(APP) },
    $executeRaw: jest.fn().mockResolvedValue(1),
  };
  const updateMany = jest.fn().mockResolvedValue({ count: 1 });
  const prisma = {
    app: {
      findFirst: jest
        .fn()
        .mockResolvedValue(overrides.app === undefined ? APP : overrides.app),
      updateMany,
    },
    appSnapshot: {
      findFirst: jest.fn().mockResolvedValue(overrides.previous ?? null),
    },
    trackedKeyword: { count: jest.fn().mockResolvedValue(1) },
    withTransaction: jest.fn((work: (client: typeof tx) => unknown) =>
      work(tx),
    ),
  } as unknown as PrismaService;
  const registry = {
    get: () => ({
      getApp:
        overrides.getApp ??
        jest.fn().mockResolvedValue({
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
  const capture = jest
    .fn()
    .mockResolvedValue(captured(overrides.localized ?? []));
  const detect =
    overrides.detect ??
    jest.fn().mockResolvedValue({ queued: 0, candidates: [] });
  const recordDefault =
    overrides.recordDefault ?? jest.fn().mockResolvedValue(undefined);
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
    { record: recordDefault } as unknown as MarketLocalizationRecorder,
  );
  return {
    service,
    request,
    record,
    capture,
    detect,
    recordDefault,
    tx,
    updateMany,
  };
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

describe('ListingCaptureService.refreshListing', () => {
  it('captures the home listing when no market is named', async () => {
    const { service, record } = build({});

    await service.refreshListing(APP.id);

    expect(record).toHaveBeenCalledWith(
      expect.anything(),
      { store: Store.APP_STORE, country: APP.country },
      SNAPSHOT,
    );
  });

  it('captures nothing once the app was deleted', async () => {
    const syncFromSnapshot = jest.fn();
    const { service, record } = build({ app: null, syncFromSnapshot });

    await expect(service.refreshListing(APP.id)).resolves.toBeNull();
    await expect(service.refreshListing(APP.id, 'de')).resolves.toBeNull();
    expect(record).not.toHaveBeenCalled();
    expect(syncFromSnapshot).not.toHaveBeenCalled();
  });
});

describe('ListingCaptureService delisted apps', () => {
  const missing = () =>
    jest
      .fn()
      .mockRejectedValue(
        new StoreAppNotFoundError(Store.APP_STORE, APP.storeAppId),
      );

  it('records when the store stopped listing the app in its home market', async () => {
    const { service, updateMany, record } = build({ getApp: missing() });

    await expect(service.refreshListing(APP.id)).resolves.toBeNull();

    expect(updateMany).toHaveBeenCalledWith({
      where: { id: APP.id, delistedAt: null },
      data: { delistedAt: expect.any(Date) as Date },
    });
    expect(record).not.toHaveBeenCalled();
  });

  it('records it on an on demand refresh and still answers the store error', async () => {
    const { service, updateMany } = build({ getApp: missing() });

    await expect(service.refresh(APP.id)).rejects.toThrow(
      StoreAppNotFoundError,
    );

    expect(updateMany).toHaveBeenCalledTimes(1);
  });

  it('records the market, not the app, when only a market does not list it', async () => {
    const { service, updateMany } = build({ getApp: missing() });

    await expect(service.refreshListing(APP.id, 'cn')).resolves.toBeNull();

    expect(updateMany).toHaveBeenCalledTimes(1);
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: APP.id, NOT: { unlistedMarkets: { has: 'cn' } } },
      data: { unlistedMarkets: { push: 'cn' } },
    });
  });

  it('records the market on an on demand market refresh and still answers the store error', async () => {
    const { service, updateMany } = build({ getApp: missing() });

    await expect(service.refresh(APP.id, 'cn')).rejects.toThrow(
      StoreAppNotFoundError,
    );

    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { unlistedMarkets: { push: 'cn' } },
      }),
    );
  });

  it('records nothing when the store fails for another reason', async () => {
    const { service, updateMany } = build({
      getApp: jest.fn().mockRejectedValue(new Error('timeout')),
    });

    await expect(service.refreshListing(APP.id)).rejects.toThrow('timeout');

    expect(updateMany).not.toHaveBeenCalled();
  });

  it('clears the record on the next home capture', async () => {
    const { service, tx } = build({});

    await service.refreshListing(APP.id);

    expect(tx.app.update).toHaveBeenCalledWith({
      where: { id: APP.id },
      data: expect.objectContaining({ delistedAt: null }) as object,
    });
  });

  it('leaves the record alone on a market capture', async () => {
    const { service, tx } = build({});

    await service.refreshListing(APP.id, 'de');

    expect(tx.app.update).not.toHaveBeenCalled();
  });

  it('clears a market on its next capture', async () => {
    const { service, tx } = build({
      app: { ...APP, unlistedMarkets: ['cn', 'ru'] },
    });

    await service.refreshListing(APP.id, 'cn');

    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
    expect(tx.$executeRaw.mock.calls[0]).toEqual(
      expect.arrayContaining(['cn', APP.id]),
    );
  });

  it('touches no market on a home capture', async () => {
    const { service, tx } = build({ app: { ...APP, unlistedMarkets: ['ru'] } });

    await service.refreshListing(APP.id);

    expect(tx.$executeRaw).not.toHaveBeenCalled();
  });
});

describe('ListingCaptureService refresh answer', () => {
  it('names the currency of the stored listing', async () => {
    const { service } = build({ raw: { currency: 'JPY' } });

    await expect(service.refresh(APP.id)).resolves.toMatchObject({
      currency: 'JPY',
    });
  });

  it('answers a null currency when the stored listing names none', async () => {
    const { service } = build({});

    await expect(service.refresh(APP.id)).resolves.toMatchObject({
      currency: null,
    });
  });

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
      currency: null,
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
      return Promise.resolve(captured([]));
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
      return Promise.resolve(captured([]));
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
      return Promise.resolve(captured([]));
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

describe('ListingCaptureService market default localization', () => {
  it('records the default localization of a market after the localized captures', async () => {
    const order: string[] = [];
    const read = { changes: [], listings: [SNAPSHOT], complete: true };
    const { service, capture, recordDefault } = build({
      recordDefault: jest.fn(() => {
        order.push('default');
        return Promise.resolve();
      }),
    });
    capture.mockImplementation(() => {
      order.push('localizations');
      return Promise.resolve(read);
    });

    await service.refreshListing(APP.id, 'de');

    expect(order).toEqual(['localizations', 'default']);
    expect(recordDefault).toHaveBeenCalledWith(
      expect.objectContaining({ id: APP.id }),
      'de',
      { ...SNAPSHOT, subtitleUnavailable: false },
      read,
    );
  });

  it('asks on every capture of a market, not only the first', async () => {
    const { service, recordDefault } = build({ previous: SNAPSHOT });

    await service.refreshListing(APP.id, 'de');

    expect(recordDefault).toHaveBeenCalledTimes(1);
  });
});
