import './helpers/enable-billing';
import { getQueueToken } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { Prisma, Store } from '@prisma/client';
import { Queue } from 'bullmq';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import { DiscoverKeywordPayload, JOBS, QUEUES } from '../src/jobs/jobs.types';
import { KeywordDiscoverySweep } from '../src/jobs/keyword-discovery-sweep.service';
import { PipelineWorker } from '../src/jobs/pipeline.worker';
import {
  CapacityHarness,
  resetCapacity,
  startCapacityHarness,
  stopCapacityHarness,
} from './helpers/capacity-harness';

const DAY_MS = 24 * 60 * 60 * 1000;
const SUSPENDED_WORKSPACE_ID = 'ws_discovery_suspended';
const LAPSED_WORKSPACE_ID = 'ws_discovery_lapsed';

describe('keyword discovery sweep (e2e)', () => {
  jest.setTimeout(60_000);

  let harness: CapacityHarness;

  const queue = (name: string) =>
    harness.app.get<Queue>(getQueueToken(name), { strict: false });

  const queuedApps = async (): Promise<Set<string>> =>
    new Set(
      (await queue(QUEUES.APP_STORE).getJobs(['prioritized']))
        .filter(({ name }) => name === JOBS.DISCOVER_KEYWORD)
        .map(({ data }) => (data as DiscoverKeywordPayload).appId),
    );

  const seedListedApp = async (
    workspaceId: string,
    storeAppId: string,
    extra: Partial<Prisma.AppUncheckedCreateInput> = {},
  ): Promise<string> => {
    const { id } = await harness.prisma.app.create({
      data: {
        workspaceId,
        store: Store.APP_STORE,
        storeAppId,
        country: 'us',
        name: storeAppId,
        ...extra,
      },
    });
    await harness.prisma.appSnapshot.create({
      data: {
        appId: id,
        title: 'Habit Tracker Daily',
        subtitle: 'Build streaks',
        description: '',
        raw: {},
      },
    });
    return id;
  };

  const seedWorkspace = (id: string, data: Prisma.WorkspaceUpdateInput) =>
    harness.prisma.workspace.upsert({
      where: { id },
      update: data,
      create: { id, name: id, ...(data as Prisma.WorkspaceCreateInput) },
    });

  beforeAll(async () => {
    harness = await startCapacityHarness();
  }, 60_000);

  beforeEach(async () => {
    await resetCapacity(harness);
    await seedWorkspace(SUSPENDED_WORKSPACE_ID, {
      plan: 'indie',
      planExpiresAt: new Date(Date.now() + 30 * DAY_MS),
      suspendedAt: new Date(),
    });
    await seedWorkspace(LAPSED_WORKSPACE_ID, {
      plan: 'free',
      planExpiresAt: null,
      trialEndsAt: null,
    });
  });

  afterAll(() => stopCapacityHarness(harness));

  it('plans every listed primary app of an active workspace and nothing else', async () => {
    const active = await seedListedApp(DEFAULT_WORKSPACE_ID, '111');
    const competitor = await seedListedApp(DEFAULT_WORKSPACE_ID, '222', {
      isCompetitor: true,
      primaryAppId: active,
    });
    const delisted = await seedListedApp(DEFAULT_WORKSPACE_ID, '333', {
      delistedAt: new Date(),
    });
    const suspended = await seedListedApp(SUSPENDED_WORKSPACE_ID, '444');
    const lapsed = await seedListedApp(LAPSED_WORKSPACE_ID, '555');

    const queued = await harness.app.get(KeywordDiscoverySweep).run();

    const apps = await queuedApps();
    expect(queued).toBeGreaterThan(0);
    expect([...apps]).toEqual([active]);
    for (const skipped of [competitor, delisted, suspended, lapsed]) {
      expect(apps.has(skipped)).toBe(false);
    }
    expect(await queue(QUEUES.APP_STORE).getJobs(['paused', 'wait'])).toEqual(
      [],
    );
  });

  it('registers the weekly schedule and removes it once its pattern is emptied', async () => {
    const worker = harness.app.get(PipelineWorker);
    await worker.registerSchedules();

    expect(await queue(QUEUES.PIPELINE).getJobSchedulers()).toContainEqual(
      expect.objectContaining({
        key: 'keyword-discovery',
        pattern: '30 7 * * 1',
        name: JOBS.KEYWORD_DISCOVERY,
      }),
    );

    const config = harness.app.get(ConfigService);
    const read = config.get.bind(config);
    const emptied = jest
      .spyOn(config, 'get')
      .mockImplementation((key: string): unknown =>
        key === 'CRON_DISCOVERY' ? '' : read<unknown>(key),
      );
    try {
      await worker.registerSchedules();
    } finally {
      emptied.mockRestore();
    }

    const keys = (await queue(QUEUES.PIPELINE).getJobSchedulers()).map(
      ({ key }) => key,
    );
    expect(keys).not.toContain('keyword-discovery');
    expect(keys).toContain('localization-sweep');
  });
});
