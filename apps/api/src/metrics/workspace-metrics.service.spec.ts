import { ConfigService } from '@nestjs/config';
import type { Queue } from 'bullmq';
import type { CategoryRanksService } from '../category-ranks/category-ranks.service';
import { CrossTenantAccess } from '../common/tenancy/cross-tenant-access';
import { WorkspaceContext } from '../common/tenancy/workspace-context';
import {
  APP_STORE_REQUESTS,
  GOOGLE_PLAY_REQUESTS,
} from '../jobs/request-weights';
import type { PrismaService } from '../prisma/prisma.service';
import { WorkspaceMetricsCollector } from './workspace-metrics.service';

const NOW = new Date('2026-08-18T12:00:00.000Z');
const WORKSPACE = 'ws_a';

interface Wiring {
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
      findMany: jest.fn().mockResolvedValue([
        {
          id: WORKSPACE,
          plan: 'indie',
          trialEndsAt: null,
          planExpiresAt: null,
          suspendedAt: null,
        },
      ]),
    },
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
    get: jest.fn((key: string) =>
      key === 'BILLING_ENABLED' ? true : '0 3 * * *',
    ),
  };
  const queue = {
    getBackend: () => ({
      client: Promise.resolve({ mget: jest.fn().mockResolvedValue([]) }),
    }),
  };

  return new WorkspaceMetricsCollector(
    prisma as unknown as PrismaService,
    new CrossTenantAccess(new WorkspaceContext()),
    categoryRanks as unknown as CategoryRanksService,
    config as unknown as ConfigService<never, true>,
    queue as unknown as Queue,
  );
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
