import { ServiceUnavailableException } from '@nestjs/common';
import { Queue } from 'bullmq';
import { CrossTenantAccess } from '../common/tenancy/cross-tenant-access';
import { WorkspaceContext } from '../common/tenancy/workspace-context';
import { HealthController } from './health.controller';
import { PrismaService } from '../prisma/prisma.service';

const HOUR_MS = 60 * 60 * 1000;

interface Options {
  dbUp?: boolean;
  redisUp?: boolean;
  lastRun?: string | null;
  appCount?: number;
  appStoreFailed?: number;
  gplayFailed?: number;
  alertsFailed?: number;
  actions?: { generatedAt: Date | null; open: number };
}

function build(options: Options = {}) {
  const {
    dbUp = true,
    redisUp = true,
    lastRun = new Date().toISOString(),
    appCount = 1,
    appStoreFailed = 0,
    gplayFailed = 0,
    alertsFailed = 0,
    actions = { generatedAt: null, open: 0 },
  } = options;

  const client = {
    ping: jest.fn(() =>
      redisUp ? Promise.resolve('PONG') : Promise.reject(new Error('down')),
    ),
    get: jest.fn().mockResolvedValue(lastRun),
  };

  const prisma = {
    $queryRaw: dbUp
      ? jest.fn().mockResolvedValue([{ '?column?': 1 }])
      : jest.fn().mockRejectedValue(new Error('unreachable')),
    app: { count: jest.fn().mockResolvedValue(appCount) },
    actionItem: {
      aggregate: jest
        .fn()
        .mockResolvedValue({ _max: { lastSeenAt: actions.generatedAt } }),
      count: jest.fn().mockResolvedValue(actions.open),
    },
  } as unknown as PrismaService;

  const pipelineQueue = {
    getBackend: () => ({ client: Promise.resolve(client) }),
  } as unknown as Queue;
  const appStoreQueue = {
    getFailedCount: jest.fn().mockResolvedValue(appStoreFailed),
  } as unknown as Queue;
  const gplayQueue = {
    getFailedCount: jest.fn().mockResolvedValue(gplayFailed),
  } as unknown as Queue;
  const alertsQueue = {
    getFailedCount: jest.fn().mockResolvedValue(alertsFailed),
  } as unknown as Queue;

  return new HealthController(
    prisma,
    pipelineQueue,
    appStoreQueue,
    gplayQueue,
    alertsQueue,
    new CrossTenantAccess(new WorkspaceContext()),
  );
}

describe('HealthController', () => {
  it('reports ok with a fresh run and no failures', async () => {
    const lastRun = new Date(Date.now() - HOUR_MS).toISOString();
    const result = await build({ lastRun }).check();

    expect(result).toEqual({
      status: 'ok',
      db: 'up',
      redis: 'up',
      pipeline: {
        lastDailyRunAt: lastRun,
        stale: false,
        failedJobs: 0,
        actions: { generatedAt: null, open: 0 },
      },
    });
  });

  it('reports the action center generation timestamp and open count', async () => {
    const generatedAt = new Date('2026-07-30T03:10:00.000Z');
    const result = await build({
      actions: { generatedAt, open: 7 },
    }).check();

    expect(result.pipeline?.actions).toEqual({
      generatedAt: generatedAt.toISOString(),
      open: 7,
    });
  });

  it('flags a stale pipeline when the last run is older than 26h and apps exist', async () => {
    const result = await build({
      lastRun: new Date(Date.now() - 30 * HOUR_MS).toISOString(),
      appCount: 3,
    }).check();

    expect(result.pipeline?.stale).toBe(true);
  });

  it('is not stale on a fresh install with no apps', async () => {
    const result = await build({
      lastRun: new Date(Date.now() - 30 * HOUR_MS).toISOString(),
      appCount: 0,
    }).check();

    expect(result.pipeline?.stale).toBe(false);
  });

  it('is not stale when no run has been recorded yet', async () => {
    const result = await build({ lastRun: null, appCount: 2 }).check();

    expect(result.pipeline?.lastDailyRunAt).toBeNull();
    expect(result.pipeline?.stale).toBe(false);
  });

  it('sums failed jobs across the app store, gplay and alerts queues', async () => {
    const result = await build({
      appStoreFailed: 2,
      gplayFailed: 4,
      alertsFailed: 3,
    }).check();

    expect(result.pipeline?.failedJobs).toBe(9);
  });

  it('degrades to redis down and pipeline null when redis is unreachable', async () => {
    const result = await build({ redisUp: false }).check();

    expect(result.status).toBe('ok');
    expect(result.db).toBe('up');
    expect(result.redis).toBe('down');
    expect(result.pipeline).toBeNull();
  });

  it('throws 503 when the database is unreachable but still reports signals', async () => {
    await expect(build({ dbUp: false }).check()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
