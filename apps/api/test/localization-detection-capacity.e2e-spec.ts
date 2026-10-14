import './helpers/enable-billing';
import { getQueueToken } from '@nestjs/bullmq';
import { Prisma, Store } from '@prisma/client';
import { Job, Queue } from 'bullmq';
import request from 'supertest';
import {
  ApiErrorEnvelope,
  LocalizationDetectionResult,
  PLAN_LIMITS,
} from '@asobeast/shared';
import { OnDemandLimiter } from '../src/auth/on-demand.limiter';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import { WorkspaceContext } from '../src/common/tenancy/workspace-context';
import {
  DetectLocalizationPayload,
  JOBS,
  QUEUES,
  utcDateKey,
} from '../src/jobs/jobs.types';
import { StoreJobsHandler } from '../src/jobs/store-jobs.handler';
import { ProxyEgress } from '../src/store-providers/egress/proxy-egress.service';
import { mintApiToken } from './helpers/api-tokens';
import {
  allowanceSpendsDuring,
  CapacityHarness,
  OwnerAgent,
  resetCapacity,
  startCapacityHarness,
  stopCapacityHarness,
} from './helpers/capacity-harness';
import { OWNER } from './helpers/session';

const REFRESH_LIMIT = PLAN_LIMITS.indie.onDemand?.refresh.limit ?? 0;

