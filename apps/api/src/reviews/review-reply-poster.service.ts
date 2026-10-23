import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type {
  ReviewPostState,
  ReviewReplyPostResult,
  Store,
} from '@asobeast/shared';
import { WorkspaceContext } from '../common/tenancy/workspace-context';
import { PrismaService } from '../prisma/prisma.service';
import { AscError } from '../store-connect/asc-errors';
import type {
  AscReviewResponse,
  AscReviewsApi,
} from '../store-connect/asc-reviews-api';
import {
  CONNECTION_REJECTED,
  type OpenedConnection,
  StoreConnectionService,
} from '../store-connect/store-connection.service';
import {
  AscReviewLocator,
  type LocatableApp,
  type LocatableReview,
} from './asc-review-locator.service';
import { assertWithinReplyLimit } from './review-replies.service';
import { CONNECT_FIRST, postRefusalOf } from './review-reply-post-errors';
import { ReviewsService } from './reviews.service';

export const NO_KEPT_REPLY = 'Save a reply before posting it.';
export const NOTHING_POSTED = 'This reply has not been posted to the store.';
export const OWN_APPS_ONLY = 'Replies are posted for your own apps only.';
export const PLAY_NO_WITHDRAW =
  'Google Play offers no way to remove a reply through its API. Edit or remove it in Play Console.';

interface PostTarget {
  app: LocatableApp & { store: Store };
  review: LocatableReview & {
    reviewId: string;
    reply: {
      text: string;
      storeReviewId: string | null;
      storeResponseId: string | null;
      postedAt: Date | null;
    } | null;
  };
}

interface Posted {
  postedAt: Date;
  state: ReviewPostState;
  storeReviewId: string | null;
  storeResponseId: string | null;
}

const UNPOSTED = {
  postedAt: null,
  postedText: null,
  postState: null,
  storeResponseId: null,
  postedByUserId: null,
  repliedAt: null,
};

const MISSING = 404;

const isMissing = (error: unknown): boolean =>
  error instanceof AscError && error.status === MISSING;

@Injectable()
export class ReviewReplyPoster {
  private readonly logger = new Logger(ReviewReplyPoster.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly workspace: WorkspaceContext,
    private readonly connections: StoreConnectionService,
    private readonly locator: AscReviewLocator,
    private readonly reviews: ReviewsService,
  ) {}

  async post(
    appId: string,
    reviewId: string,
    userId: string,
  ): Promise<ReviewReplyPostResult> {
    const workspaceId = this.workspace.require('a review reply post');
    const { app, review } = await this.target(appId, reviewId);
    const text = review.reply?.text.trim();
    if (!text) throw new BadRequestException(NO_KEPT_REPLY);
    assertWithinReplyLimit(app.store, text);
    const posted = await this.attempt(app.store, () =>
      app.store === 'APP_STORE'
        ? this.toAppStore(app, review, text)
        : this.toPlay(app, review.reviewId, text),
    );
    const columns = {
      postedAt: posted.postedAt,
      postedText: text,
      postState: posted.state,
      storeReviewId: posted.storeReviewId,
      storeResponseId: posted.storeResponseId,
      postedByUserId: userId,
      repliedAt: posted.postedAt,
    };
    await this.prisma.withTransaction(async (tx) => {
      await tx.reviewReply.upsert({
        where: { reviewId },
        create: {
          reviewId,
          appId,
          workspaceId,
          text,
          ...columns,
        },
        update: columns,
      });
      await tx.review.updateMany({
        where: { id: reviewId, appId },
        data: { repliedAt: posted.postedAt, replyText: text },
      });
    });
    await this.bestEffort(
      this.connections.markReplyAccess(app.store, 'allowed'),
    );
    return { review: await this.reviews.item(appId, reviewId) };
  }

