import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  FIRST_RUN_HISTORY_DAYS,
  FIRST_RUN_STAGES,
  type FirstRunStage,
  type FirstRunStageStatus,
} from '@asobeast/shared';
import { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { FirstRunStatusService } from './first-run-status.service';

const APP_ID = 'app_1';
const NOW = new Date('2026-08-10T09:00:00Z');

interface Fixture {
  exists: boolean;
  createdAt: Date;
  ratingCount: number | null;
  tracked: number;
  ranked: number;
  scored: number;
  reviewed: number;
  captureDays: number;
  cronDaily: string;
  cronScoring: string;
}

const DEFAULTS: Fixture = {
  exists: true,
  createdAt: new Date('2026-08-10T08:00:00Z'),
  ratingCount: 120,
  tracked: 15,
  ranked: 0,
  scored: 0,
  reviewed: 0,
  captureDays: 0,
  cronDaily: '0 3 * * *',
  cronScoring: '0 4 * * 0',
};

function serviceWith(overrides: Partial<Fixture> = {}) {
  const fixture = { ...DEFAULTS, ...overrides };
  const prisma = {
    app: {
      findFirst: jest.fn().mockResolvedValue(
        fixture.exists
          ? {
              id: APP_ID,
              createdAt: fixture.createdAt,
              snapshots: [{ ratingCount: fixture.ratingCount }],
            }
          : null,
      ),
    },
    trackedKeyword: { count: jest.fn().mockResolvedValue(fixture.tracked) },
    review: { count: jest.fn().mockResolvedValue(fixture.reviewed) },
    $queryRaw: jest
      .fn()
      .mockResolvedValueOnce([
        { keywords: fixture.ranked, days: fixture.captureDays },
      ])
      .mockResolvedValueOnce([{ ready: fixture.scored }]),
  };
  const config = {
    get: (key: 'CRON_DAILY' | 'CRON_SCORING') =>
      key === 'CRON_DAILY' ? fixture.cronDaily : fixture.cronScoring,
  };

  return new FirstRunStatusService(
    prisma as unknown as PrismaService,
    config as unknown as ConfigService<Env, true>,
  );
}

const stageOf = (
  stages: FirstRunStageStatus[],
  stage: FirstRunStage,
): FirstRunStageStatus => {
  const found = stages.find((row) => row.stage === stage);
  if (!found) throw new Error(`missing stage ${stage}`);
  return found;
};

describe('FirstRunStatusService', () => {
  it('reports every stage exactly once, in contract order', async () => {
    const status = await serviceWith().forApp(APP_ID, NOW);

    expect(status.appId).toBe(APP_ID);
    expect(status.stages.map((stage) => stage.stage)).toEqual([
      ...FIRST_RUN_STAGES,
    ]);
  });

  it('calls metadata and keywords ready the moment an import returns', async () => {
    const status = await serviceWith().forApp(APP_ID, NOW);

    expect(stageOf(status.stages, 'metadata')).toMatchObject({
      ready: 1,
      total: 1,
      complete: true,
      expectedBy: null,
    });
    expect(stageOf(status.stages, 'keywords')).toMatchObject({
      ready: 15,
      total: 15,
      complete: true,
      expectedBy: null,
    });
    expect(status.complete).toBe(false);
  });

  it('totals rankings and scores against the tracked keywords', async () => {
    const status = await serviceWith({
      tracked: 15,
      ranked: 4,
      scored: 2,
    }).forApp(APP_ID, NOW);

    expect(stageOf(status.stages, 'rankings')).toMatchObject({
      ready: 4,
      total: 15,
      complete: false,
    });
    expect(stageOf(status.stages, 'scores')).toMatchObject({
      ready: 2,
      total: 15,
      complete: false,
    });
  });

  it('names the next daily run for rankings and the weekly run for scores', async () => {
    const status = await serviceWith().forApp(APP_ID, NOW);

    expect(stageOf(status.stages, 'rankings').expectedBy).toBe(
      '2026-08-11T03:00:00.000Z',
    );
    expect(stageOf(status.stages, 'scores').expectedBy).toBe(
      '2026-08-16T04:00:00.000Z',
    );
  });

  it('refuses to guess a time from a cron it cannot parse', async () => {
    const status = await serviceWith({
      cronDaily: '*/15 * * * *',
      cronScoring: '0 4 * * 1-5',
    }).forApp(APP_ID, NOW);

    expect(stageOf(status.stages, 'rankings').expectedBy).toBeNull();
    expect(stageOf(status.stages, 'scores').expectedBy).toBeNull();
  });

  it('drops the expected time as soon as a stage completes', async () => {
    const status = await serviceWith({ tracked: 3, ranked: 3 }).forApp(
      APP_ID,
      NOW,
    );

    expect(stageOf(status.stages, 'rankings')).toMatchObject({
      complete: true,
      expectedBy: null,
    });
  });

  it('caps history at the window and never exceeds its own total', async () => {
    const status = await serviceWith({ captureDays: 40 }).forApp(APP_ID, NOW);
    const history = stageOf(status.stages, 'history');

    expect(history.total).toBe(FIRST_RUN_HISTORY_DAYS);
    expect(history.ready).toBe(FIRST_RUN_HISTORY_DAYS);
    expect(history.complete).toBe(true);
  });

  it('counts the days history still needs into the expected time', async () => {
    const status = await serviceWith({ captureDays: 2 }).forApp(APP_ID, NOW);
    const history = stageOf(status.stages, 'history');

    expect(history).toMatchObject({ ready: 2, total: FIRST_RUN_HISTORY_DAYS });
    expect(history.expectedBy).toBe('2026-08-15T09:00:00.000Z');
  });

  it('expects no reviews for a listing the store reports no ratings for', async () => {
    const status = await serviceWith({ ratingCount: 0 }).forApp(APP_ID, NOW);

    expect(stageOf(status.stages, 'reviews')).toMatchObject({
      ready: 0,
      total: 0,
      complete: true,
      expectedBy: null,
    });
  });

  it('waits on the backfill for a listing that has ratings', async () => {
    const waiting = await serviceWith().forApp(APP_ID, NOW);
    const arrived = await serviceWith({ reviewed: 60 }).forApp(APP_ID, NOW);

    expect(stageOf(waiting.stages, 'reviews')).toMatchObject({
      ready: 0,
      total: 1,
      complete: false,
    });
    expect(stageOf(arrived.stages, 'reviews')).toMatchObject({
      ready: 1,
      total: 1,
      complete: true,
    });
  });

  it('stops promising a backfill that has had its whole window', async () => {
    const status = await serviceWith({
      createdAt: new Date('2026-08-01T09:00:00Z'),
    }).forApp(APP_ID, NOW);

    expect(stageOf(status.stages, 'reviews')).toMatchObject({
      ready: 0,
      total: 0,
      complete: true,
      expectedBy: null,
    });
  });

  it('keeps reporting reviews it already has after the window closes', async () => {
    const status = await serviceWith({
      createdAt: new Date('2026-08-01T09:00:00Z'),
      reviewed: 40,
    }).forApp(APP_ID, NOW);

    expect(stageOf(status.stages, 'reviews')).toMatchObject({
      ready: 1,
      total: 1,
      complete: true,
    });
  });

  it('expects nothing at all from an app tracking no keywords', async () => {
    const status = await serviceWith({ tracked: 0, ratingCount: 0 }).forApp(
      APP_ID,
      NOW,
    );

    expect(status.complete).toBe(true);
    expect(status.stages.every((stage) => stage.expectedBy === null)).toBe(
      true,
    );
  });

  it('calls the envelope complete once every stage is', async () => {
    const status = await serviceWith({
      tracked: 3,
      ranked: 3,
      scored: 3,
      reviewed: 12,
      captureDays: FIRST_RUN_HISTORY_DAYS,
    }).forApp(APP_ID, NOW);

    expect(status.stages.every((stage) => stage.complete)).toBe(true);
    expect(status.complete).toBe(true);
  });

  it('expects nothing more once the first run window has closed', async () => {
    const status = await serviceWith({
      createdAt: new Date('2026-07-01T09:00:00Z'),
      tracked: 15,
      ranked: 4,
      scored: 2,
      captureDays: 3,
    }).forApp(APP_ID, NOW);

    expect(status.complete).toBe(true);
    expect(stageOf(status.stages, 'rankings')).toMatchObject({
      ready: 4,
      total: 4,
      complete: true,
      expectedBy: null,
    });
    expect(stageOf(status.stages, 'history')).toMatchObject({
      ready: 3,
      total: 3,
      complete: true,
    });
  });

  it('keeps waiting on collection that is gated only while the window is open', async () => {
    const status = await serviceWith({
      tracked: 15,
      ranked: 4,
    }).forApp(APP_ID, NOW);

    expect(status.complete).toBe(false);
    expect(stageOf(status.stages, 'rankings')).toMatchObject({
      ready: 4,
      total: 15,
      complete: false,
    });
  });

  it('refuses an app this workspace cannot see', async () => {
    await expect(
      serviceWith({ exists: false }).forApp(APP_ID, NOW),
    ).rejects.toThrow(NotFoundException);
  });
});
