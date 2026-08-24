import { Store } from '@prisma/client';
import { FlowJob, FlowOpts, FlowProducer, Queue } from 'bullmq';
import {
  CategoryBucket,
  CategoryRanksService,
} from '../category-ranks/category-ranks.service';
import { WorkspaceContext } from '../common/tenancy/workspace-context';
import { WorkspaceFanOut } from '../common/tenancy/workspace-fanout';
import { DEFAULT_WORKSPACE_ID } from '../common/tenancy/default-workspace';
import { TrackedKeywordAccess } from '../keywords/tracked-keyword.access';
import { PrismaService } from '../prisma/prisma.service';
import { JOB_OPTIONS } from './job-options';
import { JOBS, QUEUES } from './jobs.types';
import { QuotaService } from '../auth/quota.service';
import { ActiveWorkspaces } from './active-workspaces';
import { DailyCapacity } from './daily-capacity.service';
import { DailyTargetsCollector } from './daily-targets.service';
import { OverLimitRegistry } from './over-limit.registry';
import { dedupeChildren, PipelineService } from './pipeline.service';

const workspace = new WorkspaceContext();
const fanOut = {
  each: <T>(_justification: string, work: () => Promise<T>) =>
    workspace.run(DEFAULT_WORKSPACE_ID, async () => ({
      results: [await work()],
      failures: [],
    })),
  eachOf: <T>(_workspaceIds: string[], work: () => Promise<T>) =>
    workspace.run(DEFAULT_WORKSPACE_ID, async () => ({
      results: [await work()],
      failures: [],
    })),
} as unknown as WorkspaceFanOut;

const activeWorkspaces = {
  forDailyRun: jest.fn().mockResolvedValue([DEFAULT_WORKSPACE_ID]),
} as unknown as ActiveWorkspaces;

const quotaOff = {
  limitFor: () => Promise.resolve(null),
} as unknown as QuotaService;

const hostCapacity = (itunesRpm = 15, gplayRpm = 10) =>
  ({
    perDay: (store: string) =>
      Promise.resolve(
        (store === 'GOOGLE_PLAY' ? gplayRpm : itunesRpm) * 60 * 24,
      ),
  }) as unknown as DailyCapacity;

const overLimit = {
  state: jest.fn().mockResolvedValue({ since: null, notifiedAt: null }),
  recordWithinLimit: jest.fn().mockResolvedValue(undefined),
  recordOverLimit: jest.fn().mockResolvedValue(undefined),
} as unknown as OverLimitRegistry;

const twoWorkspaces = {
  each: <T>(_justification: string, work: () => Promise<T>) =>
    workspace.run(DEFAULT_WORKSPACE_ID, async () => ({
      results: [await work()],
      failures: [],
    })),
  eachOf: async <T>(_ids: string[], work: () => Promise<T>) => ({
    results: [
      await workspace.run('ws_one', work),
      await workspace.run('ws_two', work),
    ],
    failures: [],
  }),
} as unknown as WorkspaceFanOut;