describe('Localization detection capacity (e2e)', () => {
  jest.setTimeout(45_000);

  let harness: CapacityHarness;
  let owner: OwnerAgent;
  let appId: string;

  const seedApp = async (
    data: Partial<Prisma.AppUncheckedCreateInput> = {},
    languages = ['EN', 'ES', 'FR'],
  ) => {
    const created = await harness.prisma.app.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store: Store.APP_STORE,
        storeAppId: '555000222',
        country: 'us',
        name: 'Detect Fixture',
        ...data,
      },
    });
    await harness.prisma.appSnapshot.create({
      data: {
        appId: created.id,
        title: 'Seeded Title',
        description: 'Seeded text',
        raw: { languages },
      },
    });
    return created.id;
  };

  const detect = (id = appId) => owner.post(`/apps/${id}/localizations/detect`);

  const detectJobs = () =>
    harness.app
      .get<Queue>(getQueueToken(QUEUES.APP_STORE), { strict: false })
      .getJobs(['prioritized']);

  const spendRefreshAllowance = () =>
    harness.app.get(WorkspaceContext).run(DEFAULT_WORKSPACE_ID, async () => {
      const limiter = harness.app.get(OnDemandLimiter);
      for (let used = 0; used < REFRESH_LIMIT; used += 1) {
        await limiter.consume('refresh');
      }
    });

  beforeAll(async () => {
    harness = await startCapacityHarness();
  }, 60_000);

  beforeEach(async () => {
    owner = await resetCapacity(harness);
    appId = await seedApp();
  });

  afterAll(() => stopCapacityHarness(harness));

  it('queues one prioritized job per candidate and answers 202', async () => {
    const answer = await detect().expect(202);

    expect(answer.body).toEqual({
      queued: 2,
      candidates: ['fr', 'es-MX'],
    } satisfies LocalizationDetectionResult);
    const jobs = await detectJobs();
    expect(
      jobs
        .map((job) => ({
          id: job.id,
          name: job.name,
          data: job.data as object,
        }))
        .sort((left, right) => String(left.id).localeCompare(String(right.id))),
    ).toEqual(
      ['es-MX', 'fr'].map((localization) => ({
        id: `detect-localization~${appId}~${localization}~${utcDateKey()}`,
        name: JOBS.DETECT_LOCALIZATION,
        data: expect.objectContaining({
          appId,
          localization,
          country: 'us',
          workspaceId: DEFAULT_WORKSPACE_ID,
        }) as object,
      })),
    );
  });

  it('spends exactly one refresh allowance', async () => {
    const [, calls] = await allowanceSpendsDuring(harness, () =>
      detect().expect(202),
    );

    expect(calls).toBe(1);
  });

  it('spends nothing on a second run the same day', async () => {
    await detect().expect(202);
    const before = (await detectJobs()).length;

    const [answer, calls] = await allowanceSpendsDuring(harness, () =>
      detect().expect(202),
    );

    expect(answer.body).toEqual({ queued: 0, candidates: ['fr', 'es-MX'] });
    expect(calls).toBe(0);
    expect(await detectJobs()).toHaveLength(before);
  });

  it('spends nothing when the home listing declares no candidate language', async () => {
    const english = await seedApp({ storeAppId: '555000333' }, ['EN']);

    const [answer, calls] = await allowanceSpendsDuring(harness, () =>
      detect(english).expect(202),
    );

    expect(answer.body).toEqual({ queued: 0, candidates: [] });
    expect(calls).toBe(0);
  });

  it('spends nothing when every candidate is already shipped', async () => {
    for (const localization of ['fr', 'es-MX']) {
      await owner
        .post(`/apps/${appId}/localizations`)
        .send({ localization })
        .expect(201);
    }

    const [answer, calls] = await allowanceSpendsDuring(harness, () =>
      detect().expect(202),
    );

    expect(answer.body).toEqual({ queued: 0, candidates: [] });
    expect(calls).toBe(0);
  });

  it('refuses detection once the refresh allowance is spent and names the action', async () => {
    await spendRefreshAllowance();

    const refused = await detect().expect(429);

    const envelope = refused.body as ApiErrorEnvelope;
    expect(envelope.rateLimit).toEqual({
      window: 'day',
      rateClass: 'store',
      plan: 'indie',
      limit: REFRESH_LIMIT,
      resetSeconds: envelope.retryAfterSeconds,
      upgradeTo: 'ultimate',
      action: 'refresh',
    });
    expect(envelope.message).toMatch(
      /^Refresh limit reached: the indie plan allows \d+ requests per day\./,
    );
    expect(await detectJobs()).toHaveLength(0);
  });

  it('spends nothing and answers 400 for a google play app', async () => {
    const play = await seedApp({
      store: Store.GOOGLE_PLAY,
      storeAppId: 'com.example.detect',
    });

    const [answer, calls] = await allowanceSpendsDuring(harness, () =>
      detect(play).expect(400),
    );

    expect((answer.body as ApiErrorEnvelope).message).toBe(
      'The keyword field is only available for App Store apps',
    );
    expect(calls).toBe(0);
  });

  it('spends nothing on an app the workspace does not have', async () => {
    const [, calls] = await allowanceSpendsDuring(harness, () =>
      detect('no-such-app').expect(404),
    );

    expect(calls).toBe(0);
  });

  it('refuses a read scoped token and accepts a write scoped one', async () => {
    const server = harness.app.getHttpServer();
    const login = await request(server).post('/auth/login').send(OWNER);
    const read = await mintApiToken(harness.app, login, 'read');
    const write = await mintApiToken(harness.app, login, 'write');
    const detectWith = (token: string) =>
      request(server)
        .post(`/apps/${appId}/localizations/detect`)
        .set('Authorization', `Bearer ${token}`);

    const [, calls] = await allowanceSpendsDuring(harness, () =>
      detectWith(read).expect(403),
    );
    expect(calls).toBe(0);
    await detectWith(write).expect(202);
  });

  describe('a probe that runs after the plan lapsed', () => {
    const runProbe = () =>
      harness.app.get(StoreJobsHandler).handle({
        name: JOBS.DETECT_LOCALIZATION,
        id: 'lapsing-probe',
        queueName: QUEUES.APP_STORE,
        data: {
          appId,
          localization: 'fr',
          country: 'us',
          workspaceId: DEFAULT_WORKSPACE_ID,
        } satisfies DetectLocalizationPayload,
      } as Job);

    it('takes no egress endpoint and stores nothing once the plan has expired', async () => {
      await detect().expect(202);
      await harness.prisma.workspace.update({
        where: { id: DEFAULT_WORKSPACE_ID },
        data: { plan: 'free', planExpiresAt: null, trialEndsAt: null },
      });
      const through = jest.spyOn(harness.app.get(ProxyEgress), 'through');

      try {
        await runProbe();
        expect(through).not.toHaveBeenCalled();
      } finally {
        through.mockRestore();
      }
      expect(await harness.prisma.appLocalization.count()).toBe(0);
    });

    it('records the localization while the plan is in force', async () => {
      await detect().expect(202);
      const through = jest.spyOn(harness.app.get(ProxyEgress), 'through');

      try {
        await runProbe();
        expect(through).toHaveBeenCalledTimes(1);
      } finally {
        through.mockRestore();
      }
      await expect(
        harness.prisma.appLocalization.findMany({
          select: { localization: true, origin: true },
        }),
      ).resolves.toEqual([{ localization: 'fr', origin: 'detected' }]);
    });
  });
});
