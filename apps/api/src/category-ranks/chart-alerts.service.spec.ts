import type { ChartMovePayload, ChartMoveScope } from '@asobeast/shared';
import type { AlertsDispatcher } from '../alerts/alerts.dispatcher';
import type { PrismaService } from '../prisma/prisma.service';
import { ChartAlertsService, type ChartCheck } from './chart-alerts.service';

const chart: ChartMoveScope = {
  store: 'APP_STORE',
  country: 'us',
  collection: 'free',
  genre: '6007',
  genreName: 'Productivity',
  device: 'iphone',
};

const date = new Date('2026-10-28T00:00:00.000Z');

const checkAt = (position: number | null): ChartCheck => ({
  app: { id: 'a1', name: 'Mine' },
  chart,
  date,
  position,
  depth: 100,
});

const makeService = (
  previous: { position: number | null } | null,
  emptyCaptureDays: Date[] = [],
) => {
  const findFirst = jest.fn().mockResolvedValue(previous);
  const findMany = jest
    .fn()
    .mockResolvedValue(emptyCaptureDays.map((day) => ({ date: day })));
  const dispatch = jest.fn().mockResolvedValue(undefined);
  const service = new ChartAlertsService(
    {
      categoryRank: { findFirst },
      chartCapture: { findMany },
    } as unknown as PrismaService,
    { dispatch } as unknown as AlertsDispatcher,
  );
  const sent = () =>
    (dispatch.mock.calls as [ChartMovePayload][]).map(([payload]) => payload);
  return { service, findFirst, findMany, sent };
};

describe('ChartAlertsService', () => {
  it('raises nothing on the first check of a chart', async () => {
    const { service, sent } = makeService(null);

    await service.dispatch(checkAt(7));

    expect(sent()).toEqual([]);
  });

  it('raises an entry and its milestone in order', async () => {
    const { service, sent } = makeService({ position: null });

    await service.dispatch(checkAt(7));

    expect(sent().map((payload) => payload.event)).toEqual([
      'chart.entered',
      'chart.milestone',
    ]);
    expect(sent()[0]).toMatchObject({
      date: '2026-10-28',
      chart,
      from: null,
      to: 7,
      depth: 100,
    });
  });

  it('raises only the milestone of a climb inside the chart', async () => {
    const { service, sent } = makeService({ position: 14 });

    await service.dispatch(checkAt(8));

    expect(sent().map((payload) => payload.event)).toEqual(['chart.milestone']);
  });

  it('raises nothing for a move that crosses no line', async () => {
    const { service, sent } = makeService({ position: 40 });

    await service.dispatch(checkAt(38));

    expect(sent()).toEqual([]);
  });

  it('compares with the newest earlier check of the same chart, whatever the gap', async () => {
    const { service, findFirst } = makeService(null);

    await service.dispatch(checkAt(7));

    expect(findFirst).toHaveBeenCalledWith({
      where: {
        appId: 'a1',
        collection: 'free',
        genre: '6007',
        date: { lt: date, notIn: [] },
      },
      orderBy: { date: 'desc' },
      select: { position: true },
    });
  });

  it('skips a day the store listed no apps in the chart', async () => {
    const emptyDay = new Date('2026-10-27T00:00:00.000Z');
    const { service, findFirst, findMany } = makeService(null, [emptyDay]);

    await service.dispatch(checkAt(7));

    expect(findMany).toHaveBeenCalledWith({
      where: {
        store: 'APP_STORE',
        country: 'us',
        collection: 'free',
        genre: '6007',
        device: 'iphone',
        date: { lt: date },
        entries: { none: {} },
      },
      select: { date: true },
    });
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          date: { lt: date, notIn: [emptyDay] },
        }) as object,
      }),
    );
  });

  it('names the app as the check gave it and leaves its identity to the dispatcher', async () => {
    const { service, sent } = makeService({ position: null });

    await service.dispatch(checkAt(7));

    expect(sent()[0].app).toEqual({ id: 'a1', name: 'Mine' });
  });
});
