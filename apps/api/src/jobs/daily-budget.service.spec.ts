import { ConfigService } from '@nestjs/config';
import { Store } from '@prisma/client';
import { PLAN_LIMITS } from '@asobeast/shared';
import { QuotaService } from '../auth/quota.service';
import {
  CategoryBucket,
  CategoryRanksService,
} from '../category-ranks/category-ranks.service';
import { Env } from '../config/env';
import { DailyBudgetService } from './daily-budget.service';
import { DailyCapacity } from './daily-capacity.service';
import { DailyTargets, DailyTargetsCollector } from './daily-targets.service';
import { OverLimitRegistry } from './over-limit.registry';

const NOW = new Date('2026-07-27T23:59:59.000Z');

const targetsOf = (over: Partial<DailyTargets> = {}): DailyTargets => ({
  apps: [
    { id: 'apple', store: Store.APP_STORE },
    { id: 'gplay', store: Store.GOOGLE_PLAY },
  ],
  keywords: [
    { keywordId: 'apple-keyword', store: Store.APP_STORE },
    { keywordId: 'gplay-keyword', store: Store.GOOGLE_PLAY },
  ],
  reviewApps: [{ id: 'apple', store: Store.APP_STORE }],
  ...over,
});

const BUCKETS: CategoryBucket[] = [
  { collection: 'free', genre: '6007', country: 'us', store: 'APP_STORE' },
  {
    collection: 'grossing',
    genre: 'overall',
    country: 'us',
    store: 'GOOGLE_PLAY',
  },
];

describe('DailyBudgetService', () => {
  const collect = jest.fn<Promise<DailyTargets>, []>();
  const buckets = jest.fn<Promise<CategoryBucket[]>, []>();
  const perDay = jest.fn<Promise<number>, [Store]>();

  const build = (quota: Partial<QuotaService> = { enforced: false }) =>
    new DailyBudgetService(
      { collect } as unknown as DailyTargetsCollector,
      { buckets } as unknown as CategoryRanksService,
      { perDay } as unknown as DailyCapacity,
      quota as unknown as QuotaService,
      {
        state: jest.fn().mockResolvedValue({ since: null, notifiedAt: null }),
      } as unknown as OverLimitRegistry,
      { get: () => '0 3 * * *' } as unknown as ConfigService<Env, true>,
    );

  beforeAll(() => {
    jest
      .useFakeTimers({ doNotFake: ['nextTick', 'queueMicrotask'] })
      .setSystemTime(NOW);
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  beforeEach(() => {
    collect.mockReset().mockResolvedValue(targetsOf());
    buckets.mockReset().mockResolvedValue(BUCKETS);
    perDay
      .mockReset()
      .mockImplementation((store) =>
        Promise.resolve((store === Store.GOOGLE_PLAY ? 10 : 15) * 60 * 24),
      );
  });

  it('counts the target jobs by store and charges them in store requests', async () => {
    const budget = await build().estimate();

    expect(budget).toMatchObject({
      apps: 2,
      keywords: 2,
      categories: 2,
      reviews: 1,
      total: 21,
      capacityPerDay: 25 * 60 * 24,
    });
    expect(budget.stores).toEqual([
      expect.objectContaining({ store: 'APP_STORE', total: 4 }),
      expect.objectContaining({ store: 'GOOGLE_PLAY', total: 17 }),
    ]);
  });

  it('charges a play search the requests it fans out to, not one', async () => {
    collect.mockResolvedValue({
      apps: [],
      keywords: [{ keywordId: 'gplay-keyword', store: Store.GOOGLE_PLAY }],
      reviewApps: [],
    });
    buckets.mockResolvedValue([]);

    const budget = await build().estimate();

    expect(budget).toMatchObject({ keywords: 1, total: 8 });
  });

  it('projects completion from the next scheduled run', async () => {
    const budget = await build().estimate();

    expect(budget.completion.startsAt).toBe('2026-07-28T03:00:00.000Z');
    expect(budget.completion.hours).toBe(0.03);
    expect(budget.completion.completesAt).toBe('2026-07-28T03:01:48.000Z');
  });

  it('projects completion from the store that finishes last', async () => {
    collect.mockResolvedValue({
      apps: [],
      keywords: [{ keywordId: 'gplay-keyword', store: Store.GOOGLE_PLAY }],
      reviewApps: [],
    });
    buckets.mockResolvedValue([]);
    perDay.mockImplementation((store) =>
      Promise.resolve(store === Store.GOOGLE_PLAY ? 24 : 240_000),
    );

    const budget = await build().estimate();

    expect(budget.completion.hours).toBe(8);
  });

  it('never averages a saturated store away against an idle one', async () => {
    collect.mockResolvedValue({
      apps: [],
      keywords: [
        { keywordId: 'gplay-keyword', store: Store.GOOGLE_PLAY },
        { keywordId: 'apple-keyword', store: Store.APP_STORE },
      ],
      reviewApps: [],
    });
    buckets.mockResolvedValue([]);
    perDay.mockImplementation((store) =>
      Promise.resolve(store === Store.GOOGLE_PLAY ? 24 : 240_000),
    );

    const budget = await build().estimate();
    const combined = (8 + 1) / ((24 + 240_000) / 24);

    expect(budget.completion.hours).toBe(8);
    expect(budget.completion.hours).toBeGreaterThan(combined);
  });

  it('still projects completion when an idle store has no capacity', async () => {
    collect.mockResolvedValue({
      apps: [{ id: 'apple', store: Store.APP_STORE }],
      keywords: [{ keywordId: 'apple-keyword', store: Store.APP_STORE }],
      reviewApps: [],
    });
    buckets.mockResolvedValue([]);
    perDay.mockImplementation((store) =>
      Promise.resolve(store === Store.GOOGLE_PLAY ? 0 : 48),
    );

    const budget = await build().estimate();

    expect(budget.stores).toEqual([
      expect.objectContaining({ store: 'APP_STORE', total: 2 }),
      expect.objectContaining({ store: 'GOOGLE_PLAY', total: 0 }),
    ]);
    expect(budget.completion.hours).toBe(1);
  });

  it('reports an unknown completion when either store has no capacity', async () => {
    perDay.mockImplementation((store) =>
      Promise.resolve(store === Store.GOOGLE_PLAY ? 0 : 240_000),
    );

    const budget = await build().estimate();

    expect(budget.completion.hours).toBeNull();
  });

  it('omits plan usage on a self hosted instance', async () => {
    await expect(build().estimate()).resolves.toMatchObject({ quota: null });
  });

  it('reports plan usage once billing is enabled', async () => {
    const budget = await build({
      enforced: true,
      usage: jest.fn().mockResolvedValue({
        plan: 'indie',
        limits: PLAN_LIMITS.indie,
        apps: 2,
        keywordMarkets: 2,
      }),
    }).estimate();

    expect(budget.quota).toEqual({
      plan: 'indie',
      apps: { used: 2, limit: PLAN_LIMITS.indie.apps },
      keywordMarkets: {
        used: 2,
        limit: PLAN_LIMITS.indie.keywordMarkets,
      },
      overLimitSince: null,
    });
  });

  it('reports no utilization when there is no capacity', async () => {
    perDay.mockResolvedValue(0);

    const budget = await build().estimate();

    expect(budget.utilization).toBe(0);
    expect(budget.completion.hours).toBeNull();
  });
});
