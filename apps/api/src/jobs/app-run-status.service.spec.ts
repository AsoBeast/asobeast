import { NotFoundException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { Store } from '@prisma/client';
import type { CategoryRanksService } from '../category-ranks/category-ranks.service';
import type { Env } from '../config/env';
import type { PrismaService } from '../prisma/prisma.service';
import { AppRunStatusService } from './app-run-status.service';

const TRIGGER = new Date('2026-10-15T03:00:00.000Z');
const TWO_HOURS_LATER = new Date('2026-10-15T05:00:00.000Z');

const tracked = (...countries: string[]) =>
  countries.map((country) => ({ keyword: { country } }));

const APP = {
  id: 'app_1',
  store: Store.APP_STORE,
  country: 'us',
  competitors: [] as { id: string; store: Store; country: string }[],
  tracked: tracked('us', 'us'),
};

interface Options {
  app?: typeof APP | null;
  snapshots?: { appId: string; country: string | null }[];
  captures?: { captured: number; lastCaptureAt: Date | null };
  ranked?: { collection: string; genre: string }[];
  charts?: { collection: string; genre: string }[];
  cron?: string;
}

const build = (options: Options = {}) => {
  const snapshots = jest.fn().mockResolvedValue(options.snapshots ?? []);
  const charts = jest.fn().mockResolvedValue(options.charts ?? []);
  const queryRaw = jest
    .fn()
    .mockResolvedValue([
      options.captures ?? { captured: 0, lastCaptureAt: null },
    ]);
  const prisma = {
    app: {
      findFirst: jest
        .fn()
        .mockResolvedValue(options.app === undefined ? APP : options.app),
    },
    appSnapshot: { findMany: snapshots },
    categoryRank: { findMany: charts },
    $queryRaw: queryRaw,
  } as unknown as PrismaService;
  const config = {
    get: () => options.cron ?? '0 3 * * *',
  } as unknown as ConfigService<Env, true>;
  const categoryRanks = {
    rankedCharts: jest.fn().mockResolvedValue(options.ranked ?? []),
  } as unknown as CategoryRanksService;
  return {
    service: new AppRunStatusService(prisma, config, categoryRanks),
    snapshots,
    charts,
  };
};

const stage = (
  status: { stages: { stage: string }[] },
  name: string,
): unknown => status.stages.find((row) => row.stage === name);

describe('AppRunStatusService', () => {
  it('refuses an app id it cannot resolve', async () => {
    const { service } = build({ app: null });

    await expect(service.forApp('missing', TWO_HOURS_LATER)).rejects.toThrow(
      NotFoundException,
    );
  });

  it("counts today's rank checks against the active keywords", async () => {
    const { service } = build({
      app: { ...APP, tracked: tracked(...Array<string>(40).fill('us')) },
      captures: { captured: 12, lastCaptureAt: TWO_HOURS_LATER },
    });

    const status = await service.forApp(APP.id, TWO_HOURS_LATER);

    expect(stage(status, 'keywords')).toEqual({
      stage: 'keywords',
      ready: 12,
      total: 40,
      complete: false,
    });
    expect(status.state).toBe('running');
  });

  it('counts the listings of the app and its competitors in the home and every tracked market', async () => {
    const { service, snapshots } = build({
      app: {
        ...APP,
        competitors: [
          { id: 'rival_1', store: Store.APP_STORE, country: 'us' },
          { id: 'rival_2', store: Store.APP_STORE, country: 'us' },
        ],
        tracked: tracked('us', 'de'),
      },
      snapshots: [
        { appId: APP.id, country: null },
        { appId: APP.id, country: 'de' },
        { appId: 'rival_1', country: null },
        { appId: 'rival_9', country: null },
      ],
    });

    const status = await service.forApp(APP.id, TWO_HOURS_LATER);

    expect(stage(status, 'listings')).toEqual({
      stage: 'listings',
      ready: 3,
      total: 6,
      complete: false,
    });
    expect(snapshots).toHaveBeenCalledWith({
      where: {
        appId: { in: [APP.id, 'rival_1', 'rival_2'] },
        localization: null,
        capturedAt: { gte: new Date('2026-10-15T00:00:00.000Z') },
      },
      select: { appId: true, country: true },
      distinct: ['appId', 'country'],
    });
  });

  it("counts a competitor's home listing in a market that is its home once", async () => {
    const { service } = build({
      app: {
        ...APP,
        competitors: [{ id: 'rival_1', store: Store.APP_STORE, country: 'de' }],
        tracked: tracked('de'),
      },
      snapshots: [{ appId: 'rival_1', country: null }],
    });

    const status = await service.forApp(APP.id, TWO_HOURS_LATER);

    expect(stage(status, 'listings')).toMatchObject({ ready: 1, total: 3 });
  });

  it('counts the chart reads against the charts the app is ranked in', async () => {
    const { service } = build({
      ranked: [
        { collection: 'topfreeapplications', genre: '6013' },
        { collection: 'topfreeapplications', genre: '36' },
      ],
      charts: [
        { collection: 'topfreeapplications', genre: '6013' },
        { collection: 'toppaidapplications', genre: '6013' },
      ],
    });

    const status = await service.forApp(APP.id, TWO_HOURS_LATER);

    expect(stage(status, 'categories')).toEqual({
      stage: 'categories',
      ready: 1,
      total: 2,
      complete: false,
    });
  });

  it('waits for its own listing when it tracks nothing', async () => {
    const waiting = build({ app: { ...APP, tracked: [] } });
    const captured = build({
      app: { ...APP, tracked: [] },
      snapshots: [{ appId: APP.id, country: null }],
    });

    const status = await waiting.service.forApp(APP.id, TWO_HOURS_LATER);

    expect(status.stages.map((row) => row.total)).toEqual([1, 0, 0]);
    expect(status.state).toBe('running');
    await expect(
      captured.service.forApp(APP.id, TWO_HOURS_LATER),
    ).resolves.toMatchObject({ state: 'complete' });
  });

  it('is complete when every count is in', async () => {
    const { service } = build({
      snapshots: [{ appId: APP.id, country: null }],
      captures: { captured: 2, lastCaptureAt: TWO_HOURS_LATER },
    });

    const status = await service.forApp(APP.id, TWO_HOURS_LATER);

    expect(status.state).toBe('complete');
  });

  it('is delayed twenty hours after the trigger with checks missing', async () => {
    const { service } = build({
      snapshots: [{ appId: APP.id, country: null }],
      captures: { captured: 1, lastCaptureAt: TWO_HOURS_LATER },
    });

    const status = await service.forApp(
      APP.id,
      new Date('2026-10-15T23:30:00.000Z'),
    );

    expect(status.state).toBe('delayed');
  });

  it('starts at the previous daily trigger and counts from midnight once it passed', async () => {
    const { service, snapshots } = build();

    const status = await service.forApp(APP.id, TWO_HOURS_LATER);

    expect(status.startedAt).toBe(TRIGGER.toISOString());
    expect(status.date).toBe('2026-10-15');
    expect(snapshots).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          capturedAt: { gte: new Date('2026-10-15T00:00:00.000Z') },
        }) as unknown,
      }),
    );
  });

  it('counts from the previous trigger before today’s has passed', async () => {
    const { service, snapshots } = build();

    const status = await service.forApp(
      APP.id,
      new Date('2026-10-15T01:00:00.000Z'),
    );

    expect(status.startedAt).toBe('2026-10-14T03:00:00.000Z');
    expect(status.date).toBe('2026-10-14');
    expect(snapshots).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          capturedAt: { gte: new Date('2026-10-14T03:00:00.000Z') },
        }) as unknown,
      }),
    );
  });

  it('falls back to a day ago for a cron it cannot parse', async () => {
    const { service } = build({ cron: 'not a cron' });

    const status = await service.forApp(APP.id, TWO_HOURS_LATER);

    expect(status.startedAt).toBe('2026-10-14T05:00:00.000Z');
  });

  it('reports the newest capture time of the day or null', async () => {
    const captured = build({
      captures: { captured: 1, lastCaptureAt: TWO_HOURS_LATER },
    });
    const none = build();

    await expect(
      captured.service.forApp(APP.id, TWO_HOURS_LATER),
    ).resolves.toMatchObject({ lastCaptureAt: TWO_HOURS_LATER.toISOString() });
    await expect(
      none.service.forApp(APP.id, TWO_HOURS_LATER),
    ).resolves.toMatchObject({ lastCaptureAt: null });
  });
});
