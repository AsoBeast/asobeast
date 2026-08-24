import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Store } from '@prisma/client';
import { AlertPayload, ReviewNegativePayload } from '@asobeast/shared';
import { AlertsDispatcher } from '../alerts/alerts.dispatcher';
import { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { ImplausibleResultError } from '../store-providers/errors';
import { StoreProviderRegistry } from '../store-providers/store-provider.registry';
import { ReviewResult } from '../store-providers/types';
import { ReviewsService } from './reviews.service';

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
}) => {
  const reviews = jest.fn();
  options.pages.forEach((page) => reviews.mockResolvedValueOnce(page));
  const createMany = jest
    .fn<Promise<{ count: number }>, [{ data: { reviewId: string }[] }]>()
    .mockResolvedValue({ count: 0 });
  const prisma = {
    app: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'app1',
        name: 'Mine',
        store: Store.APP_STORE,
        storeAppId: '123',
        country: 'us',
      }),
    },
    review: {
      findMany: jest
        .fn()
        .mockResolvedValue(options.existing.map((reviewId) => ({ reviewId }))),
      findFirst: jest
        .fn()
        .mockResolvedValue(options.storedAlready ? { id: 'r1' } : null),
      createMany,
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
  return { service, reviews, createMany, dispatch };
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

  it('rejects an unknown app', async () => {
    const prisma = {
      app: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const service = new ReviewsService(
      prisma as unknown as PrismaService,
      { get: jest.fn() } as unknown as StoreProviderRegistry,
      { get: jest.fn() } as unknown as ConfigService<Env, true>,
      { dispatch: jest.fn() } as unknown as AlertsDispatcher,
    );

    await expect(
      service.syncReviews({ appId: 'missing', pages: 1, backfill: false }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('ReviewsService silent block detection', () => {
  it('refuses an empty feed for an app that already has stored reviews', async () => {
    const { service, createMany } = buildDeps({
      pages: [[]],
      existing: [],
      storedAlready: true,
    });

    await expect(
      service.syncReviews({ appId: 'app1', pages: 1, backfill: false }),
    ).rejects.toThrow(ImplausibleResultError);

    expect(createMany).not.toHaveBeenCalled();
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
