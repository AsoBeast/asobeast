import { Logger } from '@nestjs/common';
import type { App, Prisma } from '@prisma/client';
import type { AlertPayload } from '@asobeast/shared';
import type { AlertBuild, AlertOutbox } from '../alerts/alert-outbox';
import type { AlertsDispatcher } from '../alerts/alerts.dispatcher';
import type { PrismaService } from '../prisma/prisma.service';
import { ListingAlerts } from './listing-alerts.service';

const CAPTURED = new Date('2026-11-03T03:10:00.000Z');
const APP = { id: 'app_1', name: 'My App', country: 'us' };
const daysAgo = (days: number) =>
  new Date(CAPTURED.getTime() - days * 86_400_000);
const snapshot = (days: number, ratingAvg: number) => ({
  capturedAt: daysAgo(days),
  ratingAvg,
  ratingCount: 1200,
  version: '1.0.0',
});

const build = (
  history: ReturnType<typeof snapshot>[],
  action: { id: string } | null = null,
) => {
  const findMany = jest.fn().mockResolvedValue(history);
  const findFirst = jest.fn().mockResolvedValue(action);
  const dispatch = jest.fn().mockResolvedValue(undefined);
  const service = new ListingAlerts(
    {
      appSnapshot: { findMany, findFirst: jest.fn() },
      actionItem: { findFirst },
      trackedKeyword: { count: jest.fn() },
    } as unknown as PrismaService,
    { dispatch } as unknown as AlertsDispatcher,
    {} as AlertOutbox,
  );
  return { service, findMany, findFirst, dispatch };
};

describe('ListingAlerts.ratingDropped', () => {
  it('dispatches a drop the history shows for the first time', async () => {
    const { service, dispatch } = build([snapshot(0, 4.3), snapshot(8, 4.5)]);

    await service.ratingDropped(APP, CAPTURED);

    expect(dispatch).toHaveBeenCalledWith({
      event: 'rating.dropped',
      occurredAt: CAPTURED.toISOString(),
      app: { id: 'app_1', name: 'My App' },
      country: 'us',
      from: 4.5,
      to: 4.3,
      fromCount: 1200,
      toCount: 1200,
      fromDate: '2026-10-26',
      toDate: '2026-11-03',
      dropTenths: 2,
      version: null,
      actionId: null,
    });
  });

  it('stays quiet when the drop did not deepen', async () => {
    const { service, dispatch } = build([
      snapshot(0, 4.3),
      snapshot(0.01, 4.3),
      snapshot(8, 4.5),
    ]);

    await service.ratingDropped(APP, CAPTURED);

    expect(dispatch).not.toHaveBeenCalled();
  });

  it('reads the home listing of the twenty days ending at the capture', async () => {
    const { service, findMany } = build([]);

    await service.ratingDropped(APP, CAPTURED);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          appId: 'app_1',
          country: null,
          localization: null,
          capturedAt: { gte: daysAgo(20), lte: CAPTURED },
        },
        orderBy: { capturedAt: 'desc' },
      }),
    );
  });

  it('names the open rating decline action', async () => {
    const { service, findFirst, dispatch } = build(
      [snapshot(0, 4.3), snapshot(8, 4.5)],
      { id: 'act_1' },
    );

    await service.ratingDropped(APP, CAPTURED);

    expect(findFirst).toHaveBeenCalledWith({
      where: {
        appId: 'app_1',
        rule: 'reviews.investigate_rating_decline',
        status: 'OPEN',
      },
      select: { id: true },
    });
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ actionId: 'act_1' }),
    );
  });

  it('logs a failing read or dispatch instead of failing the capture', async () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    const { service, dispatch } = build([snapshot(0, 4.3), snapshot(8, 4.5)]);
    dispatch.mockRejectedValue(new Error('outbox down'));

    await expect(service.ratingDropped(APP, CAPTURED)).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('app_1'));
    warn.mockRestore();
  });
});

