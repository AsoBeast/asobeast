import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { Prisma, Store } from '@prisma/client';
import type { AlertPayload, ReviewSpikeTheme } from '@asobeast/shared';
import type { AlertBuild, AlertOutbox } from '../alerts/alert-outbox';
import type { Env } from '../config/env';
import type { PrismaService } from '../prisma/prisma.service';
import type { ReviewResult } from '../store-providers/types';
import {
  NO_SPIKE_THEMES,
  ReviewSpikeAlerts,
  type ReviewSpikeApp,
} from './review-spike-alerts.service';
import type { ReviewThemesService } from './review-themes.service';

const NOW = new Date('2026-11-03T05:00:00.000Z');
const APP: ReviewSpikeApp = {
  id: 'app_1',
  name: 'My App',
  store: Store.APP_STORE,
  country: 'us',
  iconUrl: 'https://is1-ssl.mzstatic.com/spiky.png',
};
const THEME: ReviewSpikeTheme = {
  phrase: 'crash on launch',
  kind: 'complaint',
  mentions: 9,
};

type DayRow = { day: Date; count: number; low: number };

const review = (id: string, updatedAt?: string): ReviewResult => ({
  reviewId: id,
  score: 1,
  text: 'broken',
  updatedAt: updatedAt ? new Date(updatedAt) : undefined,
});

const quietHistory: DayRow[] = Array.from({ length: 28 }, (_, back) => ({
  day: new Date(Date.UTC(2026, 9, 31 - back)),
  count: 1,
  low: 0,
}));

const onDay = (iso: string, count: number, low: number): DayRow => ({
  day: new Date(iso),
  count,
  low,
});

const burst = (count: number, at = '2026-11-02T10:00:00.000Z') =>
  Array.from({ length: count }, (_, index) => review(`r${index}`, at));

const reads = (rows: DayRow[]) => ({
  $queryRaw: jest.fn().mockResolvedValue(rows),
  review: {
    aggregate: jest
      .fn()
      .mockResolvedValue({ _min: { reviewedAt: new Date('2026-09-01') } }),
  },
});

const build = ({
  stored = quietHistory,
  forecast = quietHistory,
}: { stored?: DayRow[]; forecast?: DayRow[] } = {}) => {
  const tx = reads(stored);
  const forecastTx = reads(forecast);
  const withTransaction = jest.fn((run: (client: unknown) => unknown) =>
    run(forecastTx),
  );
  const dayTheme = jest.fn().mockResolvedValue(THEME);
  const built: (AlertPayload | null)[] = [];
  const record = jest.fn(
    async (
      _tx: Prisma.TransactionClient,
      _subject: string,
      make: AlertBuild,
    ) => {
      built.push(await make());
    },
  );
  const service = new ReviewSpikeAlerts(
    { withTransaction } as unknown as PrismaService,
    { dayTheme } as unknown as ReviewThemesService,
    { get: () => 2 } as unknown as ConfigService<Env, true>,
    { record } as unknown as AlertOutbox,
  );
  return {
    service,
    tx,
    client: tx as unknown as Prisma.TransactionClient,
    forecastTx,
    withTransaction,
    dayTheme,
    record,
    built,
  };
};

