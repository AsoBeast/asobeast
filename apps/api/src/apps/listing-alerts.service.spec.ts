import type { App, Prisma } from '@prisma/client';
import type { AlertPayload } from '@asobeast/shared';
import type { AlertBuild, AlertOutbox } from '../alerts/alert-outbox';
import { ListingAlerts, type RatedListingApp } from './listing-alerts.service';

const CAPTURED = new Date('2026-11-03T03:10:00.000Z');
const APP: RatedListingApp = {
  id: 'app_1',
  name: 'My App',
  country: 'us',
  store: 'APP_STORE',
  iconUrl: 'https://is1-ssl.mzstatic.com/rated.png',
};
const daysAgo = (days: number) =>
  new Date(CAPTURED.getTime() - days * 86_400_000);
const snapshot = (days: number, ratingAvg: number) => ({
  capturedAt: daysAgo(days),
  ratingAvg,
  ratingCount: 1200,
  version: '1.0.0',
});

const withOutbox = () => {
  const record = jest.fn<
    Promise<void>,
    [Prisma.TransactionClient, string, AlertBuild]
  >();
  const service = new ListingAlerts({ record } as unknown as AlertOutbox);
  const built = (): Promise<AlertPayload | null> => {
    const [, , build] = record.mock.calls[0];
    return build();
  };
  return { service, record, built };
};

const build = (
  history: ReturnType<typeof snapshot>[],
  action: { id: string } | null = null,
) => {
  const findMany = jest.fn().mockResolvedValue(history);
  const findFirst = jest.fn().mockResolvedValue(action);
  const tx = {
    appSnapshot: { findMany },
    actionItem: { findFirst },
  } as unknown as Prisma.TransactionClient;
  return { ...withOutbox(), tx, findMany, findFirst };
};

describe('ListingAlerts.recordRatingDrop', () => {
  it('hands the outbox the transaction and a subject naming the app', async () => {
    const { service, tx, record } = build([]);

    await service.recordRatingDrop(tx, APP, CAPTURED);

    expect(record).toHaveBeenCalledWith(
      tx,
      'the rating drop of app app_1',
      expect.any(Function),
    );
  });

  it('builds a drop the history shows for the first time with the identity in hand', async () => {
    const { service, tx, built } = build([snapshot(0, 4.3), snapshot(8, 4.5)]);

    await service.recordRatingDrop(tx, APP, CAPTURED);

    await expect(built()).resolves.toEqual({
      event: 'rating.dropped',
      occurredAt: CAPTURED.toISOString(),
      app: {
        id: 'app_1',
        name: 'My App',
        iconUrl: 'https://is1-ssl.mzstatic.com/rated.png',
        store: 'APP_STORE',
        country: 'us',
      },
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

  it('builds nothing when the drop did not deepen', async () => {
    const { service, tx, built, findFirst } = build([
      snapshot(0, 4.3),
      snapshot(0.01, 4.3),
      snapshot(8, 4.5),
    ]);

    await service.recordRatingDrop(tx, APP, CAPTURED);

    await expect(built()).resolves.toBeNull();
    expect(findFirst).not.toHaveBeenCalled();
  });

  it('reads the home listing of the twenty days ending at the capture through the transaction', async () => {
    const { service, tx, built, findMany } = build([]);

    await service.recordRatingDrop(tx, APP, CAPTURED);
    await built();

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

  it('names the open rating decline action read through the transaction', async () => {
    const { service, tx, built, findFirst } = build(
      [snapshot(0, 4.3), snapshot(8, 4.5)],
      { id: 'act_1' },
    );

    await service.recordRatingDrop(tx, APP, CAPTURED);

    await expect(built()).resolves.toEqual(
      expect.objectContaining({ actionId: 'act_1' }),
    );
    expect(findFirst).toHaveBeenCalledWith({
      where: {
        appId: 'app_1',
        rule: 'reviews.investigate_rating_decline',
        status: 'OPEN',
      },
      select: { id: true },
    });
  });

  it('hands a failing history read to the outbox', async () => {
    const { service, tx, built, findMany } = build([]);
    findMany.mockRejectedValue(new Error('history unreadable'));

    await service.recordRatingDrop(tx, APP, CAPTURED);

    await expect(built()).rejects.toThrow('history unreadable');
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
    const { service, record, built } = withOutbox();
    return { service, tx, findFirst, count, record, built };
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
    const { service, tx, findFirst, count, built } = lost({ id: 'snap' }, 3);

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
