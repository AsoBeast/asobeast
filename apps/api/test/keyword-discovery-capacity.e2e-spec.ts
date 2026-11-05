import './helpers/enable-billing';
import { getQueueToken } from '@nestjs/bullmq';
import { Store } from '@prisma/client';
import { Queue } from 'bullmq';
import { ApiErrorEnvelope, PLAN_LIMITS } from '@asobeast/shared';
import { OnDemandLimiter } from '../src/auth/on-demand.limiter';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import { WorkspaceContext } from '../src/common/tenancy/workspace-context';
import { JOBS, QUEUES } from '../src/jobs/jobs.types';
import {
  allowanceSpendsDuring,
  CapacityHarness,
  OwnerAgent,
  resetCapacity,
  startCapacityHarness,
  stopCapacityHarness,
} from './helpers/capacity-harness';

const SPIDER_LIMIT = PLAN_LIMITS.indie.onDemand?.spider.limit ?? 0;
const WEEKLY_CAP = 40;

describe('Keyword discovery refresh capacity (e2e)', () => {
  jest.setTimeout(60_000);

  let harness: CapacityHarness;
  let owner: OwnerAgent;
  let appId: string;

  const refresh = (id = appId) =>
    owner.post(`/apps/${id}/keyword-discoveries/refresh`);

  const appStoreQueue = () =>
    harness.app.get<Queue>(getQueueToken(QUEUES.APP_STORE), { strict: false });

  const queuedChecks = async (): Promise<number> =>
    (await appStoreQueue().getJobs(['paused', 'wait', 'prioritized'])).filter(
      ({ name }) => name === JOBS.DISCOVER_KEYWORD,
    ).length;

  const reserved = () =>
    harness.prisma.keywordDiscovery.count({
      where: { queuedAt: { not: null } },
    });

  const seedDiscoveries = async (count: number, id = appId) => {
    await harness.prisma.keyword.createMany({
      data: Array.from({ length: count }, (_, index) => ({
        text: `${id} candidate ${index}`,
        store: Store.APP_STORE,
        country: 'us',
      })),
    });
    const keywords = await harness.prisma.keyword.findMany({
      where: { text: { startsWith: `${id} candidate ` } },
      select: { id: true },
    });
    await harness.prisma.keywordDiscovery.createMany({
      data: keywords.map(({ id: keywordId }) => ({
        appId: id,
        workspaceId: DEFAULT_WORKSPACE_ID,
        keywordId,
        source: 'title',
        relevance: 70,
      })),
    });
  };

  const seedApp = async (
    storeAppId: string,
    extra: {
      isCompetitor?: boolean;
      primaryAppId?: string;
      delistedAt?: Date;
    } = {},
  ) =>
    (
      await harness.prisma.app.create({
        data: {
          workspaceId: DEFAULT_WORKSPACE_ID,
          store: Store.APP_STORE,
          storeAppId,
          country: 'us',
          name: storeAppId,
          ...extra,
        },
      })
    ).id;

  beforeAll(async () => {
    harness = await startCapacityHarness();
  }, 60_000);

  beforeEach(async () => {
    owner = await resetCapacity(harness);
    appId = await seedApp('676000111');
  });

  afterAll(() => stopCapacityHarness(harness));

  it('refuses a refresh once the deep search allowance is spent, queuing nothing', async () => {
    await seedDiscoveries(3);
    const limiter = harness.app.get(OnDemandLimiter);
    await harness.app
      .get(WorkspaceContext)
      .run(DEFAULT_WORKSPACE_ID, async () => {
        for (let spent = 0; spent < SPIDER_LIMIT; spent += 1) {
          await limiter.consume('spider');
        }
      });

    const refused = await refresh().expect(429);

    const envelope = refused.body as ApiErrorEnvelope;
    expect(envelope.rateLimit).toMatchObject({
      action: 'spider',
      plan: 'indie',
      limit: SPIDER_LIMIT,
    });
    expect(refused.headers['retry-after']).toBe(
      String(envelope.retryAfterSeconds),
    );
    expect(await queuedChecks()).toBe(0);
    expect(await reserved()).toBe(0);
  });

  it('queues every check as a prioritized job', async () => {
    await seedDiscoveries(3);

    const answer = await refresh().expect(202);

    expect(answer.body).toEqual({ queued: 3, resolved: 0 });
    expect(await appStoreQueue().getJobs(['prioritized'])).toHaveLength(3);
    expect(await appStoreQueue().getJobs(['paused', 'wait'])).toHaveLength(0);
  });

  it('spends exactly one allowance for a refresh that queues many checks', async () => {
    await seedDiscoveries(25);

    const [answer, calls] = await allowanceSpendsDuring(harness, () =>
      refresh().expect(202),
    );

    expect(answer.body).toMatchObject({ queued: 25 });
    expect(calls).toBe(1);
  });

  it('spends nothing when nothing is due', async () => {
    const [answer, calls] = await allowanceSpendsDuring(harness, () =>
      refresh().expect(202),
    );

    expect(answer.body).toEqual({ queued: 0, resolved: 0 });
    expect(calls).toBe(0);
  });

  it('stops at the weekly cap and spends nothing once it is used', async () => {
    await seedDiscoveries(WEEKLY_CAP + 5);

    await expect(refresh().expect(202)).resolves.toMatchObject({
      body: { queued: WEEKLY_CAP },
    });
    const [answer, calls] = await allowanceSpendsDuring(harness, () =>
      refresh().expect(202),
    );

    expect(answer.body).toEqual({ queued: 0, resolved: 0 });
    expect(calls).toBe(0);
    expect(await queuedChecks()).toBe(WEEKLY_CAP);
  });

  it.each<[string, () => Promise<string>, number]>([
    ['an unknown app', () => Promise.resolve('no-such-app'), 404],
    [
      'a competitor',
      () => seedApp('676000222', { isCompetitor: true, primaryAppId: appId }),
      400,
    ],
  ])('spends nothing for %s', async (_, idOf, status) => {
    const id = await idOf();
    const [, calls] = await allowanceSpendsDuring(harness, () =>
      refresh(id).expect(status),
    );

    expect(calls).toBe(0);
  });

  it('spends nothing and queues nothing for a delisted app', async () => {
    const delisted = await seedApp('676000333', { delistedAt: new Date() });
    await seedDiscoveries(3, delisted);

    const [answer, calls] = await allowanceSpendsDuring(harness, () =>
      refresh(delisted).expect(202),
    );

    expect(answer.body).toEqual({ queued: 0, resolved: 0 });
    expect(calls).toBe(0);
    expect(await queuedChecks()).toBe(0);
  });
});