describe('ReviewSpikeAlerts.record', () => {
  it('records one spike for a day the inserts carried over its threshold', async () => {
    const { service, client, built, record } = build({
      stored: [...quietHistory, onDay('2026-11-02', 7, 5)],
    });

    await service.record(client, {
      app: APP,
      inserted: burst(7),
      themes: new Map([['2026-11-02', THEME]]),
      now: NOW,
    });

    expect(record).toHaveBeenCalledTimes(1);
    expect(built).toEqual([
      {
        event: 'review.spike',
        occurredAt: NOW.toISOString(),
        app: {
          id: 'app_1',
          name: 'My App',
          iconUrl: 'https://is1-ssl.mzstatic.com/spiky.png',
          store: Store.APP_STORE,
          country: 'us',
        },
        date: '2026-11-02',
        count: 7,
        median: 1,
        threshold: 5,
        lowShare: 0.71,
        lowScoreMax: 2,
        topTheme: THEME,
      },
    ]);
  });

  it('reads only through the transaction it was given', async () => {
    const { service, client, tx, withTransaction } = build({
      stored: [...quietHistory, onDay('2026-11-02', 7, 5)],
    });

    await service.record(client, {
      app: APP,
      inserted: burst(7),
      themes: NO_SPIKE_THEMES,
      now: NOW,
    });

    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(tx.review.aggregate).toHaveBeenCalledTimes(1);
    expect(withTransaction).not.toHaveBeenCalled();
  });

  it('builds null for a day that did not cross', async () => {
    const { service, client, built } = build();

    await service.record(client, {
      app: APP,
      inserted: burst(1),
      themes: NO_SPIKE_THEMES,
      now: NOW,
    });

    expect(built).toEqual([null]);
  });

  it('records each judged day in its own outbox record', async () => {
    const { service, client, record } = build({
      stored: [
        ...quietHistory,
        onDay('2026-11-02', 7, 7),
        onDay('2026-11-03', 6, 6),
      ],
    });

    await service.record(client, {
      app: APP,
      inserted: [...burst(7), ...burst(6, '2026-11-03T02:00:00.000Z')],
      themes: NO_SPIKE_THEMES,
      now: NOW,
    });

    expect(record.mock.calls.map(([, subject]) => subject)).toEqual([
      'the review spike of app app_1 on 2026-11-02',
      'the review spike of app app_1 on 2026-11-03',
    ]);
    expect(record.mock.calls.every(([given]) => given === client)).toBe(true);
  });

  it('records nothing when no inserted review is from today or yesterday', async () => {
    const { service, client, record, tx } = build();

    await service.record(client, {
      app: APP,
      inserted: [review('old', '2026-10-01T10:00:00.000Z'), review('undated')],
      themes: NO_SPIKE_THEMES,
      now: NOW,
    });

    expect(record).not.toHaveBeenCalled();
    expect(tx.$queryRaw).not.toHaveBeenCalled();
  });

  it('records the spike without a theme when the forecast had none', async () => {
    const { service, client, built } = build({
      stored: [...quietHistory, onDay('2026-11-02', 7, 5)],
    });

    await service.record(client, {
      app: APP,
      inserted: burst(7),
      themes: NO_SPIKE_THEMES,
      now: NOW,
    });

    expect(built[0]).toMatchObject({ topTheme: null });
  });

  it("judges with the sync's own clock", async () => {
    const { service, client, record } = build();
    const justAfterMidnight = new Date('2026-11-10T00:00:01.000Z');

    await service.record(client, {
      app: APP,
      inserted: [
        review('yesterday', '2026-11-09T22:00:00.000Z'),
        review('two days ago', '2026-11-08T22:00:00.000Z'),
      ],
      themes: NO_SPIKE_THEMES,
      now: justAfterMidnight,
    });

    expect(record.mock.calls.map(([, subject]) => subject)).toEqual([
      'the review spike of app app_1 on 2026-11-09',
    ]);
  });
});

describe('ReviewSpikeAlerts.themesFor', () => {
  afterEach(() => jest.restoreAllMocks());

  it('reads the theme only for a day the forecast says will cross', async () => {
    const { service, dayTheme } = build();
    const pending = [...burst(7), review('today', '2026-11-03T01:00:00.000Z')];

    const themes = await service.themesFor(APP, pending, NOW);

    expect(dayTheme).toHaveBeenCalledTimes(1);
    expect(dayTheme).toHaveBeenCalledWith(APP, '2026-11-02', pending);
    expect([...themes]).toEqual([['2026-11-02', THEME]]);
  });

  it('reads no theme when the day was over its threshold before this sync', async () => {
    const { service, dayTheme } = build({
      forecast: [...quietHistory, onDay('2026-11-02', 11, 11)],
    });

    const themes = await service.themesFor(APP, burst(1), NOW);

    expect(dayTheme).not.toHaveBeenCalled();
    expect(themes.size).toBe(0);
  });

  it("reads the stored history in its own transaction, never the record's", async () => {
    const { service, withTransaction, forecastTx, tx } = build();

    await service.themesFor(APP, burst(7), NOW);

    expect(withTransaction).toHaveBeenCalledTimes(1);
    expect(forecastTx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(tx.$queryRaw).not.toHaveBeenCalled();
  });

  it('logs and leaves a day without a theme when its forecast fails', async () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockReturnValue();
    const { service, dayTheme } = build();
    dayTheme
      .mockRejectedValueOnce(new Error('themes down'))
      .mockResolvedValueOnce(THEME);
    const pending = [...burst(7), ...burst(7, '2026-11-03T01:00:00.000Z')];

    const themes = await service.themesFor(APP, pending, NOW);

    expect(dayTheme).toHaveBeenCalledTimes(2);
    expect([...themes]).toEqual([['2026-11-03', THEME]]);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('app_1 on 2026-11-02'),
    );
  });

  it('reads nothing when no pending review is from today or yesterday', async () => {
    const { service, withTransaction, dayTheme } = build();

    const themes = await service.themesFor(
      APP,
      [review('old', '2026-10-01T10:00:00.000Z')],
      NOW,
    );

    expect(themes.size).toBe(0);
    expect(withTransaction).not.toHaveBeenCalled();
    expect(dayTheme).not.toHaveBeenCalled();
  });
});
