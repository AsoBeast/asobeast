import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Store } from '@prisma/client';
import {
  AlertPayload,
  RatingsHistogram,
  RATING_STARS,
  REVIEW_REPLY_STATES,
  ReviewItem,
  ReviewList,
  ReviewReplyCounts,
  ReviewReplyState,
  ReviewSort,
} from '@asobeast/shared';
import { AlertsDispatcher } from '../alerts/alerts.dispatcher';
import { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { ImplausibleResultError } from '../store-providers/errors';
import {
  askAgainWhileEmpty,
  EMPTY_ANSWER_RETRIES,
  IMPLAUSIBLE_LOOKBACK_DAYS,
  isImplausiblyEmpty,
  settleOnLastAttempt,
} from '../store-providers/result-plausibility';
import { ratingHistogram } from '../store-providers/raw-facts';
import { StoreProviderRegistry } from '../store-providers/store-provider.registry';
import { ReviewResult, StoreProvider } from '../store-providers/types';
import { SyncReviewsPayload } from '../jobs/jobs.types';
import { sortVersionsNewestFirst } from './version-order';
import { HOME_LISTING, NEWEST_FIRST } from '../apps/listing';
import { reviewOrder, ReviewScope, reviewsWhere } from './review-list-query';
import {
  ReviewReplyRow,
  toReviewReplyItem,
  WITH_POSTER,
} from './review-reply.mapper';
import {
  ReviewAlertApp,
  reviewNegativePayload,
  reviewNewPayload,
} from './review-alert-payloads';
import { reviewLanguage } from './review-language';
import { toReviewTranslation, TranslationColumns } from './review-translation';
import { StoredReview, storedReviewChanges } from './stored-review-changes';

export interface ReviewListFilters extends ReviewScope {
  limit: number;
  replyState?: ReviewReplyState;
  sort: ReviewSort;
}

interface ReviewSource {
  id: string;
  store: Store;
  storeAppId: string;
  country: string;
}

@Injectable()
export class ReviewsService {
  private readonly logger = new Logger(ReviewsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: StoreProviderRegistry,
    private readonly config: ConfigService<Env, true>,
    private readonly alerts: AlertsDispatcher,
  ) {}

  async syncReviews(
    payload: SyncReviewsPayload,
    finalAttempt = false,
  ): Promise<ReviewResult[]> {
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
      return [];
    }

    const provider = this.registry.get(app.store);
    const expected = await this.expectsReviews(app.id);
    const retries =
      expected || payload.backfill ? EMPTY_ANSWER_RETRIES[app.store] : 0;
    const fetched = await this.fetchPages(
      provider,
      app,
      payload.pages,
      retries,
    );
    if (fetched.size === 0 && expected) {
      return this.settleEmptyFeed(app, retries, finalAttempt);
    }

    const existing = await this.prisma.review.findMany({
      where: { appId: app.id, reviewId: { in: [...fetched.keys()] } },
      select: {
        reviewId: true,
        score: true,
        title: true,
        text: true,
        version: true,
        reviewedAt: true,
        repliedAt: true,
        replyText: true,
      },
    });
    const known = new Map(existing.map((row) => [row.reviewId, row]));
    const inserted = [...fetched.values()].filter(
      (review) => !known.has(review.reviewId),
    );

    const tracksUpdates = app.store === Store.GOOGLE_PLAY;
    const checkedAt = tracksUpdates ? new Date() : null;

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
          repliedAt: tracksUpdates ? (review.repliedAt ?? null) : null,
          replyText: tracksUpdates ? (review.replyText ?? null) : null,
          replyCheckedAt: checkedAt,
        })),
        skipDuplicates: true,
      });
    }

    if (checkedAt !== null && known.size > 0) {
      await this.recordUpdates(app.id, fetched, known, checkedAt);
    }

    if (!payload.backfill) {
      const alertApp = { id: app.id, name: app.name };
      await this.dispatchNegativeAlerts(alertApp, inserted);
      await this.dispatchNewReviewAlerts(alertApp, inserted);
    }

    return inserted;
  }

  private async recordUpdates(
    appId: string,
    fetched: Map<string, ReviewResult>,
    known: Map<string, StoredReview>,
    checkedAt: Date,
  ): Promise<void> {
    await this.prisma.review.updateMany({
      where: { appId, reviewId: { in: [...known.keys()] } },
      data: { replyCheckedAt: checkedAt },
    });
    for (const [reviewId, stored] of known) {
      const data = storedReviewChanges(stored, fetched.get(reviewId));
      if (Object.keys(data).length === 0) continue;
      await this.prisma.review.updateMany({
        where: { appId, reviewId },
        data,
      });
    }
  }

  private settleEmptyFeed(
    app: ReviewSource,
    retries: number,
    finalAttempt: boolean,
  ): ReviewResult[] {
    return settleOnLastAttempt(
      new ImplausibleResultError(
        app.store,
        `the review feed for ${app.storeAppId} came back empty for an app that was receiving reviews within the last ${IMPLAUSIBLE_LOOKBACK_DAYS} days`,
        { retryable: retries > 0 },
      ),
      { finalAttempt, logger: this.logger, next: 'sync', settled: [] },
    );
  }

  private async fetchPages(
    provider: StoreProvider,
    app: ReviewSource,
    pages: number,
    retries: number,
  ): Promise<Map<string, ReviewResult>> {
    const fetched = new Map<string, ReviewResult>();
    for (let page = 1; page <= pages; page++) {
      const reviews = await askAgainWhileEmpty(
        () => provider.reviews(app.storeAppId, app.country, page),
        retries,
      );
      for (const review of reviews) {
        if (!fetched.has(review.reviewId)) {
          fetched.set(review.reviewId, review);
        }
      }
    }
    return fetched;
  }

  private async expectsReviews(appId: string): Promise<boolean> {
    const newest = await this.prisma.review.findFirst({
      where: { appId, reviewedAt: { not: null } },
      orderBy: { reviewedAt: 'desc' },
      select: { reviewedAt: true },
    });
    return isImplausiblyEmpty({
      resultCount: 0,
      lastSeenOn: newest?.reviewedAt ?? null,
      today: new Date(),
    });
  }

  private async dispatchNegativeAlerts(
    app: ReviewAlertApp,
    reviews: ReviewResult[],
  ): Promise<void> {
    const threshold = this.config.get('ALERT_REVIEW_SCORE_MAX', {
      infer: true,
    });
    for (const review of reviews) {
      if (review.score > threshold) {
        continue;
      }
      await this.dispatchQuietly(
        reviewNegativePayload(app, review, new Date()),
      );
    }
  }

  private async dispatchNewReviewAlerts(
    app: ReviewAlertApp,
    reviews: ReviewResult[],
  ): Promise<void> {
    if (reviews.length === 0 || !(await this.hasNewReviewListener())) return;
    for (const review of reviews) {
      await this.dispatchQuietly(reviewNewPayload(app, review, new Date()));
    }
  }

  private async hasNewReviewListener(): Promise<boolean> {
    try {
      return await this.alerts.listensTo('review.new');
    } catch (error) {
      this.logger.warn(
        `review alert subscribers unavailable, sending new reviews anyway: ${error instanceof Error ? error.message : String(error)}`,
      );
      return true;
    }
  }

  private async dispatchQuietly(alert: AlertPayload): Promise<void> {
    try {
      await this.alerts.dispatch(alert);
    } catch (error) {
      this.logger.warn(
        `review alert dispatch failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async list(appId: string, filters: ReviewListFilters): Promise<ReviewList> {
    await this.ensureApp(appId);

    const { repliedAt } = this.prisma.review.fields;
    const inState = (state: ReviewReplyState | undefined) =>
      reviewsWhere(appId, filters, state, repliedAt);
    const listed = inState(filters.replyState);

    const [reviews, total, versions, needsReply, drafted, replied, updated] =
      await this.prisma.withTransaction((tx) =>
        Promise.all([
          tx.review.findMany({
            where: listed,
            orderBy: reviewOrder(filters.sort),
            take: filters.limit,
            include: { reply: { include: WITH_POSTER } },
          }),
          tx.review.count({ where: listed }),
          tx.review.findMany({
            where: { appId, version: { not: null } },
            distinct: ['version'],
            select: { version: true },
          }),
          ...REVIEW_REPLY_STATES.map((state) =>
            tx.review.count({ where: inState(state) }),
          ),
        ]),
      );
    const counts: ReviewReplyCounts = {
      needsReply,
      drafted,
      replied,
      updated,
    };

    return {
      reviews: reviews.map((review) => this.toReviewItem(review)),
      total,
      counts,
      versions: sortVersionsNewestFirst(
        versions
          .map((row) => row.version)
          .filter((version): version is string => version !== null),
      ),
    };
  }

  private toReviewItem(
    review: TranslationColumns & {
      id: string;
      reviewId: string;
      userName: string | null;
      score: number;
      title: string | null;
      text: string;
      version: string | null;
      reviewedAt: Date | null;
      repliedAt: Date | null;
      replyText: string | null;
      reply: ReviewReplyRow | null;
    },
  ): ReviewItem {
    return {
      id: review.id,
      reviewId: review.reviewId,
      userName: review.userName,
      score: review.score,
      title: review.title,
      text: review.text,
      version: review.version,
      reviewedAt: review.reviewedAt ? review.reviewedAt.toISOString() : null,
      repliedAt: review.repliedAt ? review.repliedAt.toISOString() : null,
      replyText: review.replyText,
      reply: review.reply ? toReviewReplyItem(review.reply) : null,
      language: reviewLanguage(`${review.title ?? ''} ${review.text}`),
      translation: toReviewTranslation(review),
    };
  }

  async item(appId: string, reviewId: string): Promise<ReviewItem> {
    const review = await this.prisma.review.findFirst({
      where: { id: reviewId, appId },
      include: { reply: { include: WITH_POSTER } },
    });
    if (!review) {
      throw new NotFoundException(`Review ${reviewId} not found`);
    }
    return this.toReviewItem(review);
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
      where: { appId, ...HOME_LISTING },
      orderBy: NEWEST_FIRST,
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
