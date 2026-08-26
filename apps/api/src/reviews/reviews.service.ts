import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, Store } from '@prisma/client';
import {
  RatingsHistogram,
  RATING_STARS,
  ReviewItem,
  ReviewList,
} from '@asobeast/shared';
import { AlertsDispatcher } from '../alerts/alerts.dispatcher';
import { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { ImplausibleResultError } from '../store-providers/errors';
import {
  IMPLAUSIBLE_LOOKBACK_DAYS,
  isImplausiblyEmpty,
} from '../store-providers/result-plausibility';
import { ratingHistogram } from '../store-providers/raw-facts';
import { StoreProviderRegistry } from '../store-providers/store-provider.registry';
import { ReviewResult } from '../store-providers/types';
import { SyncReviewsPayload } from '../jobs/jobs.types';

export interface ReviewListFilters {
  score?: number;
  version?: string;
  limit: number;
}

const REVIEW_TEXT_MAX = 500;

@Injectable()
export class ReviewsService {
  private readonly logger = new Logger(ReviewsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: StoreProviderRegistry,
    private readonly config: ConfigService<Env, true>,
    private readonly alerts: AlertsDispatcher,
  ) {}

  async syncReviews(payload: SyncReviewsPayload): Promise<ReviewResult[]> {
    const app = await this.prisma.app.findFirst({
      where: { id: payload.appId },
      select: {
        id: true,
        name: true,
        store: true,
        storeAppId: true,
        country: true,
      },
    });
    if (!app) {
      throw new NotFoundException(`App ${payload.appId} not found`);
    }

    const provider = this.registry.get(app.store);
    const fetched = new Map<string, ReviewResult>();
    for (let page = 1; page <= payload.pages; page++) {
      const results = await provider.reviews(app.storeAppId, app.country, page);
      for (const review of results) {
        if (!fetched.has(review.reviewId)) {
          fetched.set(review.reviewId, review);
        }
      }
    }

    if (fetched.size === 0) {
      await this.rejectSilentlyEmptyFeed(app);
    }

    const existing = await this.prisma.review.findMany({
      where: { appId: app.id, reviewId: { in: [...fetched.keys()] } },
      select: { reviewId: true },
    });
    const known = new Set(existing.map((row) => row.reviewId));
    const inserted = [...fetched.values()].filter(
      (review) => !known.has(review.reviewId),
    );

    if (inserted.length > 0) {
      await this.prisma.review.createMany({
        data: inserted.map((review) => ({
          appId: app.id,
          reviewId: review.reviewId,
          userName: review.userName ?? null,
          score: review.score,
          title: review.title ?? null,
          text: review.text,
          version: review.version ?? null,
          reviewedAt: review.updatedAt ?? null,
        })),
        skipDuplicates: true,
      });
    }

    if (!payload.backfill) {
      await this.dispatchNegativeAlerts(
        { id: app.id, name: app.name },
        inserted,
      );
    }

    return inserted;
  }

  private async rejectSilentlyEmptyFeed(app: {
    id: string;
    store: Store;
    storeAppId: string;
  }): Promise<void> {
    const newest = await this.prisma.review.findFirst({
      where: { appId: app.id, reviewedAt: { not: null } },
      orderBy: { reviewedAt: 'desc' },
      select: { reviewedAt: true },
    });
    const implausible = isImplausiblyEmpty({
      resultCount: 0,
      lastRankedOn: newest?.reviewedAt ?? null,
      today: new Date(),
    });
    if (!implausible) return;
    throw new ImplausibleResultError(
      app.store,
      `the review feed for ${app.storeAppId} came back empty for an app that was receiving reviews within the last ${IMPLAUSIBLE_LOOKBACK_DAYS} days`,
    );
  }

  private async dispatchNegativeAlerts(
    app: { id: string; name: string | null },
    reviews: ReviewResult[],
  ): Promise<void> {
    const threshold = this.config.get('ALERT_REVIEW_SCORE_MAX', {
      infer: true,
    });
    for (const review of reviews) {
      if (review.score > threshold) {
        continue;
      }
      try {
        await this.alerts.dispatch({
          event: 'review.negative',
          occurredAt: new Date().toISOString(),
          app,
          review: {
            score: review.score,
            title: review.title ?? null,
            text: review.text.slice(0, REVIEW_TEXT_MAX),
            version: review.version ?? null,
            reviewedAt: review.updatedAt
              ? review.updatedAt.toISOString()
              : null,
          },
        });
      } catch (error) {
        this.logger.warn(
          `review alert dispatch failed: ${(error as Error).message}`,
        );
      }
    }
  }

  async list(appId: string, filters: ReviewListFilters): Promise<ReviewList> {
    await this.ensureApp(appId);

    const where: Prisma.ReviewWhereInput = {
      appId,
      ...(filters.score !== undefined ? { score: filters.score } : {}),
      ...(filters.version !== undefined ? { version: filters.version } : {}),
    };

    const [reviews, total, versions] = await this.prisma.withTransaction((tx) =>
      Promise.all([
        tx.review.findMany({
          where,
          orderBy: { reviewedAt: 'desc' },
          take: filters.limit,
        }),
        tx.review.count({ where }),
        tx.review.findMany({
          where: { appId, version: { not: null } },
          distinct: ['version'],
          orderBy: { version: 'desc' },
          select: { version: true },
        }),
      ]),
    );

    return {
      reviews: reviews.map((review) => this.toReviewItem(review)),
      total,
      versions: versions
        .map((row) => row.version)
        .filter((version): version is string => version !== null),
    };
  }

  private toReviewItem(review: {
    id: string;
    reviewId: string;
    userName: string | null;
    score: number;
    title: string | null;
    text: string;
    version: string | null;
    reviewedAt: Date | null;
  }): ReviewItem {
    return {
      id: review.id,
      reviewId: review.reviewId,
      userName: review.userName,
      score: review.score,
      title: review.title,
      text: review.text,
      version: review.version,
      reviewedAt: review.reviewedAt ? review.reviewedAt.toISOString() : null,
    };
  }

  async histogram(appId: string): Promise<RatingsHistogram> {
    const app = await this.prisma.app.findFirst({
      where: { id: appId },
      select: { store: true },
    });
    if (!app) {
      throw new NotFoundException(`App ${appId} not found`);
    }

    const snapshot = await this.prisma.appSnapshot.findFirst({
      where: { appId },
      orderBy: { capturedAt: 'desc' },
      select: { raw: true, capturedAt: true },
    });
    const counts = snapshot && ratingHistogram(app.store, snapshot.raw);
    if (!counts) {
      return { available: false, counts: null, total: null, capturedAt: null };
    }

    return {
      available: true,
      counts,
      total: RATING_STARS.reduce((sum, star) => sum + counts[star], 0),
      capturedAt: snapshot.capturedAt.toISOString(),
    };
  }

  private async ensureApp(id: string): Promise<void> {
    const app = await this.prisma.app.findFirst({
      where: { id },
      select: { id: true },
    });
    if (!app) {
      throw new NotFoundException(`App ${id} not found`);
    }
  }
}
