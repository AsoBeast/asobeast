import { Logger } from '@nestjs/common';
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
      appSnapshot: { findMany },
      actionItem: { findFirst },
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
