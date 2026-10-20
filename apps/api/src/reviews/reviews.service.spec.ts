import { ConfigService } from '@nestjs/config';
import { Store } from '@prisma/client';
import { AlertPayload, ReviewNegativePayload } from '@asobeast/shared';
import { AlertsDispatcher } from '../alerts/alerts.dispatcher';
import { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { ImplausibleResultError } from '../store-providers/errors';
import { StoreProviderRegistry } from '../store-providers/store-provider.registry';
import { ReviewResult } from '../store-providers/types';
import { EMPTY_ANSWER_RETRIES } from '../store-providers/result-plausibility';
import { ReviewsService } from './reviews.service';

const DAY_MS = 24 * 60 * 60 * 1000;
const daysAgo = (days: number) => new Date(Date.now() - days * DAY_MS);

const makeReview = (reviewId: string, score = 5): ReviewResult => ({
  reviewId,
  userName: 'User',
  score,
  title: 'Title',
  text: 'Body',
  version: '1.0.0',
  updatedAt: new Date('2026-07-01T00:00:00Z'),
});

const buildDeps = (options: {
  pages: ReviewResult[][];
  existing: string[];
  scoreMax?: number;
  storedAlready?: boolean;
  storedReviewedAt?: Date | null;
  store?: Store;
  stored?: Record<string, { repliedAt: Date | null; replyText: string | null }>;
}) => {
  const storedReviewedAt =
    options.storedReviewedAt === undefined
      ? daysAgo(1)
      : options.storedReviewedAt;
  const reviews = jest.fn().mockResolvedValue([]);
  options.pages.forEach((page) => reviews.mockResolvedValueOnce(page));
  const createMany = jest
    .fn<Promise<{ count: number }>, [{ data: Record<string, unknown>[] }]>()
    .mockResolvedValue({ count: 0 });
  const updateMany = jest
    .fn<
      Promise<{ count: number }>,
      [{ where: Record<string, unknown>; data: Record<string, unknown> }]
    >()
    .mockResolvedValue({ count: 0 });
  const prisma = {
    app: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'app1',
        name: 'Mine',
        store: options.store ?? Store.APP_STORE,
        storeAppId: '123',
        country: 'us',
      }),
    },
    review: {
      findMany: jest.fn().mockResolvedValue(
        options.existing.map((reviewId) => ({
          reviewId,
          repliedAt: options.stored?.[reviewId]?.repliedAt ?? null,
          replyText: options.stored?.[reviewId]?.replyText ?? null,
        })),
      ),
      findFirst: jest.fn((args: { where: { reviewedAt?: unknown } }) => {
        if (!options.storedAlready) return Promise.resolve(null);
        if (args.where.reviewedAt !== undefined && storedReviewedAt === null) {
          return Promise.resolve(null);
        }
        return Promise.resolve({ id: 'r1', reviewedAt: storedReviewedAt });
      }),
      createMany,
      updateMany,
    },
  };
  const registry = { get: () => ({ reviews }) };
  const config = { get: jest.fn().mockReturnValue(options.scoreMax ?? 2) };
  const dispatch = jest
    .fn<Promise<void>, [AlertPayload]>()
    .mockResolvedValue(undefined);
  const alerts = { dispatch };
  const service = new ReviewsService(
    prisma as unknown as PrismaService,
    registry as unknown as StoreProviderRegistry,
    config as unknown as ConfigService<Env, true>,
    alerts as unknown as AlertsDispatcher,
  );
  return { service, reviews, createMany, updateMany, dispatch };
};

