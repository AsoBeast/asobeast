import './helpers/enable-billing';
import { Store } from '@prisma/client';
import {
  APP_STORE_CHART_GENRES,
  ApiErrorEnvelope,
  ChartFollowItem,
  ChartPage,
  PLAN_LIMITS,
} from '@asobeast/shared';
import {
  CapacityHarness,
  OwnerAgent,
  resetCapacity,
  startCapacityHarness,
  stopCapacityHarness,
} from './helpers/capacity-harness';
import { clearRateLimitCounters } from './obliterate-queues';

const OTHER_WORKSPACE = 'ws_chart_follows_other';
const FOLLOW_LIMIT = PLAN_LIMITS.indie.chartFollows as number;
const KEY = {
  store: 'APP_STORE',
  country: 'us',
  collection: 'free',
  genre: '6014',
  device: 'iphone',
} as const;

describe('Chart follows (e2e)', () => {
  jest.setTimeout(45_000);

  let harness: CapacityHarness;
  let owner: OwnerAgent;

  const genres = APP_STORE_CHART_GENRES.map((genre) => genre.id);

  const follow = (
    genre: string = KEY.genre,
    collection: string = KEY.collection,
  ) => owner.post('/charts/follows').send({ ...KEY, genre, collection });

  const spendEveryUnit = async () => {
    for (const genre of genres.slice(0, FOLLOW_LIMIT)) {
      await follow(genre).expect(201);
    }
    await clearRateLimitCounters(harness.app);
  };

  beforeAll(async () => {
    harness = await startCapacityHarness();
    await harness.prisma.workspace.upsert({
      where: { id: OTHER_WORKSPACE },
      update: {},
      create: { id: OTHER_WORKSPACE, name: 'Other' },
    });
  }, 60_000);

  beforeEach(async () => {
    await harness.prisma.chartFollow.deleteMany({});
    owner = await resetCapacity(harness);
  });

  afterAll(async () => {
    await harness.prisma.workspace.deleteMany({
      where: { id: OTHER_WORKSPACE },
    });
    await stopCapacityHarness(harness);
  });

  it('follows a chart', async () => {
    const response = await follow().expect(201);

    const item = response.body as ChartFollowItem;
    expect(Object.keys(item).sort()).toEqual([
      'collection',
      'country',
      'createdAt',
      'device',
      'genre',
      'genreName',
      'id',
      'store',
    ]);
    expect(item).toMatchObject({ ...KEY, genreName: 'Games' });
    expect(Date.parse(item.createdAt)).not.toBeNaN();
  });

  it('answers an existing follow with 200 and the same id', async () => {
    const first = (await follow().expect(201)).body as ChartFollowItem;

    const second = (await follow().expect(200)).body as ChartFollowItem;

    expect(second.id).toBe(first.id);
    await expect(harness.prisma.chartFollow.count()).resolves.toBe(1);
  });

  it("lists the workspace's follows newest first", async () => {
    await follow('6014').expect(201);
    await follow('6007').expect(201);

    const response = await owner.get('/charts/follows').expect(200);

    expect(
      (response.body as ChartFollowItem[]).map((item) => item.genre),
    ).toEqual(['6007', '6014']);
  });

  it('forgets a follow', async () => {
    const { id } = (await follow().expect(201)).body as ChartFollowItem;

    await owner.delete(`/charts/follows/${id}`).expect(204);

    await expect(
      owner.get('/charts/follows').expect(200),
    ).resolves.toMatchObject({ body: [] });
    await owner.delete(`/charts/follows/${id}`).expect(404);
  });

  it.each([
    ['genre', { genre: '9999' }],
    ['device', { device: 'ipad' }],
    ['country', { country: 'zz' }],
  ])('refuses a bad %s', async (_field, override) => {
    await owner
      .post('/charts/follows')
      .send({ ...KEY, ...override })
      .expect(400);

    await expect(harness.prisma.chartFollow.count()).resolves.toBe(0);
  });

  it("refuses past the plan's room", async () => {
    await spendEveryUnit();

    const refused = await follow(genres[FOLLOW_LIMIT]).expect(403);

    expect((refused.body as ApiErrorEnvelope).quota).toMatchObject({
      resource: 'chartFollows',
      limit: FOLLOW_LIMIT,
      used: FOLLOW_LIMIT,
    });
    await expect(harness.prisma.chartFollow.count()).resolves.toBe(
      FOLLOW_LIMIT,
    );
  });

  it('admits the other kinds of a followed category at the limit', async () => {
    await spendEveryUnit();

    await follow(genres[0], 'paid').expect(201);
    await follow(genres[0], 'grossing').expect(201);

    await expect(harness.prisma.chartFollow.count()).resolves.toBe(
      FOLLOW_LIMIT + 2,
    );
  });

  it('refuses a new category once every unit is spent, whatever its kind', async () => {
    await spendEveryUnit();
    await follow(genres[0], 'paid').expect(201);
    await follow(genres[0], 'grossing').expect(201);

    const refused = await follow(genres[FOLLOW_LIMIT], 'grossing').expect(403);

    expect((refused.body as ApiErrorEnvelope).quota).toMatchObject({
      resource: 'chartFollows',
      limit: FOLLOW_LIMIT,
      used: FOLLOW_LIMIT,
    });
  });

  it("never shows another workspace's follows", async () => {
    const theirs = await harness.prisma.chartFollow.create({
      data: { ...KEY, store: Store.APP_STORE, workspaceId: OTHER_WORKSPACE },
    });

    const listed = await owner.get('/charts/follows').expect(200);
    const page = await owner.get('/charts').query(KEY).expect(200);

    expect(listed.body).toEqual([]);
    expect((page.body as ChartPage).followed).toBeNull();
    await owner.delete(`/charts/follows/${theirs.id}`).expect(404);
    await expect(
      harness.prisma.chartFollow.count({ where: { id: theirs.id } }),
    ).resolves.toBe(1);
  });

  it('says when the workspace follows the chart', async () => {
    const { id } = (await follow().expect(201)).body as ChartFollowItem;

    const page = await owner.get('/charts').query(KEY).expect(200);

    expect((page.body as ChartPage).followed).toMatchObject({ id, ...KEY });
  });
});
