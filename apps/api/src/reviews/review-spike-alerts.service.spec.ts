import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { Store } from '@prisma/client';
import type { AlertsDispatcher } from '../alerts/alerts.dispatcher';
import type { Env } from '../config/env';
import type { PrismaService } from '../prisma/prisma.service';
import type { ReviewResult } from '../store-providers/types';
import { ReviewSpikeAlerts } from './review-spike-alerts.service';
import type { ReviewThemesService } from './review-themes.service';

const NOW = new Date('2026-11-03T05:00:00.000Z');
const APP = {
  id: 'app_1',
  name: 'My App',
  store: Store.APP_STORE,
  country: 'us',
};
const THEME = { phrase: 'crash on launch', kind: 'complaint', mentions: 9 };

const review = (id: string, updatedAt?: string): ReviewResult => ({
  reviewId: id,
  score: 1,
  text: 'broken',
  updatedAt: updatedAt ? new Date(updatedAt) : undefined,
});

const quietHistory = Array.from({ length: 28 }, (_, back) => ({
  day: new Date(Date.UTC(2026, 9, 31 - back)),
  count: 1,
  low: 0,
}));

const build = (rows = quietHistory) => {
  const queryRaw = jest.fn().mockResolvedValue(rows);
  const aggregate = jest
    .fn()
    .mockResolvedValue({ _min: { reviewedAt: new Date('2026-09-01') } });
  const dayTheme = jest.fn().mockResolvedValue(THEME);
  const dispatch = jest.fn().mockResolvedValue(undefined);
  const service = new ReviewSpikeAlerts(
    { $queryRaw: queryRaw, review: { aggregate } } as unknown as PrismaService,
    { dayTheme } as unknown as ReviewThemesService,
    { get: () => 2 } as unknown as ConfigService<Env, true>,
    { dispatch } as unknown as AlertsDispatcher,
  );
  return { service, queryRaw, aggregate, dayTheme, dispatch };
};

const spiking = (day: Date, count: number, low: number) => ({
  day,
  count,
  low,
});

describe('ReviewSpikeAlerts.raise', () => {
  it('dispatches one spike for a day that crossed its threshold', async () => {
    const { service, dispatch, dayTheme } = build([
      ...quietHistory,
      spiking(new Date('2026-11-02'), 7, 5),
    ]);
    const inserted = Array.from({ length: 7 }, (_, index) =>
      review(`r${index}`, '2026-11-02T10:00:00.000Z'),
    );

    await service.raise(APP, inserted, NOW);

    expect(dayTheme).toHaveBeenCalledWith(APP, '2026-11-02');
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith({
      event: 'review.spike',
      occurredAt: NOW.toISOString(),
      app: { id: 'app_1', name: 'My App' },
      date: '2026-11-02',
      count: 7,
      median: 1,
      threshold: 5,
      lowShare: 0.71,
      lowScoreMax: 2,
      topTheme: THEME,
    });
  });

  it('reads nothing when no inserted review is from today or yesterday', async () => {
    const { service, queryRaw, dispatch } = build();

    await service.raise(
      APP,
      [review('old', '2026-10-20T10:00:00.000Z'), review('undated')],
      NOW,
    );

    expect(queryRaw).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('dispatches nothing when no day spikes', async () => {
    const { service, dispatch } = build([
      ...quietHistory,
      spiking(new Date('2026-11-02'), 2, 0),
    ]);

    await service.raise(APP, [review('r1', '2026-11-02T10:00:00.000Z')], NOW);

    expect(dispatch).not.toHaveBeenCalled();
  });

  it('dispatches each spiking day on its own', async () => {
    const { service, dispatch } = build([
      ...quietHistory,
      spiking(new Date('2026-11-02'), 6, 0),
      spiking(new Date('2026-11-03'), 6, 0),
    ]);
    const inserted = [
      ...Array.from({ length: 6 }, (_, index) =>
        review(`y${index}`, '2026-11-02T10:00:00.000Z'),
      ),
      ...Array.from({ length: 6 }, (_, index) =>
        review(`t${index}`, '2026-11-03T01:00:00.000Z'),
      ),
    ];

    await service.raise(APP, inserted, NOW);

    expect(
      dispatch.mock.calls.map(
        ([payload]) => (payload as { date: string }).date,
      ),
    ).toEqual(['2026-11-02', '2026-11-03']);
  });

  it('counts the window from four weeks before the first judged day to tomorrow', async () => {
    const { service, queryRaw } = build();

    await service.raise(APP, [review('r1', '2026-11-02T10:00:00.000Z')], NOW);

    const [, scoreMax, appId, from, to] = queryRaw.mock.calls[0] as unknown[];
    expect([scoreMax, appId, from, to]).toEqual([
      2,
      'app_1',
      new Date('2026-10-05T00:00:00.000Z'),
      new Date('2026-11-04T00:00:00.000Z'),
    ]);
  });

  it('logs a failing read instead of failing the sync', async () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    const { service, queryRaw } = build();
    queryRaw.mockRejectedValue(new Error('database down'));

    await expect(
      service.raise(APP, [review('r1', '2026-11-02T10:00:00.000Z')], NOW),
    ).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('app_1'));
    warn.mockRestore();
  });
});
