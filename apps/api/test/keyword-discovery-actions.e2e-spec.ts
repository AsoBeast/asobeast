import './helpers/enable-billing';
import { getQueueToken } from '@nestjs/bullmq';
import { Prisma, Store } from '@prisma/client';
import { Queue } from 'bullmq';
import { KeywordDiscoveryList, PLAN_LIMITS, utcDayOf } from '@asobeast/shared';
import request from 'supertest';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import { JOBS, QUEUES } from '../src/jobs/jobs.types';
import { seedApiToken } from './helpers/api-tokens';
import {
  CapacityHarness,
  OwnerAgent,
  resetCapacity,
  startCapacityHarness,
  stopCapacityHarness,
} from './helpers/capacity-harness';

const STORE_APP_ID = '656000111';
const KEYWORD_ROOM = PLAN_LIMITS.indie.keywordMarkets ?? 0;

describe('keyword discovery actions (e2e)', () => {
  jest.setTimeout(60_000);

  let harness: CapacityHarness;
  let owner: OwnerAgent;
  let appId: string;
  const ids: Record<string, string> = {};

  const route = (action: string, id = appId) =>
    `/apps/${id}/keyword-discoveries/${action}`;

  const yesterday = () =>
    new Date(Date.parse(`${utcDayOf(new Date())}T00:00:00.000Z`) - 86_400_000);

  const seedDiscovery = async (
    text: string,
    observation: Partial<Prisma.KeywordDiscoveryUncheckedCreateInput> = {},
  ) => {
    const keyword = await harness.prisma.keyword.create({
      data: { text, store: Store.APP_STORE, country: 'us' },
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
  };

  const listed = async (): Promise<KeywordDiscoveryList> =>
    (await owner.get(`/apps/${appId}/keyword-discoveries`).expect(200))
      .body as KeywordDiscoveryList;

  const listedTexts = async () =>
    (await listed()).items.map(({ text }) => text).sort();

  const trackedOf = (keywordId: string) =>
    harness.prisma.trackedKeyword.findUnique({
      where: { appId_keywordId: { appId, keywordId } },
    });

  const fillRoom = async (left: number) => {
    const filler = await harness.prisma.app.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store: Store.APP_STORE,
        storeAppId: '656000222',
        country: 'us',
        name: 'Filler',
      },
    });
    await harness.prisma.keyword.createMany({
      data: Array.from({ length: KEYWORD_ROOM - left }, (_, index) => ({
        text: `filler ${index}`,
        store: Store.APP_STORE,
        country: 'gb',
      })),
    });
    const fillers = await harness.prisma.keyword.findMany({
      where: { country: 'gb' },
      select: { id: true },
    });
    await harness.prisma.trackedKeyword.createMany({
      data: fillers.map(({ id }) => ({
        appId: filler.id,
        keywordId: id,
        source: 'MANUAL' as const,
      })),
    });
    return filler.id;
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
          name: 'Actions Fixture',
        },
      })
    ).id;
    await seedDiscovery('focus timer', {
      source: 'reviews',
      position: 4,
      depth: 50,
      checkedOn: yesterday(),
      relevance: 90,
    });
    await seedDiscovery('deep work', { source: 'competitors', relevance: 80 });
    await seedDiscovery('study timer', { source: 'popularity', relevance: 75 });
    await seedDiscovery('time blocking', {
      source: 'subtitle',
      position: 30,
      depth: 200,
      checkedOn: yesterday(),
      relevance: 60,
    });
  });

  afterAll(() => stopCapacityHarness(harness));

  it('tracks by ids with the mapped source, the known position and the queued follow ups', async () => {
    const answer = await owner
      .post(route('track'))
      .send({ keywordIds: [ids['focus timer'], ids['deep work']] })
      .expect(200);

    expect(answer.body).toEqual({ tracked: 2, skipped: 0 });
    expect(await trackedOf(ids['focus timer'])).toMatchObject({
      source: 'SUGGESTED',
      active: true,
    });
    expect(await trackedOf(ids['deep work'])).toMatchObject({
      source: 'COMPETITOR',
    });
    expect(
      await harness.prisma.keywordRanking.findUnique({
        where: {
          appId_keywordId_date: {
            appId,
            keywordId: ids['focus timer'],
            date: yesterday(),
          },
        },
      }),
    ).toMatchObject({ position: 4, depth: 50 });
    expect(
      await harness.prisma.keywordRanking.count({
        where: { keywordId: ids['deep work'] },
      }),
    ).toBe(0);
    const checks = await harness.app
      .get<Queue>(getQueueToken(QUEUES.APP_STORE), { strict: false })
      .getJobs(['paused', 'wait', 'waiting-children', 'prioritized']);
    const checked = checks
      .filter(({ name }) => name === JOBS.CHECK_KEYWORD)
      .map(({ data }) => (data as { keywordId: string }).keywordId);
    const scored = checks
      .filter(({ name }) => name === JOBS.SCORE_KEYWORD)
      .map(({ data }) => (data as { keywordId: string }).keywordId);
    expect(checked).toEqual([ids['deep work']]);
    expect(scored.sort()).toEqual(
      [ids['focus timer'], ids['deep work']].sort(),
    );
    expect(await listedTexts()).toEqual(['study timer', 'time blocking']);
  });

  it('tracks every ranked discovery and returns it to the list once untracked', async () => {
    await owner.post(route('track')).send({ allRanked: true }).expect(200);

    expect(await trackedOf(ids['time blocking'])).toMatchObject({
      source: 'SUBTITLE',
    });
    expect(await listedTexts()).toEqual(['deep work', 'study timer']);

    await owner
      .delete(`/apps/${appId}/keywords/${ids['time blocking']}`)
      .expect(204);

    expect(await listedTexts()).toEqual([
      'deep work',
      'study timer',
      'time blocking',
    ]);
  });

  it('keeps what does not fit the keyword room as a discovery', async () => {
    await fillRoom(1);

    const answer = await owner
      .post(route('track'))
      .send({
        keywordIds: [ids['focus timer'], ids['deep work'], ids['study timer']],
      })
      .expect(200);

    expect(answer.body).toEqual({ tracked: 1, skipped: 2 });
    expect(await listedTexts()).toEqual([
      'deep work',
      'study timer',
      'time blocking',
    ]);
  });

  it('reports the ranked rows that did not fit while auto track is on', async () => {
    await fillRoom(0);

    const settings = await owner
      .patch(route('settings'))
      .send({ autoTrackRanked: true })
      .expect(200);

    expect(settings.body).toEqual({
      autoTrackRanked: true,
      tracked: 0,
      skipped: 2,
    });
    expect(await listed()).toMatchObject({ autoTrackRanked: true, unfit: 2 });

    await owner
      .patch(route('settings'))
      .send({ autoTrackRanked: false })
      .expect(200);
    expect((await listed()).unfit).toBe(0);
  });

  it('reports no unfit row for a ranked discovery untracked while the plan has room', async () => {
    await owner
      .patch(route('settings'))
      .send({ autoTrackRanked: true })
      .expect(200);
    expect(await trackedOf(ids['time blocking'])).not.toBeNull();

    await owner
      .delete(`/apps/${appId}/keywords/${ids['time blocking']}`)
      .expect(204);

    const after = await listed();
    expect(after.counts.ranked).toBe(1);
    expect(after).toMatchObject({ autoTrackRanked: true, unfit: 0 });
  });

  it('opens no keyword market for a phrase another app already tracks', async () => {
    const filler = await fillRoom(0);
    await harness.prisma.trackedKeyword.create({
      data: { appId: filler, keywordId: ids['deep work'], source: 'MANUAL' },
    });

    const answer = await owner
      .post(route('track'))
      .send({ keywordIds: [ids['deep work']] })
      .expect(200);

    expect(answer.body).toEqual({ tracked: 1, skipped: 0 });
  });

  it('dismisses for good and counts a dismiss once', async () => {
    const first = await owner
      .post(route('dismiss'))
      .send({ keywordIds: [ids['deep work'], ids['study timer']] })
      .expect(200);
    expect(first.body).toEqual({ dismissed: 2 });

    const second = await owner
      .post(route('dismiss'))
      .send({ keywordIds: [ids['deep work']] })
      .expect(200);
    expect(second.body).toEqual({ dismissed: 0 });

    await owner.post(route('refresh')).expect(202);
    expect(await listedTexts()).toEqual(['focus timer', 'time blocking']);
    expect(
      await harness.prisma.keywordDiscovery.count({
        where: { appId, dismissedAt: { not: null } },
      }),
    ).toBe(2);
  });

  it('tracks every ranked discovery at once when auto track is switched on', async () => {
    const answer = await owner
      .patch(route('settings'))
      .send({ autoTrackRanked: true })
      .expect(200);

    expect(answer.body).toEqual({
      autoTrackRanked: true,
      tracked: 2,
      skipped: 0,
    });
    expect(await listedTexts()).toEqual(['deep work', 'study timer']);
  });

  it.each<[string, string, object]>([
    ['track', 'track', {}],
    ['track', 'track', { allRanked: false }],
    ['track', 'track', { keywordIds: [] }],
    ['track', 'track', { keywordIds: [7] }],
    ['track', 'track', { keywordIds: ['x'.repeat(65)] }],
    ['track', 'track', { allRanked: true, country: 'USA' }],
    [
      'track',
      'track',
      { keywordIds: Array.from({ length: 201 }, (_, i) => `k${i}`) },
    ],
    ['dismiss', 'dismiss', {}],
    ['dismiss', 'dismiss', { keywordIds: [] }],
    ['settings', 'settings', { autoTrackRanked: 'yes' }],
  ])('refuses a malformed %s body %#', async (_, action, body) => {
    const send =
      action === 'settings'
        ? owner.patch(route(action))
        : owner.post(route(action));
    await send.send(body).expect(400);
  });

  it.each<[string, 'post' | 'patch', object]>([
    ['track', 'post', { allRanked: true }],
    ['dismiss', 'post', { keywordIds: ['k1'] }],
    ['refresh', 'post', {}],
    ['settings', 'patch', { autoTrackRanked: true }],
  ])(
    'answers 404 for an unknown app and 400 for a competitor on %s',
    async (action, method, body) => {
      await owner[method](route(action, 'no-such-app')).send(body).expect(404);
      const competitor = await harness.prisma.app.create({
        data: {
          workspaceId: DEFAULT_WORKSPACE_ID,
          store: Store.APP_STORE,
          storeAppId: `656000${action.length}9`,
          country: 'us',
          isCompetitor: true,
          primaryAppId: appId,
        },
      });
      await owner[method](route(action, competitor.id)).send(body).expect(400);
    },
  );

  it.each<[string, 'post' | 'patch', object]>([
    ['track', 'post', { allRanked: true }],
    ['dismiss', 'post', { keywordIds: ['k1'] }],
    ['refresh', 'post', {}],
    ['settings', 'patch', { autoTrackRanked: false }],
  ])(
    'refuses %s to a read token and serves a write token',
    async (action, method, body) => {
      const reader = await seedApiToken(harness.prisma, {
        seed: 'discoveryread',
        email: 'discovery-read@example.com',
        workspaceId: DEFAULT_WORKSPACE_ID,
        role: 'member',
        scope: 'read',
      });
      const writer = await seedApiToken(harness.prisma, {
        seed: 'discoverywrite',
        email: 'discovery-write@example.com',
        workspaceId: DEFAULT_WORKSPACE_ID,
        role: 'member',
        scope: 'write',
      });
      const server = harness.app.getHttpServer();
      await request(server)
        [method](route(action))
        .set('Authorization', `Bearer ${reader}`)
        .send(body)
        .expect(403);
      const served = await request(server)
        [method](route(action))
        .set('Authorization', `Bearer ${writer}`)
        .send(body);
      expect(served.status).toBeLessThan(300);
    },
  );

  it.each<[string, 'post' | 'patch', object]>([
    ['track', 'post', { allRanked: true }],
    ['dismiss', 'post', { keywordIds: ['k1'] }],
    ['refresh', 'post', {}],
    ['settings', 'patch', { autoTrackRanked: true }],
  ])(
    'answers 402 to %s once the plan expired',
    async (action, method, body) => {
      await harness.prisma.workspace.update({
        where: { id: DEFAULT_WORKSPACE_ID },
        data: { plan: 'free', planExpiresAt: null, trialEndsAt: null },
      });

      await owner[method](route(action)).send(body).expect(402);
    },
  );
});
