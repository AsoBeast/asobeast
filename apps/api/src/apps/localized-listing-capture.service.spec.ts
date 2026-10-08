import { Logger } from '@nestjs/common';
import { AppSnapshot, Store } from '@prisma/client';
import type { ChangesService } from '../changes/changes.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { ScreenshotQueue } from '../screenshots/screenshot-queue';
import type { ScreenshotRecorder } from '../screenshots/screenshot-recorder';
import type { ProxyEgress } from '../store-providers/egress/proxy-egress.service';
import { StoreRequestError } from '../store-providers/errors';
import type { StoreProviderRegistry } from '../store-providers/store-provider.registry';
import { LocalizedListingCapture } from './localized-listing-capture.service';

const shot = (n: number) =>
  `https://is1-ssl.mzstatic.com/image/thumb/a/b/${n}/shot.jpg/392x696bb.jpg`;

const ENGLISH = {
  title: 'Where Am I? GeoGuess Map Quiz',
  subtitle: 'World Geography Trivia Game',
  description: 'Discover the world',
  raw: { screenshots: [shot(1), shot(2)] },
};

const POLISH = {
  title: 'Where Am I? Quiz Geograficzny',
  subtitle: 'Mapa Świata: Zgadnij Kraj',
  description: 'Odkrywaj świat',
  raw: { screenshots: [shot(3), shot(4)] },
};

const APP = {
  id: 'app_1',
  store: Store.APP_STORE,
  storeAppId: '6657987209',
  country: 'pl',
};

const row = (
  listing: typeof ENGLISH,
  localization: string | null,
  id = 'snap_pl',
): AppSnapshot => ({
  id,
  appId: APP.id,
  country: null,
  localization,
  summary: null,
  ratingAvg: null,
  ratingCount: null,
  installs: null,
  price: 0,
  version: '4.0',
  releasedAt: null,
  storeUpdatedAt: null,
  capturedAt: new Date('2026-10-08T03:00:00.000Z'),
  ...listing,
});

const normalized = (listing: typeof ENGLISH) => ({
  store: Store.APP_STORE,
  storeAppId: APP.storeAppId,
  version: '4.0',
  price: 0,
  searchable: true,
  ...listing,
});

const build = (options: {
  getApp: jest.Mock;
  previous?: AppSnapshot | null;
  created?: AppSnapshot;
}) => {
  const create = jest
    .fn()
    .mockResolvedValue(options.created ?? row(POLISH, 'pl'));
  const tx = { appSnapshot: { create } };
  const findFirst = jest.fn().mockResolvedValue(options.previous ?? null);
  const prisma = {
    appSnapshot: { findFirst },
    withTransaction: jest.fn((work: (client: typeof tx) => unknown) =>
      work(tx),
    ),
  } as unknown as PrismaService;
  const registry = {
    get: () => ({ getApp: options.getApp }),
  } as unknown as StoreProviderRegistry;
  const egress = {
    through: (_store: Store, _country: string, work: () => unknown) => work(),
  } as unknown as ProxyEgress;
  const recordMarketRefresh = jest.fn().mockResolvedValue([]);
  const record = jest.fn().mockResolvedValue(2);
  const request = jest.fn().mockResolvedValue(undefined);
  const capture = new LocalizedListingCapture(
    prisma,
    registry,
    egress,
    { recordMarketRefresh } as unknown as ChangesService,
    { record } as unknown as ScreenshotRecorder,
    { request } as unknown as ScreenshotQueue,
  );
  return { capture, create, findFirst, recordMarketRefresh, record, request };
};

