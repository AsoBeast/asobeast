import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { addDays, utcToday } from '../analytics/analytics.support';
import { PrismaService } from '../prisma/prisma.service';
import { changeDays, impactReadPlan } from './change-impact';
import { ChangeImpactService } from './change-impact.service';

describe('ChangeImpactService', () => {
  const appFindFirst = jest.fn();
  const eventFindMany = jest.fn();
  const trackedFindMany = jest.fn();
  let service: ChangeImpactService;

  const today = utcToday();
  const changedOn = addDays(today, -10);
  const titleEvent = { field: 'title' as const, capturedAt: changedOn };

  beforeEach(async () => {
    appFindFirst.mockReset().mockResolvedValue({ id: 'app_1', country: 'us' });
    eventFindMany.mockReset().mockResolvedValue([]);
    trackedFindMany.mockReset().mockResolvedValue([]);
    const moduleRef = await Test.createTestingModule({
      providers: [
        ChangeImpactService,
        {
          provide: PrismaService,
          useValue: {
            app: { findFirst: appFindFirst },
            changeEvent: { findMany: eventFindMany },
            trackedKeyword: { findMany: trackedFindMany },
          },
        },
      ],
    }).compile();
    service = moduleRef.get(ChangeImpactService);
  });

  it('rejects an unknown app', async () => {
    appFindFirst.mockResolvedValue(null);

    await expect(service.report('app_x', 90)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('reads the app own events from the first day of the window', async () => {
    await service.report('app_1', 30);

    expect(eventFindMany).toHaveBeenCalledWith({
      where: { appId: 'app_1', capturedAt: { gte: addDays(today, -30) } },
      select: { field: true, capturedAt: true },
    });
  });

  it('answers an empty report for the home market without reading keywords', async () => {
    await expect(service.report('app_1', 90)).resolves.toEqual({
      appId: 'app_1',
      country: 'us',
      days: 90,
      totalChanges: 0,
      items: [],
    });
    expect(trackedFindMany).not.toHaveBeenCalled();
  });

  it('reads the market active keywords on the planned dates only', async () => {
    eventFindMany.mockResolvedValue([titleEvent]);
    const plan = impactReadPlan(changeDays([titleEvent]), today);

    await service.report('app_1', 90, 'gb');

    expect(trackedFindMany).toHaveBeenCalledWith({
      where: { appId: 'app_1', active: true, keyword: { country: 'gb' } },
      select: {
        keyword: {
          select: {
            metrics: {
              where: { date: { lte: plan.metricsUntil } },
              orderBy: { date: 'desc' },
              select: { traffic: true, difficulty: true, date: true },
            },
            rankings: {
              where: { appId: 'app_1', date: { in: plan.rankingDates } },
              select: { position: true, date: true, depth: true },
            },
          },
        },
      },
    });
  });

  it('measures the rows it read and echoes the market and window', async () => {
    eventFindMany.mockResolvedValue([titleEvent]);
    trackedFindMany.mockResolvedValue([
      {
        keyword: {
          metrics: [],
          rankings: [
            { date: addDays(changedOn, -1), position: 9, depth: 200 },
            { date: addDays(changedOn, 7), position: 4, depth: 200 },
          ],
        },
      },
    ]);

    const report = await service.report('app_1', 60, 'gb');

    expect(report).toMatchObject({ country: 'gb', days: 60, totalChanges: 1 });
    expect(report.items[0].windows[0]).toMatchObject({
      status: 'measured',
      movement: { improved: 1, measured: 1 },
    });
  });

  it('leaves a stored field the contract does not name out of the report', async () => {
    eventFindMany.mockResolvedValue([
      titleEvent,
      { field: 'legacyField', capturedAt: addDays(today, -20) },
    ]);

    const report = await service.report('app_1', 90);

    expect(report.totalChanges).toBe(1);
    expect(report.items.map((item) => item.fields)).toEqual([['title']]);
  });
});