describe('ReviewsService.syncReviews', () => {
  it('fetches every requested page in order', async () => {
    const { service, reviews } = buildDeps({
      pages: [[makeReview('a')], [makeReview('b')]],
      existing: [],
    });

    await service.syncReviews({ appId: 'app1', pages: 2, backfill: true });

    expect(reviews).toHaveBeenNthCalledWith(1, '123', 'us', 1);
    expect(reviews).toHaveBeenNthCalledWith(2, '123', 'us', 2);
  });

  it('inserts and returns only reviews not already stored', async () => {
    const { service, createMany } = buildDeps({
      pages: [[makeReview('a'), makeReview('b')]],
      existing: ['a'],
    });

    const inserted = await service.syncReviews({
      appId: 'app1',
      pages: 1,
      backfill: false,
    });

    expect(inserted.map((review) => review.reviewId)).toEqual(['b']);
    expect(createMany).toHaveBeenCalledTimes(1);
    const data = createMany.mock.calls[0][0].data;
    expect(data.map((row) => row.reviewId)).toEqual(['b']);
  });

  it('stores a rating only review with its empty text', async () => {
    const ratingOnly = { ...makeReview('a', 5), text: '' };
    const { service, createMany } = buildDeps({
      pages: [[ratingOnly, makeReview('b')]],
      existing: [],
    });

    await service.syncReviews({ appId: 'app1', pages: 1, backfill: true });

    const data = createMany.mock.calls[0][0].data;
    expect(data.map((row) => [row.reviewId, row.text])).toEqual([
      ['a', ''],
      ['b', 'Body'],
    ]);
  });

  it('deduplicates the same review across pages', async () => {
    const { service, createMany } = buildDeps({
      pages: [[makeReview('a')], [makeReview('a'), makeReview('c')]],
      existing: [],
    });

    const inserted = await service.syncReviews({
      appId: 'app1',
      pages: 2,
      backfill: true,
    });

    expect(inserted.map((review) => review.reviewId)).toEqual(['a', 'c']);
    const data = createMany.mock.calls[0][0].data;
    expect(data.map((row) => row.reviewId)).toEqual(['a', 'c']);
  });

  it('skips the insert when every review already exists', async () => {
    const { service, createMany } = buildDeps({
      pages: [[makeReview('a')]],
      existing: ['a'],
    });

    const inserted = await service.syncReviews({
      appId: 'app1',
      pages: 1,
      backfill: false,
    });

    expect(inserted).toEqual([]);
    expect(createMany).not.toHaveBeenCalled();
  });

  it('records reply state on new and already stored Google Play reviews it fetched', async () => {
    const replied = new Date('2026-09-02T08:00:00.000Z');
    const { service, createMany, updateMany } = buildDeps({
      store: Store.GOOGLE_PLAY,
      pages: [
        [
          makeReview('new'),
          { ...makeReview('known-now-replied'), repliedAt: replied },
        ],
      ],
      existing: ['known-now-replied'],
    });

    await service.syncReviews({ appId: 'app1', pages: 1, backfill: true });

    const [row] = createMany.mock.calls[0][0].data;
    expect(row).toMatchObject({ reviewId: 'new', repliedAt: null });
    expect(row.replyCheckedAt).toBeInstanceOf(Date);
    const [firstUpdate] = updateMany.mock.calls[0];
    expect(firstUpdate.where).toEqual({
      appId: 'app1',
      reviewId: { in: ['known-now-replied'] },
    });
    expect(firstUpdate.data.replyCheckedAt).toBeInstanceOf(Date);
    expect(updateMany).toHaveBeenNthCalledWith(2, {
      where: { appId: 'app1', reviewId: 'known-now-replied' },
      data: { repliedAt: replied },
    });
  });

  it('stores the reply text of a new google play review', async () => {
    const { service, createMany } = buildDeps({
      store: Store.GOOGLE_PLAY,
      pages: [
        [
          {
            ...makeReview('new'),
            repliedAt: new Date('2026-09-02T08:00:00.000Z'),
            replyText: 'Thanks, fixed in 2.1',
          },
        ],
      ],
      existing: [],
    });

    await service.syncReviews({ appId: 'app1', pages: 1, backfill: true });

    expect(createMany.mock.calls[0][0].data[0]).toMatchObject({
      replyText: 'Thanks, fixed in 2.1',
    });
  });

  it('refreshes the reply text of a known review', async () => {
    const replied = new Date('2026-09-02T08:00:00.000Z');
    const { service, updateMany } = buildDeps({
      store: Store.GOOGLE_PLAY,
      pages: [
        [
          {
            ...makeReview('known'),
            repliedAt: replied,
            replyText: 'Thanks, fixed in 2.1',
          },
        ],
      ],
      existing: ['known'],
    });

    await service.syncReviews({ appId: 'app1', pages: 1, backfill: true });

    expect(updateMany).toHaveBeenCalledTimes(2);
    expect(updateMany).toHaveBeenLastCalledWith({
      where: { appId: 'app1', reviewId: 'known' },
      data: { repliedAt: replied, replyText: 'Thanks, fixed in 2.1' },
    });
  });

  it('writes nothing more for a known reply that did not change', async () => {
    const replied = new Date('2026-09-02T08:00:00.000Z');
    const { service, updateMany } = buildDeps({
      store: Store.GOOGLE_PLAY,
      pages: [
        [{ ...makeReview('known'), repliedAt: replied, replyText: 'Same' }],
      ],
      existing: ['known'],
      stored: { known: { repliedAt: replied, replyText: 'Same' } },
    });

    await service.syncReviews({ appId: 'app1', pages: 1, backfill: true });

    expect(updateMany).toHaveBeenCalledTimes(1);
    expect(updateMany.mock.calls[0][0].data.replyCheckedAt).toBeInstanceOf(
      Date,
    );
  });

  it('refreshes only the text of a reply edited in the console', async () => {
    const replied = new Date('2026-09-02T08:00:00.000Z');
    const { service, updateMany } = buildDeps({
      store: Store.GOOGLE_PLAY,
      pages: [
        [{ ...makeReview('known'), repliedAt: replied, replyText: 'Edited' }],
      ],
      existing: ['known'],
      stored: { known: { repliedAt: replied, replyText: 'First' } },
    });

    await service.syncReviews({ appId: 'app1', pages: 1, backfill: true });

    expect(updateMany).toHaveBeenLastCalledWith({
      where: { appId: 'app1', reviewId: 'known' },
      data: { replyText: 'Edited' },
    });
  });

  it('stores no reply text for an app store review', async () => {
    const { service, createMany } = buildDeps({
      pages: [[{ ...makeReview('a'), replyText: 'Ignored' }]],
      existing: [],
    });

    await service.syncReviews({ appId: 'app1', pages: 1, backfill: true });

    expect(createMany.mock.calls[0][0].data[0]).toMatchObject({
      replyText: null,
    });
  });

  it('records no reply state for App Store reviews', async () => {
    const { service, createMany, updateMany } = buildDeps({
      pages: [[makeReview('a')]],
      existing: ['b'],
    });

    await service.syncReviews({ appId: 'app1', pages: 1, backfill: true });

    expect(createMany.mock.calls[0][0].data[0]).toMatchObject({
      repliedAt: null,
      replyCheckedAt: null,
    });
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('finishes without asking the store once the app was deleted', async () => {
    const prisma = {
      app: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const registry = { get: jest.fn() };
    const service = new ReviewsService(
      prisma as unknown as PrismaService,
      registry as unknown as StoreProviderRegistry,
      { get: jest.fn() } as unknown as ConfigService<Env, true>,
      { dispatch: jest.fn() } as unknown as AlertsDispatcher,
    );

    await expect(
      service.syncReviews({ appId: 'deleted', pages: 1, backfill: false }),
    ).resolves.toEqual([]);
    expect(registry.get).not.toHaveBeenCalled();
  });
});

describe('ReviewsService silent block detection', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  async function settled<T>(promise: Promise<T>): Promise<T> {
    const [result] = await Promise.all([promise, jest.runAllTimersAsync()]);
    return result;
  }

  it('refuses an empty feed for an app that already has stored reviews', async () => {
    const { service, reviews, createMany } = buildDeps({
      pages: [[]],
      existing: [],
      storedAlready: true,
    });

    await expect(
      settled(
        service.syncReviews({ appId: 'app1', pages: 1, backfill: false }),
      ),
    ).rejects.toMatchObject({
      constructor: ImplausibleResultError,
      retryable: true,
    });

    expect(reviews).toHaveBeenCalledTimes(1 + EMPTY_ANSWER_RETRIES.APP_STORE);
    expect(reviews).toHaveBeenLastCalledWith('123', 'us', 1);
    expect(createMany).not.toHaveBeenCalled();
  });

  it('asks again when an expected feed comes back empty', async () => {
    const { service, reviews } = buildDeps({
      pages: [[], [], [makeReview('a')]],
      existing: [],
      storedAlready: true,
    });

    const inserted = await settled(
      service.syncReviews({ appId: 'app1', pages: 1, backfill: false }),
    );

    expect(inserted.map((review) => review.reviewId)).toEqual(['a']);
    expect(reviews).toHaveBeenCalledTimes(3);
  });

  it('asks each empty backfill page again before accepting it', async () => {
    const { service, reviews } = buildDeps({
      pages: [[], [makeReview('a')], [makeReview('b')], [], [], [], []],
      existing: [],
      storedAlready: false,
    });

    const inserted = await settled(
      service.syncReviews({ appId: 'app1', pages: 3, backfill: true }),
    );

    expect(inserted.map((review) => review.reviewId)).toEqual(['a', 'b']);
    expect(reviews.mock.calls).toEqual(
      [1, 1, 2, 3, 3, 3, 3].map((page) => ['123', 'us', page]),
    );
  });

  it('refuses an expected empty google play feed at once, as a soft block', async () => {
    const { service, reviews } = buildDeps({
      pages: [[]],
      existing: [],
      storedAlready: true,
      store: Store.GOOGLE_PLAY,
    });

    await expect(
      settled(
        service.syncReviews({ appId: 'app1', pages: 1, backfill: false }),
      ),
    ).rejects.toMatchObject({
      constructor: ImplausibleResultError,
      retryable: false,
    });
    expect(reviews).toHaveBeenCalledTimes(1);
  });

  it('asks once when no review is expected', async () => {
    const { service, reviews } = buildDeps({
      pages: [[]],
      existing: [],
      storedAlready: true,
      storedReviewedAt: daysAgo(365),
    });

    await settled(
      service.syncReviews({ appId: 'app1', pages: 1, backfill: false }),
    );

    expect(reviews).toHaveBeenCalledTimes(1);
  });

  it('accepts an empty feed for an app that has never had a review', async () => {
    const { service } = buildDeps({
      pages: [[]],
      existing: [],
      storedAlready: false,
    });

    await expect(
      service.syncReviews({ appId: 'app1', pages: 1, backfill: false }),
    ).resolves.toEqual([]);
  });

  it('accepts an empty feed for an app whose newest review predates the lookback window', async () => {
    const { service, createMany } = buildDeps({
      pages: [[]],
      existing: [],
      storedAlready: true,
      storedReviewedAt: daysAgo(365),
    });

    await expect(
      service.syncReviews({ appId: 'app1', pages: 1, backfill: false }),
    ).resolves.toEqual([]);

    expect(createMany).not.toHaveBeenCalled();
  });

  it('accepts an empty feed for an app whose stored reviews carry no date', async () => {
    const { service, createMany } = buildDeps({
      pages: [[]],
      existing: [],
      storedAlready: true,
      storedReviewedAt: null,
    });

    await expect(
      service.syncReviews({ appId: 'app1', pages: 1, backfill: false }),
    ).resolves.toEqual([]);

    expect(createMany).not.toHaveBeenCalled();
  });
});

describe('ReviewsService negative review alerts', () => {
  it('dispatches only for new reviews at or below the threshold', async () => {
    const { service, dispatch } = buildDeps({
      pages: [[makeReview('a', 1), makeReview('b', 3), makeReview('c', 2)]],
      existing: [],
      scoreMax: 2,
    });

    await service.syncReviews({ appId: 'app1', pages: 1, backfill: false });

    expect(dispatch).toHaveBeenCalledTimes(2);
    const scores = dispatch.mock.calls.map(
      ([payload]) => (payload as ReviewNegativePayload).review.score,
    );
    expect(scores).toEqual([1, 2]);
  });

  it('stays silent during a backfill', async () => {
    const { service, dispatch } = buildDeps({
      pages: [[makeReview('a', 1)]],
      existing: [],
      scoreMax: 2,
    });

    await service.syncReviews({ appId: 'app1', pages: 1, backfill: true });

    expect(dispatch).not.toHaveBeenCalled();
  });

  it('dispatches a one star rating without text with an empty text', async () => {
    const { service, dispatch } = buildDeps({
      pages: [[{ ...makeReview('a', 1), text: '' }]],
      existing: [],
      scoreMax: 2,
    });

    await service.syncReviews({ appId: 'app1', pages: 1, backfill: false });

    const payload = dispatch.mock.calls[0][0] as ReviewNegativePayload;
    expect(payload.review).toMatchObject({ score: 1, text: '' });
  });

  it('truncates the dispatched review text to 500 characters', async () => {
    const long = makeReview('a', 1);
    long.text = 'x'.repeat(600);
    const { service, dispatch } = buildDeps({
      pages: [[long]],
      existing: [],
      scoreMax: 2,
    });

    await service.syncReviews({ appId: 'app1', pages: 1, backfill: false });

    const payload = dispatch.mock.calls[0][0] as ReviewNegativePayload;
    expect(payload.review.text).toHaveLength(500);
  });
});

describe('ReviewsService.list', () => {
  it("embeds the owner's reply and the four counts", async () => {
    const updatedAt = new Date('2026-10-01T00:00:00.000Z');
    const tx = {
      review: {
        findMany: jest
          .fn<Promise<unknown[]>, [Record<string, unknown>]>()
          .mockResolvedValueOnce([
            {
              id: 'rev-1',
              reviewId: 'r1',
              userName: null,
              score: 1,
              title: null,
              text: 'Crashes',
              version: '1.0.0',
              reviewedAt: null,
              repliedAt: null,
              replyText: null,
              reply: {
                reviewId: 'rev-1',
                appId: 'app1',
                workspaceId: 'ws_1',
                text: 'Sorry about that',
                tone: 'angry',
                model: null,
                generatedAt: null,
                repliedAt: null,
                createdAt: updatedAt,
                updatedAt,
              },
            },
          ])
          .mockResolvedValueOnce([{ version: '1.0.0' }]),
        count: jest
          .fn()
          .mockResolvedValueOnce(1)
          .mockResolvedValueOnce(4)
          .mockResolvedValueOnce(1)
          .mockResolvedValueOnce(2)
          .mockResolvedValueOnce(3),
      },
    };
    const prisma = {
      app: { findFirst: jest.fn().mockResolvedValue({ id: 'app1' }) },
      review: {
        fields: {
          repliedAt: {
            modelName: 'Review',
            name: 'repliedAt',
            typeName: 'DateTime',
            isList: false,
          },
        },
      },
      withTransaction: jest.fn((run: (client: typeof tx) => unknown) =>
        run(tx),
      ),
    };
    const service = new ReviewsService(
      prisma as unknown as PrismaService,
      {} as StoreProviderRegistry,
      {} as ConfigService<Env, true>,
      {} as AlertsDispatcher,
    );

    const list = await service.list('app1', {
      limit: 50,
      sort: 'newest',
      replyState: 'drafted',
    });

    expect(list.counts).toEqual({
      needsReply: 4,
      drafted: 1,
      replied: 2,
      updated: 3,
    });
    expect(list.reviews[0].reply).toEqual({
      text: 'Sorry about that',
      tone: null,
      model: null,
      generatedAt: null,
      updatedAt: updatedAt.toISOString(),
      repliedAt: null,
    });
    expect(tx.review.findMany.mock.calls[0][0]).toMatchObject({
      where: {
        AND: [
          { appId: 'app1' },
          { repliedAt: null, reply: { is: { repliedAt: null } } },
        ],
      },
      include: { reply: true },
    });
  });
});
