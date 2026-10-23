import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { Store } from '@asobeast/shared';
import type { PrismaService } from '../prisma/prisma.service';
import {
  AscForbiddenError,
  AscRejectedKeyError,
} from '../store-connect/asc-errors';
import type { AscReviewsApi } from '../store-connect/asc-reviews-api';
import { PlayForbiddenError } from '../store-connect/play/play-publisher-api';
import type { PlayPublisherApi } from '../store-connect/play/play-publisher-api';
import type { StoreConnectionService } from '../store-connect/store-connection.service';
import type { AscReviewLocator } from './asc-review-locator.service';
import { REPLY_ROLE_NEEDED } from './review-reply-post-errors';
import {
  NO_KEPT_REPLY,
  NOTHING_POSTED,
  OWN_APPS_ONLY,
  PLAY_NO_WITHDRAW,
  ReviewReplyPoster,
} from './review-reply-poster.service';
import type { ReviewsService } from './reviews.service';

const EDITED = new Date('2026-10-20T08:00:00.000Z');

interface Options {
  store?: Store;
  text?: string | null;
  postedAt?: Date | null;
  storeResponseId?: string | null;
  competitor?: boolean;
  connection?: 'active' | 'rejected' | null;
}

function harness(options: Options = {}) {
  const store = options.store ?? 'APP_STORE';
  const writes: { reply?: unknown; review?: unknown } = {};
  const tx = {
    reviewReply: {
      updateMany: jest.fn((args: { data: unknown }) => {
        writes.reply = args.data;
        return Promise.resolve({ count: 1 });
      }),
    },
    review: {
      updateMany: jest.fn((args: { data: unknown }) => {
        writes.review = args.data;
        return Promise.resolve({ count: 1 });
      }),
    },
  };
  const prisma = {
    app: {
      findFirst: jest.fn().mockResolvedValue({
        store,
        storeAppId: store === 'APP_STORE' ? '1234' : 'com.focus',
        country: 'us',
        isCompetitor: options.competitor ?? false,
      }),
    },
    review: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'rev-1',
        reviewId: 'store-review-1',
        userName: 'Jordan',
        score: 2,
        title: 'Crashes',
        text: 'It crashes',
        reviewedAt: EDITED,
        reply:
          options.text === null
            ? null
            : {
                text: options.text ?? '  Thanks, fixed in 3.5  ',
                storeReviewId: null,
                storeResponseId: options.storeResponseId ?? null,
                postedAt: options.postedAt ?? null,
              },
      }),
    },
    withTransaction: jest.fn((run: (client: typeof tx) => Promise<unknown>) =>
      run(tx),
    ),
  };
  const asc = {
    respond: jest.fn().mockResolvedValue({
      id: 'response-1',
      state: 'PENDING_PUBLISH',
      lastModifiedDate: '',
    }),
    deleteResponse: jest.fn().mockResolvedValue(undefined),
  };
  const play = {
    reply: jest.fn().mockResolvedValue({ replyText: 'x', lastEdited: EDITED }),
  };
  const opened = <A>(api: A) =>
    options.connection === null
      ? null
      : { status: options.connection ?? 'active', api };
  const connections = {
    openAppStoreReviews: jest.fn(() =>
      Promise.resolve(opened(asc as unknown as AscReviewsApi)),
    ),
    openPlayPublisher: jest.fn(() =>
      Promise.resolve(opened(play as unknown as PlayPublisherApi)),
    ),
    markReplyAccess: jest.fn().mockResolvedValue(undefined),
    markRejected: jest.fn().mockResolvedValue(undefined),
  };
  const locator = { locate: jest.fn().mockResolvedValue('asc-review-9') };
  const reviews = { item: jest.fn().mockResolvedValue({ id: 'rev-1' }) };
  const poster = new ReviewReplyPoster(
    prisma as unknown as PrismaService,
    connections as unknown as StoreConnectionService,
    locator as unknown as AscReviewLocator,
    reviews as unknown as ReviewsService,
  );
  return { poster, prisma, asc, play, connections, locator, writes, tx };
}

