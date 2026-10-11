import './helpers/enable-billing';
import { getQueueToken } from '@nestjs/bullmq';
import { Prisma, Store } from '@prisma/client';
import { Job, Queue } from 'bullmq';
import { ApiErrorEnvelope, PLAN_LIMITS } from '@asobeast/shared';
import { OnDemandLimiter } from '../src/auth/on-demand.limiter';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import {
  JOBS,
  QUEUES,
  SpiderProbePayload,
  utcDateKey,
} from '../src/jobs/jobs.types';
import { StoreJobsHandler } from '../src/jobs/store-jobs.handler';
import { SPIDER_PROBES } from '../src/keywords/spider';
import { ProxyEgress } from '../src/store-providers/egress/proxy-egress.service';
import {
  CapacityHarness,
  OwnerAgent,
  resetCapacity,
  startCapacityHarness,
  stopCapacityHarness,
} from './helpers/capacity-harness';

const SPIDER_LIMIT = PLAN_LIMITS.indie.onDemand?.spider.limit ?? 0;

describe('Keyword deep search capacity (e2e)', () => {
  jest.setTimeout(45_000);

  let harness: CapacityHarness;
  let owner: OwnerAgent;
  let appId: string;

  const startSpider = (term: string, id = appId) =>
    owner.post(`/apps/${id}/keywords/spider`).send({ term });

  const appStoreQueue = () =>
    harness.app.get<Queue>(getQueueToken(QUEUES.APP_STORE), { strict: false });

  const queuedProbes = async (): Promise<number> =>
    (await appStoreQueue().getJobs(['paused', 'wait', 'prioritized'])).length;

  beforeAll(async () => {
    harness = await startCapacityHarness();
  }, 60_000);

  beforeEach(async () => {
    owner = await resetCapacity(harness);
    appId = (
      await harness.prisma.app.create({
        data: {
          workspaceId: DEFAULT_WORKSPACE_ID,
          store: Store.APP_STORE,
          storeAppId: '555000111',
          country: 'us',
          name: 'Spider Fixture',
        },
      })
    ).id;
  });

  afterAll(() => stopCapacityHarness(harness));

  it('refuses a deep search once the plan allowance is spent and names the action', async () => {
    for (let started = 0; started < SPIDER_LIMIT; started += 1) {
      await startSpider(`seed ${started}`).expect(202);
    }

    const refused = await startSpider('one too many').expect(429);

    const envelope = refused.body as ApiErrorEnvelope;
    expect(envelope.rateLimit).toEqual({
      window: 'day',
      rateClass: 'store',
      plan: 'indie',
      limit: SPIDER_LIMIT,
      resetSeconds: envelope.retryAfterSeconds,
      upgradeTo: 'ultimate',
      action: 'spider',
    });
    expect(envelope.message).toMatch(
      /^Deep search limit reached: the indie plan allows \d+ requests per day\./,
    );
    expect(refused.headers['retry-after']).toBe(
      String(envelope.retryAfterSeconds),
    );
  });

  it('queues no probe for the refused deep search', async () => {
    for (let started = 0; started < SPIDER_LIMIT; started += 1) {
      await startSpider(`seed ${started}`).expect(202);
    }
    const queuedBefore = await queuedProbes();

    await startSpider('one too many').expect(429);

    expect(queuedBefore).toBe(SPIDER_LIMIT * SPIDER_PROBES.length);
    expect(await queuedProbes()).toBe(queuedBefore);
  });

  it('queues every probe as a prioritized job', async () => {
    await startSpider('seed').expect(202);

    const queue = appStoreQueue();
    const prioritized = await queue.getJobs(['prioritized']);
    const unprioritized = await queue.getJobs(['paused', 'wait']);

    expect(prioritized).toHaveLength(SPIDER_PROBES.length);
    expect(unprioritized).toHaveLength(0);
  });

  it('spends nothing on a term whose probes are all stored', async () => {
    const day = new Date(`${utcDateKey()}T00:00:00.000Z`);
    await harness.prisma.suggestProbe.createMany({
      data: SPIDER_PROBES.map((probe) => ({
        appId,
        term: 'stored term',
        country: 'us',
        day,
        probe,
        results: [],
      })),
    });
    const consume = jest.spyOn(harness.app.get(OnDemandLimiter), 'consume');

    const answer = await startSpider('stored term').expect(202);
    const calls = consume.mock.calls.length;
    consume.mockRestore();

    expect(answer.body).toEqual({ enqueued: 0 });
    expect(calls).toBe(0);
  });

  it('spends nothing on a term whose probes are all still queued', async () => {
    await startSpider('queued term').expect(202);
    const queuedBefore = await queuedProbes();
    const consume = jest.spyOn(harness.app.get(OnDemandLimiter), 'consume');

    const answer = await startSpider('queued term').expect(202);
    const calls = consume.mock.calls.length;
    consume.mockRestore();

    expect(calls).toBe(0);
    expect(answer.body).toEqual({ enqueued: 0 });
    expect(await queuedProbes()).toBe(queuedBefore);
  });

  it('spends nothing on an app the workspace does not have', async () => {
    const consume = jest.spyOn(harness.app.get(OnDemandLimiter), 'consume');

    await startSpider('missing app', 'no-such-app').expect(404);
    const calls = consume.mock.calls.length;
    consume.mockRestore();

    expect(calls).toBe(0);
  });

  describe('a probe that runs after the plan lapsed', () => {
    const lapse = (data: Prisma.WorkspaceUpdateInput) =>
      harness.prisma.workspace.update({
        where: { id: DEFAULT_WORKSPACE_ID },
        data,
      });

    const runProbe = () =>
      harness.app.get(StoreJobsHandler).handle({
        name: JOBS.SPIDER_PROBE,
        id: 'lapsing-probe',
        queueName: QUEUES.APP_STORE,
        data: {
          appId,
          term: 'lapsing',
          country: 'us',
          probe: 'a',
          workspaceId: DEFAULT_WORKSPACE_ID,
        } satisfies SpiderProbePayload,
      } as Job);

    const egressCallsOf = async (run: () => Promise<void>) => {
      const through = jest.spyOn(harness.app.get(ProxyEgress), 'through');
      await run();
      const calls = through.mock.calls.length;
      through.mockRestore();
      return calls;
    };

    it('stores nothing once the plan has expired', async () => {
      await startSpider('lapsing').expect(202);
      await lapse({ plan: 'free', planExpiresAt: null, trialEndsAt: null });

      await runProbe();

      expect(await harness.prisma.suggestProbe.count()).toBe(0);
    });

    it('holds no egress endpoint once the plan has expired', async () => {
      await startSpider('lapsing').expect(202);
      await lapse({ plan: 'free', planExpiresAt: null, trialEndsAt: null });

      expect(await egressCallsOf(runProbe)).toBe(0);
    });

    it('stores nothing once the workspace is suspended', async () => {
      await startSpider('lapsing').expect(202);
      await lapse({ suspendedAt: new Date() });

      await runProbe();

      expect(await harness.prisma.suggestProbe.count()).toBe(0);
    });

    it('stores the probe while the plan is in force', async () => {
      await startSpider('lapsing').expect(202);

      await runProbe();

      expect(await harness.prisma.suggestProbe.count()).toBe(1);
    });
  });
});