describe('PipelineService', () => {
  const fixedDate = new Date('2026-07-27T23:59:59.000Z');

  const buildQueue = (waiting = 0, delayed = 0) => ({
    add: jest
      .fn<Promise<void>, [string, unknown, Record<string, unknown>?]>()
      .mockResolvedValue(undefined),
    getWaitingCount: jest.fn().mockResolvedValue(waiting),
    getDelayedCount: jest.fn().mockResolvedValue(delayed),
  });
  const buildFlowProducer = () => ({
    add: jest
      .fn<Promise<unknown>, [FlowJob, FlowOpts?]>()
      .mockResolvedValue(undefined),
  });
  const buildCategoryRanks = (buckets: CategoryBucket[] = []) => ({
    buckets: jest.fn().mockResolvedValue(buckets),
  });
  const emptyPrisma = () => ({
    app: { findMany: jest.fn().mockResolvedValue([]) },
    trackedKeyword: { findMany: jest.fn().mockResolvedValue([]) },
  });
  const buildTrackedKeywords = (store: Store = 'APP_STORE') => ({
    require: jest.fn().mockResolvedValue({
      id: 'keyword',
      text: 'habit tracker',
      store,
      country: 'us',
    }),
  });

  const buildService = ({
    appStoreQueue = buildQueue(),
    gplayQueue = buildQueue(),
    flowProducer = buildFlowProducer(),
    prisma = emptyPrisma(),
    categoryRanks = buildCategoryRanks(),
    trackedKeywords = buildTrackedKeywords(),
    quota = quotaOff,
    capacity = hostCapacity(),
    workspaces = fanOut,
  }: {
    appStoreQueue?: ReturnType<typeof buildQueue>;
    gplayQueue?: ReturnType<typeof buildQueue>;
    flowProducer?: ReturnType<typeof buildFlowProducer>;
    prisma?: unknown;
    categoryRanks?: ReturnType<typeof buildCategoryRanks>;
    trackedKeywords?: ReturnType<typeof buildTrackedKeywords>;
    quota?: QuotaService;
    capacity?: DailyCapacity;
    workspaces?: WorkspaceFanOut;
  } = {}) => ({
    appStoreQueue,
    gplayQueue,
    flowProducer,
    trackedKeywords,
    service: new PipelineService(
      appStoreQueue as unknown as Queue,
      gplayQueue as unknown as Queue,
      flowProducer as unknown as FlowProducer,
      prisma as PrismaService,
      categoryRanks as unknown as CategoryRanksService,
      new DailyTargetsCollector(prisma as PrismaService),
      workspace,
      workspaces,
      trackedKeywords as unknown as TrackedKeywordAccess,
      activeWorkspaces,
      quota,
      overLimit,
      capacity,
    ),
  });

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(fixedDate);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('covers only the plan limit once an over-limit workspace runs out of grace', async () => {
    const prisma = {
      app: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            { id: 'primary', isCompetitor: false, store: 'APP_STORE' },
          ]),
      },
      trackedKeyword: {
        findMany: jest.fn().mockResolvedValue(
          ['k3', 'k1', 'k2'].map((keywordId) => ({
            keywordId,
            keyword: { store: 'APP_STORE' },
          })),
        ),
      },
    };
    const recordOverLimit = jest.fn().mockResolvedValue(undefined);
    const { service, flowProducer } = buildService({
      prisma,
      quota: {
        limitFor: jest.fn().mockResolvedValue(2),
      } as unknown as QuotaService,
    });
    (overLimit.state as jest.Mock).mockResolvedValue({
      since: new Date('2026-07-01T00:00:00Z'),
      notifiedAt: new Date('2026-07-01T00:00:00Z'),
    });
    (overLimit.recordOverLimit as jest.Mock).mockImplementation(
      recordOverLimit,
    );

    const summary = await service.fanOutDaily();

    expect(summary.keywords).toBe(2);
    expect(recordOverLimit).toHaveBeenCalledWith(
      expect.anything(),
      { used: 3, limit: 2, dropped: 1 },
      expect.any(Date),
    );
    const [flow] = flowProducer.add.mock.calls[0] as [FlowJob];
    expect(
      (flow.children ?? [])
        .filter((child) => child.name === JOBS.CHECK_KEYWORD)
        .map((child) => (child.data as { keywordId: string }).keywordId),
    ).toEqual(['k1', 'k2']);
  });

  describe('a keyword two workspaces share is one job', () => {
    const sharedKeyword = () => ({
      app: { findMany: jest.fn().mockResolvedValue([]) },
      trackedKeyword: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            { keywordId: 'shared', keyword: { store: 'APP_STORE' } },
          ]),
      },
    });

    it('plans it once rather than once per workspace', async () => {
      const { service, flowProducer } = buildService({
        prisma: sharedKeyword(),
        workspaces: twoWorkspaces,
      });

      const summary = await service.fanOutDaily();

      const [flow] = flowProducer.add.mock.calls[0] as [FlowJob];
      const checks = (flow.children ?? []).filter(
        (child) => child.name === JOBS.CHECK_KEYWORD,
      );
      expect(checks).toHaveLength(1);
      expect(summary.keywords).toBe(1);
    });

    it('never counts the duplicate against the daily capacity', async () => {
      const { service, flowProducer } = buildService({
        prisma: sharedKeyword(),
        workspaces: twoWorkspaces,
        appStoreQueue: buildQueue(21_590),
        capacity: hostCapacity(15, 10),
      });

      await service.fanOutDaily();

      const [flow] = flowProducer.add.mock.calls[0] as [FlowJob];
      expect(flow.children ?? []).toHaveLength(1);
    });
  });

  describe('deduplication only collapses jobs bullmq would collapse', () => {
    it('keeps two children that carry no job id of their own', () => {
      const withoutIds = [
        { name: JOBS.CHECK_KEYWORD, queueName: QUEUES.APP_STORE, data: {} },
        { name: JOBS.CHECK_KEYWORD, queueName: QUEUES.APP_STORE, data: {} },
      ];

      expect(dedupeChildren(withoutIds)).toHaveLength(2);
    });

    it('collapses two children that share a queue and a job id', () => {
      const shared = [
        {
          name: JOBS.CHECK_KEYWORD,
          queueName: QUEUES.APP_STORE,
          data: {},
          opts: { jobId: 'daily~check~k1~2026-07-27' },
        },
        {
          name: JOBS.CHECK_KEYWORD,
          queueName: QUEUES.APP_STORE,
          data: {},
          opts: { jobId: 'daily~check~k1~2026-07-27' },
        },
      ];

      expect(dedupeChildren(shared)).toHaveLength(1);
    });

    it('keeps one job id that appears on two different queues', () => {
      const crossQueue = [
        {
          name: JOBS.CHECK_KEYWORD,
          queueName: QUEUES.APP_STORE,
          data: {},
          opts: { jobId: 'same' },
        },
        {
          name: JOBS.CHECK_KEYWORD,
          queueName: QUEUES.GPLAY,
          data: {},
          opts: { jobId: 'same' },
        },
      ];

      expect(dedupeChildren(crossQueue)).toHaveLength(2);
    });
  });

  describe('degradation is planned per store', () => {
    const targetsOf = (apps: string[], keywords: string[]) => ({
      app: {
        findMany: jest.fn().mockResolvedValue(
          apps.map((store, index) => ({
            id: `app-${index}`,
            isCompetitor: false,
            store,
          })),
        ),
      },
      trackedKeyword: {
        findMany: jest.fn().mockResolvedValue(
          keywords.map((store, index) => ({
            keywordId: `kw-${store}-${index}`,
            keyword: { store },
          })),
        ),
      },
    });

    const stagesOf = (flowProducer: ReturnType<typeof buildFlowProducer>) => {
      const [flow] = flowProducer.add.mock.calls[0] as [FlowJob];
      return (flow.children ?? []).map((child) => ({
        name: child.name,
        queue: child.queueName,
      }));
    };

    it('keeps healthy Apple work when Google Play is buried', async () => {
      const { service, flowProducer } = buildService({
        prisma: targetsOf(['APP_STORE', 'GOOGLE_PLAY'], ['APP_STORE']),
        gplayQueue: buildQueue(3_000),
        capacity: hostCapacity(15, 10),
      });

      await service.fanOutDaily();

      const stages = stagesOf(flowProducer);
      expect(
        stages.some(
          (stage) =>
            stage.queue === QUEUES.APP_STORE && stage.name === JOBS.REFRESH_APP,
        ),
      ).toBe(true);
      expect(
        stages.some(
          (stage) =>
            stage.queue === QUEUES.GPLAY && stage.name === JOBS.REFRESH_APP,
        ),
      ).toBe(false);
    });

    it('sheds Apple work when Apple is buried, whatever room Play has', async () => {
      const { service, flowProducer } = buildService({
        prisma: targetsOf(['APP_STORE', 'GOOGLE_PLAY'], ['APP_STORE']),
        appStoreQueue: buildQueue(60_000),
        capacity: hostCapacity(15, 10),
      });

      await service.fanOutDaily();

      const stages = stagesOf(flowProducer);
      expect(
        stages.some(
          (stage) =>
            stage.queue === QUEUES.APP_STORE && stage.name === JOBS.REFRESH_APP,
        ),
      ).toBe(false);
      expect(
        stages.some(
          (stage) =>
            stage.queue === QUEUES.GPLAY && stage.name === JOBS.REFRESH_APP,
        ),
      ).toBe(true);
    });

    it('never sheds a rank check on either store', async () => {
      const { service, flowProducer } = buildService({
        prisma: targetsOf(
          ['APP_STORE', 'GOOGLE_PLAY'],
          ['APP_STORE', 'GOOGLE_PLAY'],
        ),
        appStoreQueue: buildQueue(60_000),
        gplayQueue: buildQueue(60_000),
      });

      await service.fanOutDaily();

      const checks = stagesOf(flowProducer).filter(
        (stage) => stage.name === JOBS.CHECK_KEYWORD,
      );
      expect(checks.map((stage) => stage.queue).sort()).toEqual(
        [QUEUES.APP_STORE, QUEUES.GPLAY].sort(),
      );
    });
  });

  it('adds one daily flow with every deduplicated store-routed target', async () => {
    const prisma = {
      app: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'primary', isCompetitor: false, store: 'APP_STORE' },
          { id: 'competitor', isCompetitor: true, store: 'GOOGLE_PLAY' },
        ]),
      },
      trackedKeyword: {
        findMany: jest.fn().mockResolvedValue([
          { keywordId: 'apple-keyword', keyword: { store: 'APP_STORE' } },
          { keywordId: 'apple-keyword', keyword: { store: 'APP_STORE' } },
          { keywordId: 'gplay-keyword', keyword: { store: 'GOOGLE_PLAY' } },
        ]),
      },
    };
    const bucket: CategoryBucket = {
      collection: 'free',
      genre: '6007',
      country: 'us',
      store: 'APP_STORE',
    };
    const { service, flowProducer, appStoreQueue, gplayQueue } = buildService({
      prisma,
      categoryRanks: buildCategoryRanks([bucket, bucket]),
    });

    const summary = await service.fanOutDaily();

    expect(summary).toEqual({
      apps: 2,
      keywords: 2,
      categories: 1,
      reviews: 1,
    });
    expect(appStoreQueue.add).not.toHaveBeenCalled();
    expect(gplayQueue.add).not.toHaveBeenCalled();
    expect(flowProducer.add).toHaveBeenCalledTimes(1);
    const [flow, options] = flowProducer.add.mock.calls[0] as [
      FlowJob,
      { queuesOptions: Record<string, unknown> },
    ];
    expect(flow).toMatchObject({
      name: JOBS.DAILY_COMPLETE,
      queueName: QUEUES.PIPELINE,
      data: { date: '2026-07-27', ...summary },
      opts: { ...JOB_OPTIONS, jobId: 'daily-complete~2026-07-27' },
    });
    expect(flow.children).toHaveLength(6);
    expect(
      flow.children?.map(({ name, queueName }) => [name, queueName]),
    ).toEqual([
      [JOBS.REFRESH_APP, QUEUES.APP_STORE],
      [JOBS.REFRESH_APP, QUEUES.GPLAY],
      [JOBS.CHECK_KEYWORD, QUEUES.APP_STORE],
      [JOBS.CHECK_KEYWORD, QUEUES.GPLAY],
      [JOBS.SYNC_REVIEWS, QUEUES.APP_STORE],
      [JOBS.CHECK_CATEGORY, QUEUES.APP_STORE],
    ]);
    for (const child of flow.children ?? []) {
      expect(child.opts).toMatchObject({
        ...JOB_OPTIONS,
        removeDependencyOnFailure: true,
      });
      expect(child.opts?.jobId).toMatch(/^daily~[A-Za-z0-9_~-]+~2026-07-27$/);
      expect(child.opts?.jobId).not.toContain(':');
    }
    expect(options.queuesOptions).toEqual({
      [QUEUES.PIPELINE]: { defaultJobOptions: JOB_OPTIONS },
      [QUEUES.APP_STORE]: { defaultJobOptions: JOB_OPTIONS },
      [QUEUES.GPLAY]: { defaultJobOptions: JOB_OPTIONS },
    });
  });

  it('adds a runnable deterministic root when the day has no targets', async () => {
    const { service, flowProducer } = buildService();

    await expect(service.fanOutDaily()).resolves.toEqual({
      apps: 0,
      keywords: 0,
      categories: 0,
      reviews: 0,
    });

    const [flow] = flowProducer.add.mock.calls[0];
    expect(flow).toMatchObject({
      name: JOBS.DAILY_COMPLETE,
      opts: { jobId: 'daily-complete~2026-07-27' },
      children: [],
    });
  });

  it('reuses the same daily graph on a scheduler retry', async () => {
    const { service, flowProducer } = buildService();

    await service.fanOutDaily();
    await service.fanOutDaily();

    expect(flowProducer.add).toHaveBeenCalledTimes(2);
    expect(flowProducer.add.mock.calls[1]).toEqual(
      flowProducer.add.mock.calls[0],
    );
  });

  it('surfaces an atomic flow creation failure', async () => {
    const flowProducer = buildFlowProducer();
    flowProducer.add.mockRejectedValueOnce(new Error('redis unavailable'));
    const { service } = buildService({ flowProducer });

    await expect(service.fanOutDaily()).rejects.toThrow('redis unavailable');
  });

  it('keeps a manual app fan out parent-free and reviews only the primary', async () => {
    const appStoreQueue = buildQueue();
    const gplayQueue = buildQueue();
    const prisma = {
      app: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'primary',
          store: 'APP_STORE',
          isCompetitor: false,
          competitors: [{ id: 'competitor', store: 'GOOGLE_PLAY' }],
          tracked: [
            { keywordId: 'keyword', keyword: { store: 'APP_STORE' } },
            { keywordId: 'keyword', keyword: { store: 'APP_STORE' } },
          ],
        }),
      },
    };
    const { service, flowProducer } = buildService({
      appStoreQueue,
      gplayQueue,
      prisma,
    });

    const summary = await service.fanOutApp('primary');

    expect(summary).toEqual({
      apps: 2,
      keywords: 1,
      categories: 0,
      reviews: 1,
    });
    expect(flowProducer.add).not.toHaveBeenCalled();
    expect(
      appStoreQueue.add.mock.calls.filter(
        ([name]) => name === JOBS.SYNC_REVIEWS,
      ),
    ).toHaveLength(1);
    expect(
      gplayQueue.add.mock.calls.filter(([name]) => name === JOBS.SYNC_REVIEWS),
    ).toHaveLength(0);
    const calls = [
      ...appStoreQueue.add.mock.calls,
      ...gplayQueue.add.mock.calls,
    ];
    expect(calls.every((call) => !('parent' in (call[2] ?? {})))).toBe(true);
  });
});