describe('ListingAlerts.recordLoss', () => {
  const LOST_AT = new Date('2026-11-03T23:59:59.000Z');
  const OWN = {
    id: 'app_1',
    name: 'My App',
    country: 'us',
    store: 'APP_STORE',
    iconUrl: 'https://is1-ssl.mzstatic.com/icon.png',
    isCompetitor: false,
    primaryAppId: null,
  } as unknown as App;
  const RIVAL = {
    ...OWN,
    id: 'rival_1',
    isCompetitor: true,
    primaryAppId: 'app_1',
  } as App;

  const lost = (listing: { id: string } | null, keywords = 2) => {
    const findFirst = jest.fn().mockResolvedValue(listing);
    const count = jest.fn().mockResolvedValue(keywords);
    const tx = {
      appSnapshot: { findFirst },
      trackedKeyword: { count },
    } as unknown as Prisma.TransactionClient;
    const prisma = {
      appSnapshot: { findFirst: jest.fn() },
      trackedKeyword: { count: jest.fn() },
    };
    const record = jest.fn<
      Promise<void>,
      [Prisma.TransactionClient, string, AlertBuild]
    >();
    const service = new ListingAlerts(
      prisma as unknown as PrismaService,
      {} as AlertsDispatcher,
      { record } as unknown as AlertOutbox,
    );
    const built = async (): Promise<AlertPayload | null> => {
      const [, , build] = record.mock.calls[0];
      return build();
    };
    return { service, tx, prisma, findFirst, count, record, built };
  };

  it('hands the outbox the transaction and a subject naming the app and market', async () => {
    const { service, tx, record } = lost(null);

    await service.recordLoss(tx, OWN, 'us', LOST_AT);

    expect(record).toHaveBeenCalledWith(
      tx,
      'the listing loss of app app_1 in us',
      expect.any(Function),
    );
  });

  it('builds a delisting of the home storefront with the identity in hand and without a read', async () => {
    const { service, tx, findFirst, count, built } = lost(null);

    await service.recordLoss(tx, OWN, 'us', LOST_AT);

    await expect(built()).resolves.toEqual(
      expect.objectContaining({
        event: 'app.delisted',
        country: 'us',
        occurredAt: LOST_AT.toISOString(),
        date: '2026-11-03',
        app: expect.objectContaining({
          id: 'app_1',
          iconUrl: 'https://is1-ssl.mzstatic.com/icon.png',
          store: 'APP_STORE',
          country: 'us',
        }) as object,
      }),
    );
    expect(findFirst).not.toHaveBeenCalled();
    expect(count).not.toHaveBeenCalled();
  });

  it('builds a lost market the app was listed in with its keywords, read through the transaction', async () => {
    const { service, tx, prisma, findFirst, count, built } = lost(
      { id: 'snap' },
      3,
    );

    await service.recordLoss(tx, OWN, 'de', LOST_AT);

    await expect(built()).resolves.toEqual(
      expect.objectContaining({
        event: 'app.unlisted_market',
        market: 'de',
        trackedKeywords: 3,
        app: expect.objectContaining({ iconUrl: OWN.iconUrl }) as object,
      }),
    );
    expect(findFirst).toHaveBeenCalledWith({
      where: { appId: 'app_1', country: 'de', localization: null },
      select: { id: true },
    });
    expect(count).toHaveBeenCalledWith({
      where: {
        appId: 'app_1',
        active: true,
        keyword: { is: { country: 'de' } },
      },
    });
    expect(prisma.appSnapshot.findFirst).not.toHaveBeenCalled();
    expect(prisma.trackedKeyword.count).not.toHaveBeenCalled();
  });

  it('counts the keywords of a competitor primary', async () => {
    const { service, tx, count, built } = lost({ id: 'snap' });

    await service.recordLoss(tx, RIVAL, 'de', LOST_AT);
    await built();

    expect(count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ appId: 'app_1' }) as object,
      }),
    );
  });

  it('builds nothing for a market the app was never listed in', async () => {
    const { service, tx, count, built } = lost(null);

    await service.recordLoss(tx, OWN, 'fr', LOST_AT);

    await expect(built()).resolves.toBeNull();
    expect(count).not.toHaveBeenCalled();
  });
});
