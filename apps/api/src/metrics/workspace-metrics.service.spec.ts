import { ConfigService } from '@nestjs/config';
import type { Redis } from 'ioredis';
import type { CategoryRanksService } from '../category-ranks/category-ranks.service';
import { CrossTenantAccess } from '../common/tenancy/cross-tenant-access';
import { WorkspaceContext } from '../common/tenancy/workspace-context';
import {
  APP_STORE_REQUESTS,
  GOOGLE_PLAY_REQUESTS,
} from '../jobs/request-weights';
import type { PrismaService } from '../prisma/prisma.service';
import { FailFastRedis } from '../redis/fail-fast-redis';
import { SPENDING_STATUSES } from '../ai/ai-gateway.service';
import { aiPeriodOf } from '../ai/ai-period';
import { WorkspaceMetricsCollector } from './workspace-metrics.service';

const NOW = new Date('2026-08-18T12:00:00.000Z');
const WORKSPACE = 'ws_a';

interface AiCallRow {
  workspaceId: string;
  status: string;
  _count: { _all: number };
  _sum: {
    inputTokens: number | null;
    cachedInputTokens: number | null;
    outputTokens: number | null;
  };
}

interface Wiring {
  workspaces?: string[];
  aiCalls?: AiCallRow[];
  keywordMarkets?: { workspaceId: string; store: string; count: number }[];
  buckets?: {
    collection: string;
    genre: string;
    country: string;
    store: string;
  }[];
}

function collectorWith(wiring: Wiring = {}) {
  const prisma = {
    workspace: {
      findMany: jest.fn().mockResolvedValue(
        (wiring.workspaces ?? [WORKSPACE]).map((id) => ({
          id,
          plan: 'indie',
          trialEndsAt: null,
          planExpiresAt: null,
          suspendedAt: null,
        })),
      ),
    },
    aiCall: { groupBy: jest.fn().mockResolvedValue(wiring.aiCalls ?? []) },
    app: {
      groupBy: jest.fn().mockResolvedValue([
        {
          workspaceId: WORKSPACE,
          store: 'APP_STORE',
          isCompetitor: false,
          _count: { _all: 1 },
        },
      ]),
    },
    keywordRanking: { groupBy: jest.fn().mockResolvedValue([]) },
    $queryRaw: jest
      .fn()
      .mockResolvedValueOnce(wiring.keywordMarkets ?? [])
      .mockResolvedValue([]),
  };
  const categoryRanks = {
    bucketsByWorkspace: jest
      .fn()
      .mockResolvedValue(new Map([[WORKSPACE, wiring.buckets ?? []]])),
  };
  const config = {
    get: jest.fn((key: string) => {
      if (key === 'BILLING_ENABLED') return true;
      if (key === 'AI_CALLS_PER_MONTH') return null;
      return '0 3 * * *';
    }),
  };
  const redis = new FailFastRedis({
    mget: jest.fn().mockResolvedValue([]),
  } as unknown as Redis);

  const collector = new WorkspaceMetricsCollector(
    prisma as unknown as PrismaService,
    new CrossTenantAccess(new WorkspaceContext()),
    categoryRanks as unknown as CategoryRanksService,
    config as unknown as ConfigService<never, true>,
    redis,
  );
  return Object.assign(collector, { prismaDouble: prisma });
}

describe('WorkspaceMetricsCollector estimated requests', () => {
  it('charges the daily estimate for the category buckets the pipeline would run', async () => {
    const collector = collectorWith({
      buckets: [
        {
          collection: 'free',
          genre: '6013',
          country: 'us',
          store: 'APP_STORE',
        },
        {
          collection: 'grossing',
          genre: '6013',
          country: 'us',
          store: 'APP_STORE',
        },
      ],
    });

    const [metrics] = await collector.collect(NOW);

    expect(metrics.estimatedRequests.APP_STORE).toBe(
      APP_STORE_REQUESTS.apps +
        APP_STORE_REQUESTS.reviews +
        2 * APP_STORE_REQUESTS.categories,
    );
  });

  it('weights a Google Play category bucket by its own request cost', async () => {
    const collector = collectorWith({
      buckets: [
        {
          collection: 'free',
          genre: 'GAME',
          country: 'us',
          store: 'GOOGLE_PLAY',
        },
      ],
    });

    const [metrics] = await collector.collect(NOW);

    expect(metrics.estimatedRequests.GOOGLE_PLAY).toBe(
      GOOGLE_PLAY_REQUESTS.categories,
    );
  });

  it('leaves the estimate free of category work when nothing charts', async () => {
    const collector = collectorWith({ buckets: [] });

    const [metrics] = await collector.collect(NOW);

    expect(metrics.estimatedRequests.APP_STORE).toBe(
      APP_STORE_REQUESTS.apps + APP_STORE_REQUESTS.reviews,
    );
  });
});

describe('WorkspaceMetricsCollector ai calls', () => {
  const tokens = (input: number, cachedInput: number, output: number) => ({
    inputTokens: input,
    cachedInputTokens: cachedInput,
    outputTokens: output,
  });

  const wiring: Wiring = {
    workspaces: [WORKSPACE, 'ws_b'],
    aiCalls: [
      {
        workspaceId: WORKSPACE,
        status: 'counted',
        _count: { _all: 3 },
        _sum: tokens(9_000, 1_024, 1_400),
      },
      {
        workspaceId: WORKSPACE,
        status: 'reserved',
        _count: { _all: 1 },
        _sum: tokens(500, 50, 70),
      },
    ],
  };

  it("counts this month's reserved and counted calls per workspace", async () => {
    const collector = collectorWith(wiring);

    const [first, second] = await collector.collect(NOW);

    expect(first.aiCallsMonth).toBe(4);
    expect(second.aiCallsMonth).toBe(0);
    const period = aiPeriodOf(NOW);
    expect(collector.prismaDouble.aiCall.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: { in: SPENDING_STATUSES },
          createdAt: { gte: period.start, lt: period.resetsAt },
        },
      }),
    );
  });

  it('sums tokens of counted calls only', async () => {
    const [first, second] = await collectorWith(wiring).collect(NOW);

    expect(first.aiTokensMonth).toEqual({
      input: 9_000,
      cachedInput: 1_024,
      output: 1_400,
    });
    expect(second.aiTokensMonth).toEqual({
      input: 0,
      cachedInput: 0,
      output: 0,
    });
  });
});
