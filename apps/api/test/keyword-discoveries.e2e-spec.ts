import './helpers/enable-billing';
import { Prisma, Store } from '@prisma/client';
import { KeywordDiscoveryList, utcDayOf } from '@asobeast/shared';
import request from 'supertest';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import { WorkspaceContext } from '../src/common/tenancy/workspace-context';
import { KeywordDiscoveryPlanner } from '../src/keyword-discovery/discovery-planner.service';
import { seedApiToken } from './helpers/api-tokens';
import {
  CapacityHarness,
  OwnerAgent,
  resetCapacity,
  startCapacityHarness,
  stopCapacityHarness,
} from './helpers/capacity-harness';

const STORE_APP_ID = '646000111';

describe('keyword discoveries list (e2e)', () => {
  jest.setTimeout(45_000);

  let harness: CapacityHarness;
  let owner: OwnerAgent;
  let appId: string;
  const ids: Record<string, string> = {};

  const today = () => new Date(`${utcDayOf(new Date())}T00:00:00.000Z`);

  const list = (query = '') =>
    owner.get(`/apps/${appId}/keyword-discoveries${query}`);

  const listed = async (query = ''): Promise<KeywordDiscoveryList> =>
    (await list(query).expect(200)).body as KeywordDiscoveryList;

  const seedDiscovery = async (
    text: string,
    observation: Partial<Prisma.KeywordDiscoveryUncheckedCreateInput> = {},
    country = 'us',
  ) => {
    const keyword = await harness.prisma.keyword.create({
      data: { text, store: Store.APP_STORE, country },
    });
    ids[text] = keyword.id;
    await harness.prisma.keywordDiscovery.create({
      data: {
        appId,
        workspaceId: DEFAULT_WORKSPACE_ID,
        keywordId: keyword.id,
        source: 'title',
        relevance: 70,
        ...observation,
      },
    });
    return keyword.id;
  };

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
          storeAppId: STORE_APP_ID,
          country: 'us',
          name: 'Discoveries Fixture',
        },
      })
    ).id;
    await seedDiscovery('focus timer app', {
      position: 3,
      depth: 50,
      checkedOn: today(),
      relevance: 90,
    });
    await seedDiscovery('deep work', {
      position: 120,
      depth: 200,
      checkedOn: today(),
      relevance: 80,
    });
    const scored = await seedDiscovery('study timer', { relevance: 75 });
    await harness.prisma.keywordMetric.create({
      data: { keywordId: scored, date: today(), traffic: 6, difficulty: 5 },
    });
    await seedDiscovery('concentration', { relevance: 60 });
    await seedDiscovery('pomodoro', { dismissedAt: new Date() });
    const tracked = await seedDiscovery('work sprint', { relevance: 95 });
    await harness.prisma.trackedKeyword.create({
      data: { appId, keywordId: tracked, source: 'MANUAL' },
    });
    await seedDiscovery('lernzeit', { relevance: 50 }, 'de');
  });

  afterAll(() => stopCapacityHarness(harness));

  it('lists the open rows in order with their states and counts', async () => {
    const body = await listed();

    expect(body.items.map(({ text }) => text)).toEqual([
      'focus timer app',
      'deep work',
      'study timer',
      'concentration',
      'lernzeit',
    ]);
    expect(body.counts).toEqual({ all: 5, ranked: 2, opportunity: 1 });
    expect(body.items.map(({ state }) => state)).toEqual([
      'ranked',
      'ranked',
      'opportunity',
      'open',
      'open',
    ]);
    expect(body.items.every(({ recommended }) => recommended)).toBe(true);
    expect(body.items[2]).toMatchObject({
      traffic: 6,
      difficulty: 5,
      opportunity: 50,
    });
    expect(body).toMatchObject({ autoTrackRanked: false, unfit: 0 });
  });

  it('filters by state without changing the counts', async () => {
    const body = await listed('?state=ranked');

    expect(body.items.map(({ text }) => text)).toEqual([
      'focus timer app',
      'deep work',
    ]);
    expect(body.counts.all).toBe(5);
  });

  it('scopes items and counts to one market', async () => {
    const body = await listed('?country=de');

    expect(body.items.map(({ text }) => text)).toEqual(['lernzeit']);
    expect(body.counts).toEqual({ all: 1, ranked: 0, opportunity: 0 });
  });

  it.each(['?state=nope', '?country=USA', '?limit=0', '?limit=501'])(
    'refuses %s',
    async (query) => {
      const refused = await list(query).expect(400);
      expect(refused.body).toMatchObject({ statusCode: 400 });
    },
  );

  it('lists a keyword again once the app stops tracking it', async () => {
    await owner
      .delete(`/apps/${appId}/keywords/${ids['work sprint']}`)
      .expect(204);

    const body = await listed();

    expect(body.items[0]?.text).toBe('work sprint');
  });

  it('reports the checks a planner run queued', async () => {
    const queued = await harness.app
      .get(WorkspaceContext)
      .run(DEFAULT_WORKSPACE_ID, () =>
        harness.app.get(KeywordDiscoveryPlanner).plan(appId),
      );

    const { checks } = await listed();

    expect(queued.queued).toBeGreaterThan(0);
    expect(checks).toMatchObject({
      perWeek: 40,
      usedThisWeek: queued.queued,
      pending: queued.queued,
      checkedAt: utcDayOf(new Date()),
    });
    expect(new Date(checks.nextRunAt ?? '').getUTCDay()).toBe(1);
  });

  it('answers 404 for an unknown app and 400 for a competitor', async () => {
    await owner.get('/apps/no-such-app/keyword-discoveries').expect(404);
    const competitor = await harness.prisma.app.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store: Store.APP_STORE,
        storeAppId: '646000999',
        country: 'us',
        isCompetitor: true,
        primaryAppId: appId,
      },
    });
    await owner.get(`/apps/${competitor.id}/keyword-discoveries`).expect(400);
  });

  it('answers a read scoped token', async () => {
    const token = await seedApiToken(harness.prisma, {
      seed: 'discoveryreader',
      email: 'discovery-reader@example.com',
      workspaceId: DEFAULT_WORKSPACE_ID,
      role: 'member',
      scope: 'read',
    });
    await request(harness.app.getHttpServer())
      .get(`/apps/${appId}/keyword-discoveries`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
  });

  it('still reads once the plan expired', async () => {
    await harness.prisma.workspace.update({
      where: { id: DEFAULT_WORKSPACE_ID },
      data: { plan: 'free', planExpiresAt: null, trialEndsAt: null },
    });

    await list().expect(200);
  });
});