describe('LocalizedListingCapture', () => {
  const fallback = row(ENGLISH, null, 'snap_default');

  it('stores the polish listing of a pl market and queues its screenshot read', async () => {
    const getApp = jest.fn().mockResolvedValue(normalized(POLISH));
    const { capture, create, request, record } = build({ getApp });

    await expect(capture.capture(APP, 'pl', fallback)).resolves.toEqual([]);

    expect(getApp).toHaveBeenCalledWith('6657987209', 'pl', 'pl');
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        country: null,
        localization: 'pl',
        title: POLISH.title,
      }) as unknown,
    });
    expect(record).toHaveBeenCalledWith(
      expect.anything(),
      { store: Store.APP_STORE, country: 'pl', localization: 'pl' },
      expect.objectContaining({ id: 'snap_pl' }),
    );
    expect(request).toHaveBeenCalledWith(APP.id, 'snap_pl');
  });

  it('stores nothing when the store echoes the default listing', async () => {
    const getApp = jest.fn().mockResolvedValue(normalized(ENGLISH));
    const { capture, create, recordMarketRefresh } = build({ getApp });

    await expect(capture.capture(APP, 'pl', fallback)).resolves.toEqual([]);

    expect(create).not.toHaveBeenCalled();
    expect(recordMarketRefresh).not.toHaveBeenCalled();
  });

  it('keeps capturing a localization it captured before even when it now echoes the default', async () => {
    const getApp = jest.fn().mockResolvedValue(normalized(ENGLISH));
    const { capture, create, recordMarketRefresh } = build({
      getApp,
      previous: row(POLISH, 'pl', 'snap_pl_old'),
      created: row(ENGLISH, 'pl'),
    });

    const changes = await capture.capture(APP, 'pl', fallback);

    expect(create).toHaveBeenCalledTimes(1);
    expect(recordMarketRefresh).toHaveBeenCalledWith(
      APP.id,
      { home: 'pl', market: 'pl', localization: 'pl' },
      expect.objectContaining({ title: POLISH.title }),
      expect.objectContaining({ title: ENGLISH.title }),
    );
    expect(changes).toContainEqual({
      field: 'title',
      before: 29,
      after: 29,
      localization: 'pl',
    });
  });

  it('tags every recorded change with its localization', async () => {
    const getApp = jest.fn().mockResolvedValue(normalized(POLISH));
    const { capture, recordMarketRefresh } = build({
      getApp,
      previous: row(POLISH, 'pl', 'snap_pl_old'),
    });
    recordMarketRefresh.mockResolvedValue([
      { field: 'whatsNew', before: 'Stare', after: 'Nowe' },
    ]);

    await expect(capture.capture(APP, 'pl', fallback)).resolves.toEqual([
      { field: 'whatsNew', before: 'Stare', after: 'Nowe', localization: 'pl' },
    ]);
  });

  it('asks for every native localization of a storefront in order', async () => {
    const getApp = jest.fn().mockResolvedValue(normalized(ENGLISH));
    const { capture } = build({ getApp });

    await capture.capture({ ...APP, country: 'us' }, 'be', fallback);

    expect(getApp.mock.calls).toEqual([
      ['6657987209', 'be', 'nl'],
      ['6657987209', 'be', 'fr'],
    ]);
  });

  it('skips a localization that fails and captures the next', async () => {
    const warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    const getApp = jest
      .fn()
      .mockRejectedValueOnce(
        new StoreRequestError(Store.APP_STORE, 'getApp', 'HTTP 429'),
      )
      .mockResolvedValueOnce(normalized(POLISH));
    const { capture, create } = build({ getApp });

    await expect(
      capture.capture({ ...APP, country: 'us' }, 'be', fallback),
    ).resolves.toEqual([]);

    expect(create).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({ localization: 'fr' }) as unknown,
    });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('nl'));
    warn.mockRestore();
  });

  it('does nothing for google play or a storefront without a native localization', async () => {
    const getApp = jest.fn();
    const { capture } = build({ getApp });

    await capture.capture({ ...APP, store: Store.GOOGLE_PLAY }, 'pl', fallback);
    await capture.capture({ ...APP, country: 'de' }, 'de', fallback);

    expect(getApp).not.toHaveBeenCalled();
  });
});