  async withdraw(
    appId: string,
    reviewId: string,
  ): Promise<ReviewReplyPostResult> {
    const { app, review } = await this.target(appId, reviewId);
    if (app.store === 'GOOGLE_PLAY') {
      throw new ConflictException(PLAY_NO_WITHDRAW);
    }
    const responseId = review.reply?.postedAt
      ? review.reply.storeResponseId
      : null;
    if (!responseId) throw new NotFoundException(NOTHING_POSTED);
    await this.attempt(app.store, async () => {
      const api = this.usable(
        app.store,
        await this.connections.openAppStoreReviews(),
      );
      await api.deleteResponse(responseId);
    });
    await this.prisma.withTransaction(async (tx) => {
      await tx.reviewReply.updateMany({ where: { reviewId }, data: UNPOSTED });
      await tx.review.updateMany({
        where: { id: reviewId, appId },
        data: { repliedAt: null, replyText: null },
      });
    });
    return { review: await this.reviews.item(appId, reviewId) };
  }

  private async toAppStore(
    app: PostTarget['app'],
    review: PostTarget['review'],
    text: string,
  ): Promise<Posted> {
    const api = this.usable(
      app.store,
      await this.connections.openAppStoreReviews(),
    );
    const { storeReviewId, response } = await this.respond(
      api,
      app,
      review,
      text,
    );
    return {
      postedAt: new Date(),
      state: response.state === 'PUBLISHED' ? 'published' : 'pending',
      storeReviewId,
      storeResponseId: response.id,
    };
  }

  private async respond(
    api: AscReviewsApi,
    app: PostTarget['app'],
    review: PostTarget['review'],
    text: string,
  ): Promise<{ storeReviewId: string; response: AscReviewResponse }> {
    const storeReviewId = await this.locator.locate(api, app, review);
    try {
      return {
        storeReviewId,
        response: await api.respond(storeReviewId, text),
      };
    } catch (error) {
      if (!review.reply?.storeReviewId || !isMissing(error)) throw error;
      const located = await this.locator.locate(api, app, {
        ...review,
        reply: { ...review.reply, storeReviewId: null },
      });
      return {
        storeReviewId: located,
        response: await api.respond(located, text),
      };
    }
  }

  private async toPlay(
    app: PostTarget['app'],
    storeReviewId: string,
    text: string,
  ): Promise<Posted> {
    const api = this.usable(
      app.store,
      await this.connections.openPlayPublisher(),
    );
    const reply = await api.reply(app.storeAppId, storeReviewId, text);
    return {
      postedAt: reply.lastEdited,
      state: 'published',
      storeReviewId: null,
      storeResponseId: null,
    };
  }

  private usable<A>(store: Store, opened: OpenedConnection<A> | null): A {
    if (!opened) throw new ConflictException(CONNECT_FIRST[store]);
    if (opened.status === 'rejected') {
      throw new ConflictException(CONNECTION_REJECTED);
    }
    return opened.api;
  }

  private async attempt<T>(store: Store, run: () => Promise<T>): Promise<T> {
    try {
      return await run();
    } catch (error) {
      const refusal = postRefusalOf(error);
      if (refusal.forbidden) {
        await this.bestEffort(
          this.connections.markReplyAccess(store, 'forbidden'),
        );
      }
      if (refusal.rejected) {
        await this.bestEffort(
          this.connections.markRejected(store, refusal.rejected),
        );
      }
      throw refusal.exception;
    }
  }

  private async bestEffort(write: Promise<void>): Promise<void> {
    try {
      await write;
    } catch (error) {
      this.logger.warn(
        `the store connection was not updated: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async target(appId: string, reviewId: string): Promise<PostTarget> {
    const app = await this.prisma.app.findFirst({
      where: { id: appId },
      select: {
        store: true,
        storeAppId: true,
        country: true,
        isCompetitor: true,
      },
    });
    if (!app) throw new NotFoundException(`App ${appId} not found`);
    if (app.isCompetitor) throw new BadRequestException(OWN_APPS_ONLY);
    const review = await this.prisma.review.findFirst({
      where: { id: reviewId, appId },
      select: {
        id: true,
        reviewId: true,
        userName: true,
        score: true,
        title: true,
        text: true,
        reviewedAt: true,
        reply: {
          select: {
            text: true,
            storeReviewId: true,
            storeResponseId: true,
            postedAt: true,
          },
        },
      },
    });
    if (!review) throw new NotFoundException(`Review ${reviewId} not found`);
    return { app, review };
  }
}
