import './helpers/enable-billing';
import { Prisma, Store } from '@prisma/client';
import { Job } from 'bullmq';
import { PLAN_LIMITS, utcDayOf } from '@asobeast/shared';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import { DiscoverKeywordPayload, JOBS, QUEUES } from '../src/jobs/jobs.types';
import { StoreJobsHandler } from '../src/jobs/store-jobs.handler';
import { ProxyEgress } from '../src/store-providers/egress/proxy-egress.service';
import { StoreProviderRegistry } from '../src/store-providers/store-provider.registry';
import {
  CapacityHarness,
  resetCapacity,
  startCapacityHarness,
  stopCapacityHarness,
} from './helpers/capacity-harness';

const OTHER_WORKSPACE_ID = 'ws_discovery_check_other';
const STORE_APP_ID = '666000111';
const APP_POSITION = 7;
const KEYWORD_ROOM = PLAN_LIMITS.indie.keywordMarkets ?? 0;

const searchResults = Array.from({ length: 60 }, (_, index) => ({
  storeAppId: index + 1 === APP_POSITION ? STORE_APP_ID : `rival-${index}`,
  title: `Rival ${index}`,
}));

describe('keyword discovery check (e2e)', () => {
  jest.setTimeout(60_000);

  let harness: CapacityHarness;
  let appId: string;
  let keywordId: string;

  const today = () => new Date(`${utcDayOf(new Date())}T00:00:00.000Z`);

  const runCheck = () =>
    harness.app.get(StoreJobsHandler).handle({
      name: JOBS.DISCOVER_KEYWORD,
      id: 'discovery-check',
      queueName: QUEUES.APP_STORE,
      attemptsMade: 0,
      opts: { attempts: 3 },
      data: {
        appId,
        keywordId,
        workspaceId: DEFAULT_WORKSPACE_ID,
      } satisfies DiscoverKeywordPayload,
    } as Job);

  const capturedToday = () =>
    harness.prisma.serpEntry.count({ where: { keywordId, date: today() } });

  const discovery = () =>
    harness.prisma.keywordDiscovery.findUniqueOrThrow({
      where: { appId_keywordId: { appId, keywordId } },
    });

  const lapse = (data: Prisma.WorkspaceUpdateInput) =>
    harness.prisma.workspace.update({
      where: { id: DEFAULT_WORKSPACE_ID },
      data,
    });

  const egressCallsOf = async (run: () => Promise<void>) => {
    const through = jest.spyOn(harness.app.get(ProxyEgress), 'through');
    try {
      await run();
      return through.mock.calls.length;
    } finally {
      through.mockRestore();
    }
  };

  beforeAll(async () => {
    harness = await startCapacityHarness();
    const registry = harness.app.get(StoreProviderRegistry);
    const get = registry.get.bind(registry);
    jest.spyOn(registry, 'get').mockImplementation((store: Store) => ({
      ...get(store),
      search: () => Promise.resolve(searchResults),
    }));
    await harness.prisma.workspace.upsert({
      where: { id: OTHER_WORKSPACE_ID },
      update: {},
      create: { id: OTHER_WORKSPACE_ID, name: 'Other' },
    });
  }, 60_000);

  beforeEach(async () => {
    await resetCapacity(harness);
    appId = (
      await harness.prisma.app.create({
        data: {
          workspaceId: DEFAULT_WORKSPACE_ID,
          store: Store.APP_STORE,
          storeAppId: STORE_APP_ID,
          country: 'us',
          name: 'Discovery Fixture',
        },
      })
    ).id;
    keywordId = (
      await harness.prisma.keyword.create({
        data: { text: 'focus timer', store: Store.APP_STORE, country: 'us' },
      })
    ).id;
    await harness.prisma.keywordDiscovery.create({
      data: {
        appId,
        workspaceId: DEFAULT_WORKSPACE_ID,
        keywordId,
        source: 'reviews',
        relevance: 60,
      },
    });
  });

  afterAll(() => stopCapacityHarness(harness));

  it('records the position and stores the capture of a phrase nobody tracks', async () => {
    await runCheck();

    expect(await discovery()).toMatchObject({
      position: APP_POSITION,
      depth: 200,
      checkedOn: today(),
    });
    expect(await capturedToday()).toBe(50);
  });

  it('stores no capture of a phrase another workspace tracks', async () => {
    const other = await harness.prisma.app.create({
      data: {
        workspaceId: OTHER_WORKSPACE_ID,
        store: Store.APP_STORE,
        storeAppId: '666000999',
        country: 'us',
        name: 'Other Tracker',
      },
    });
    await harness.prisma.trackedKeyword.create({
      data: { appId: other.id, keywordId, source: 'MANUAL' },
    });

    await runCheck();

    expect(await capturedToday()).toBe(0);
    expect(await discovery()).toMatchObject({ position: APP_POSITION });
  });

  it('replaces the day of capture instead of doubling it', async () => {
    await runCheck();
    await runCheck();

    expect(await capturedToday()).toBe(50);
  });

  it.each<[string, Prisma.WorkspaceUpdateInput]>([
    ['the plan expired', { plan: 'free', planExpiresAt: null }],
    ['the workspace is suspended', { suspendedAt: new Date() }],
  ])(
    'stores nothing and holds no egress endpoint once %s',
    async (_, change) => {
      await lapse(change);

      expect(await egressCallsOf(runCheck)).toBe(0);
      expect(await capturedToday()).toBe(0);
      expect(await discovery()).toMatchObject({ checkedOn: null });
    },
  );

  it('tracks a ranked discovery with its position when auto track is on', async () => {
    await harness.prisma.app.update({
      where: { id: appId },
      data: { autoTrackRanked: true },
    });

    await runCheck();

    expect(
      await harness.prisma.trackedKeyword.findUniqueOrThrow({
        where: { appId_keywordId: { appId, keywordId } },
      }),
    ).toMatchObject({ source: 'SUGGESTED', active: true });
    expect(
      await harness.prisma.keywordRanking.findUniqueOrThrow({
        where: { appId_keywordId_date: { appId, keywordId, date: today() } },
      }),
    ).toMatchObject({ position: APP_POSITION, depth: 200 });
  });

  it('keeps a ranked discovery that does not fit the plan and still completes', async () => {
    await harness.prisma.app.update({
      where: { id: appId },
      data: { autoTrackRanked: true },
    });
    const filler = await harness.prisma.app.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store: Store.APP_STORE,
        storeAppId: '666000222',
        country: 'us',
        name: 'Filler',
      },
    });
    await harness.prisma.keyword.createMany({
      data: Array.from({ length: KEYWORD_ROOM }, (_, index) => ({
        text: `filler ${index}`,
        store: Store.APP_STORE,
        country: 'us',
      })),
    });
    const fillers = await harness.prisma.keyword.findMany({
      where: { text: { startsWith: 'filler ' } },
      select: { id: true },
    });
    await harness.prisma.trackedKeyword.createMany({
      data: fillers.map(({ id }) => ({
        appId: filler.id,
        keywordId: id,
        source: 'MANUAL' as const,
      })),
    });

    await expect(runCheck()).resolves.toBeUndefined();

    expect(
      await harness.prisma.trackedKeyword.count({ where: { appId } }),
    ).toBe(0);
    expect(await discovery()).toMatchObject({ position: APP_POSITION });
  });
});