describe('ReviewReplyPoster', () => {
  it('refuses a review without kept text before opening a connection', async () => {
    const { poster, connections } = harness({ text: null });

    const refusal = poster.post('app-1', 'rev-1', 'user-1');
    await expect(refusal).rejects.toBeInstanceOf(BadRequestException);
    await expect(refusal).rejects.toThrow(NO_KEPT_REPLY);
    expect(connections.openAppStoreReviews).not.toHaveBeenCalled();
  });

  it('holds the text to the store limit before any request', async () => {
    const { poster, connections } = harness({
      store: 'GOOGLE_PLAY',
      text: 'a'.repeat(351),
    });

    await expect(poster.post('app-1', 'rev-1', 'user-1')).rejects.toThrow(
      'at most 350 characters',
    );
    expect(connections.openPlayPublisher).not.toHaveBeenCalled();
  });

  it('refuses the review of a competitor', async () => {
    const { poster, connections } = harness({ competitor: true });

    await expect(poster.post('app-1', 'rev-1', 'user-1')).rejects.toThrow(
      OWN_APPS_ONLY,
    );
    expect(connections.openAppStoreReviews).not.toHaveBeenCalled();
  });

  it('answers 404 for an unknown app or review', async () => {
    const { poster, prisma } = harness();
    prisma.review.findFirst.mockResolvedValueOnce(null);
    await expect(poster.post('app-1', 'gone', 'user-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    prisma.app.findFirst.mockResolvedValueOnce(null);
    await expect(poster.post('gone', 'rev-1', 'user-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it.each([
    ['without a connection', null, 'Connect App Store Connect in Settings'],
    [
      'for a rejected connection',
      'rejected' as const,
      'refused the connected key',
    ],
  ])('answers 409 %s', async (_, connection, message) => {
    const { poster, asc } = harness({ connection });

    const refusal = poster.post('app-1', 'rev-1', 'user-1');
    await expect(refusal).rejects.toBeInstanceOf(ConflictException);
    await expect(refusal).rejects.toThrow(message);
    expect(asc.respond).not.toHaveBeenCalled();
  });

  it('locates an app store review, responds with the kept text and records the post', async () => {
    const { poster, asc, locator, writes, connections } = harness();

    await expect(poster.post('app-1', 'rev-1', 'user-1')).resolves.toEqual({
      review: { id: 'rev-1' },
    });

    expect(locator.locate).toHaveBeenCalledWith(
      asc,
      expect.objectContaining({ storeAppId: '1234', country: 'us' }),
      expect.objectContaining({ id: 'rev-1' }),
    );
    expect(asc.respond).toHaveBeenCalledWith(
      'asc-review-9',
      'Thanks, fixed in 3.5',
    );
    expect(writes.reply).toMatchObject({
      postedText: 'Thanks, fixed in 3.5',
      postState: 'pending',
      storeReviewId: 'asc-review-9',
      storeResponseId: 'response-1',
      postedByUserId: 'user-1',
    });
    const { postedAt, repliedAt } = writes.reply as Record<string, Date>;
    expect(postedAt).toBeInstanceOf(Date);
    expect(repliedAt).toBe(postedAt);
    expect(writes.review).toEqual({
      repliedAt: postedAt,
      replyText: 'Thanks, fixed in 3.5',
    });
    expect(connections.markReplyAccess).toHaveBeenCalledWith(
      'APP_STORE',
      'allowed',
    );
  });

  it('records a response apple already published as published', async () => {
    const { poster, asc, writes } = harness();
    asc.respond.mockResolvedValueOnce({
      id: 'response-1',
      state: 'PUBLISHED',
      lastModifiedDate: '',
    });

    await poster.post('app-1', 'rev-1', 'user-1');

    expect(writes.reply).toMatchObject({ postState: 'published' });
  });

  it('replies to a google play review by its store id and records the post as published', async () => {
    const { poster, play, writes, locator } = harness({ store: 'GOOGLE_PLAY' });

    await poster.post('app-1', 'rev-1', 'user-1');

    expect(play.reply).toHaveBeenCalledWith(
      'com.focus',
      'store-review-1',
      'Thanks, fixed in 3.5',
    );
    expect(locator.locate).not.toHaveBeenCalled();
    expect(writes.reply).toMatchObject({
      postedAt: EDITED,
      repliedAt: EDITED,
      postState: 'published',
      storeResponseId: null,
    });
    expect(writes.review).toEqual({
      repliedAt: EDITED,
      replyText: 'Thanks, fixed in 3.5',
    });
  });

  it.each([
    ['APP_STORE' as const, new AscForbiddenError('no', 403, 'FORBIDDEN_ERROR')],
    ['GOOGLE_PLAY' as const, new PlayForbiddenError('no', 403)],
  ])(
    'turns a missing %s role into 403 and remembers it',
    async (store, error) => {
      const { poster, asc, play, connections, tx } = harness({ store });
      asc.respond.mockRejectedValueOnce(error);
      play.reply.mockRejectedValueOnce(error);

      const refusal = poster.post('app-1', 'rev-1', 'user-1');
      await expect(refusal).rejects.toBeInstanceOf(ForbiddenException);
      await expect(refusal).rejects.toThrow(REPLY_ROLE_NEEDED[store]);
      expect(connections.markReplyAccess).toHaveBeenCalledWith(
        store,
        'forbidden',
      );
      expect(connections.markRejected).not.toHaveBeenCalled();
      expect(tx.reviewReply.updateMany).not.toHaveBeenCalled();
    },
  );

  it('turns a rejected key into 422 and marks the connection rejected', async () => {
    const { poster, asc, connections, tx } = harness();
    asc.respond.mockRejectedValueOnce(
      new AscRejectedKeyError('revoked', 401, 'NOT_AUTHORIZED'),
    );

    await expect(
      poster.post('app-1', 'rev-1', 'user-1'),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(connections.markRejected).toHaveBeenCalledWith(
      'APP_STORE',
      expect.stringContaining('refused this key'),
    );
    expect(connections.markReplyAccess).not.toHaveBeenCalled();
    expect(tx.reviewReply.updateMany).not.toHaveBeenCalled();
  });

  it('withdraws an app store response and clears both halves', async () => {
    const { poster, asc, writes } = harness({
      postedAt: EDITED,
      storeResponseId: 'response-1',
    });

    await poster.withdraw('app-1', 'rev-1');

    expect(asc.deleteResponse).toHaveBeenCalledWith('response-1');
    expect(writes.reply).toEqual({
      postedAt: null,
      postedText: null,
      postState: null,
      storeResponseId: null,
      postedByUserId: null,
      repliedAt: null,
    });
    expect(writes.review).toEqual({ repliedAt: null, replyText: null });
  });

  it('refuses to withdraw a google play reply with 409', async () => {
    const { poster, connections } = harness({
      store: 'GOOGLE_PLAY',
      postedAt: EDITED,
    });

    await expect(poster.withdraw('app-1', 'rev-1')).rejects.toThrow(
      PLAY_NO_WITHDRAW,
    );
    expect(connections.openPlayPublisher).not.toHaveBeenCalled();
  });

  it('answers 404 when nothing was posted', async () => {
    const { poster, asc } = harness();

    const refusal = poster.withdraw('app-1', 'rev-1');
    await expect(refusal).rejects.toBeInstanceOf(NotFoundException);
    await expect(refusal).rejects.toThrow(NOTHING_POSTED);
    expect(asc.deleteResponse).not.toHaveBeenCalled();
  });
});
