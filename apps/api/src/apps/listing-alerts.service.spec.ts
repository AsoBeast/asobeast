import { Logger } from '@nestjs/common';
import type { App } from '@prisma/client';
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

  it('reads the home listing of the fourteen days ending at the capture', async () => {
    const { service, findMany } = build([]);

    await service.ratingDropped(APP, CAPTURED);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          appId: 'app_1',
          country: null,
          localization: null,
          capturedAt: { gte: daysAgo(14), lte: CAPTURED },
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

describe('ListingAlerts.listingLost', () => {
  const OWN = {
    id: 'app_1',
    name: 'My App',
    country: 'us',
    store: 'APP_STORE',
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
    const dispatch = jest.fn().mockResolvedValue(undefined);
    const service = new ListingAlerts(
      {
        appSnapshot: { findFirst },
        trackedKeyword: { count },
      } as unknown as PrismaService,
      { dispatch } as unknown as AlertsDispatcher,
    );
    return { service, findFirst, count, dispatch };
  };

  it('dispatches a delisting of the home storefront without a read', async () => {
    const { service, findFirst, count, dispatch } = lost(null);

    await service.listingLost(OWN, 'us');

    expect(findFirst).not.toHaveBeenCalled();
    expect(count).not.toHaveBeenCalled();
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'app.delisted', country: 'us' }),
    );
  });

  it('dispatches a lost market the app was listed in with its keywords', async () => {
    const { service, findFirst, count, dispatch } = lost({ id: 'snap' }, 3);

    await service.listingLost(OWN, 'de');

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
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'app.unlisted_market',
        market: 'de',
        trackedKeywords: 3,
      }),
    );
  });

  it('counts the keywords of a competitor primary', async () => {
    const { service, count } = lost({ id: 'snap' });

    await service.listingLost(RIVAL, 'de');

    expect(count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ appId: 'app_1' }) as object,
      }),
    );
  });

  it('dispatches nothing for a market the app was never listed in', async () => {
    const { service, count, dispatch } = lost(null);

    await service.listingLost(OWN, 'fr');

    expect(count).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('logs a failing dispatch instead of throwing', async () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    const { service, dispatch } = lost(null);
    dispatch.mockRejectedValue(new Error('outbox down'));

    await expect(service.listingLost(OWN, 'us')).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('app_1'));
    warn.mockRestore();
  });
});
