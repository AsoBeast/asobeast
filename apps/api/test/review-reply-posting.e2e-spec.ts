import './helpers/enable-store-connect';
import * as argon2 from 'argon2';
import { Store } from '@prisma/client';
import type {
  ApiErrorEnvelope,
  ReviewList,
  ReviewReplyPostResult,
  StoreConnectionState,
} from '@asobeast/shared';
import request from 'supertest';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import { REVIEW_NOT_IN_APP_STORE_CONNECT } from '../src/reviews/asc-review-locator.service';
import {
  CONNECT_FIRST,
  REPLY_ROLE_NEEDED,
} from '../src/reviews/review-reply-post-errors';
import { PLAY_NO_WITHDRAW } from '../src/reviews/review-reply-poster.service';
import { seedApiToken } from './helpers/api-tokens';
import { ownerAgent } from './helpers/session';
import {
  answer,
  CONNECTION_REQUEST,
  gcsAnswer,
  pauseStoreReports,
  PLAY_CONNECTION_REQUEST,
  refusal,
  startStoreConnectApp,
  type StoreConnectHarness,
} from './helpers/store-connect-harness';
import { clearRateLimitCounters, obliterateQueues } from './obliterate-queues';

const OTHER_WORKSPACE = 'ws_reply_posting_other';
const MEMBER = {
  email: 'member@reply-posting.example.com',
  password: 'membersecret1',
};
const REPLY = 'Thanks for telling us, version 3.5 fixes the crash.';
const ASC_REVIEW_ID = '00000028-b08c-0014-729e-fbd500000001';
const CANDIDATE = {
  type: 'customerReviews',
  id: ASC_REVIEW_ID,
  attributes: {
    rating: 1,
    title: 'Crashes on launch',
    body: 'Every time I open it the app closes.',
    reviewerNickname: 'sleepless',
    createdDate: '2026-09-05T08:12:00-07:00',
    territory: 'USA',
  },
};
const RESPONSE = {
  data: {
    type: 'customerReviewResponses',
    id: 'response-1',
    attributes: {
      responseBody: REPLY,
      lastModifiedDate: '2026-10-20T08:00:00-07:00',
      state: 'PENDING_PUBLISH',
    },
  },
};

interface Target {
  appId: string;
  reviewId: string;
}

describe('Posting review replies (e2e)', () => {
  let harness: StoreConnectHarness;
  let owner: Awaited<ReturnType<typeof ownerAgent>>;
  let appStore: Target;
  let play: Target;

  const postPath = ({ appId, reviewId }: Target) =>
    `/apps/${appId}/reviews/${reviewId}/reply/post`;

  const seedReview = async (
    store: Store,
    storeAppId: string,
    reviewId: string,
    workspaceId = DEFAULT_WORKSPACE_ID,
  ): Promise<Target> => {
    const app = await harness.prisma.app.create({
      data: {
        workspaceId,
        store,
        storeAppId,
        country: 'us',
        name: `${store} app`,
      },
    });
    const review = await harness.prisma.review.create({
      data: {
        appId: app.id,
        reviewId,
        userName: 'sleepless',
        score: 1,
        title: 'Crashes on launch',
        text: 'Every time I open it the app closes.',
        reviewedAt: new Date('2026-09-05T15:12:00Z'),
        replyCheckedAt: store === Store.GOOGLE_PLAY ? new Date() : null,
      },
    });
    await harness.prisma.reviewReply.create({
      data: {
        reviewId: review.id,
        appId: app.id,
        workspaceId,
        text: REPLY,
      },
    });
    return { appId: app.id, reviewId: review.id };
  };

  const connectBoth = async () => {
    await owner
      .put('/store-connections/APP_STORE')
      .send(CONNECTION_REQUEST)
      .expect(200);
    await owner
      .put('/store-connections/GOOGLE_PLAY')
      .send(PLAY_CONNECTION_REQUEST)
      .expect(200);
    harness.asc.reset();
    harness.gcs.reset();
  };

  const scriptApple = () => {
    harness.asc.on(
      'GET',
      /customerReviews/,
      answer({ data: [CANDIDATE], links: {} }),
    );
    harness.asc.on('POST', /customerReviewResponses/, answer(RESPONSE, 201));
    harness.asc.on('DELETE', /customerReviewResponses/, answer(null, 204));
  };

  const scriptGoogle = () => {
    harness.gcs.on(
      'POST',
      /androidpublisher/,
      gcsAnswer({
        result: { replyText: REPLY, lastEdited: { seconds: '1792584000' } },
      }),
    );
  };

  const appleCalls = (method: string, pattern: RegExp) =>
    harness.asc.requests.filter(
      (call) =>
        call.method === method && pattern.test(call.absoluteUrl ?? call.path),
    );

  const listOf = async (appId: string, query = '') =>
    (await owner.get(`/apps/${appId}/reviews${query}`).expect(200))
      .body as ReviewList;

  const replyAccess = async (store: Store) =>
    (
      (await owner.get('/store-connections').expect(200))
        .body as StoreConnectionState
    ).connections.find((item) => item.store === store);

  beforeAll(async () => {
    harness = await startStoreConnectApp();
    await harness.prisma.workspace.upsert({
      where: { id: OTHER_WORKSPACE },
      update: {},
      create: { id: OTHER_WORKSPACE, name: 'Other' },
    });
    owner = await ownerAgent(harness.app);
    await harness.prisma.user.upsert({
      where: { email: MEMBER.email },
      update: { passwordHash: await argon2.hash(MEMBER.password) },
      create: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        email: MEMBER.email,
        passwordHash: await argon2.hash(MEMBER.password),
        role: 'member',
        emailVerifiedAt: new Date(),
      },
    });
  }, 60_000);

  beforeEach(async () => {
    harness.asc.reset();
    harness.gcs.reset();
    await harness.prisma.storeConnection.deleteMany({});
    await harness.prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "App", "Keyword" RESTART IDENTITY CASCADE',
    );
    await obliterateQueues(harness.app);
    await pauseStoreReports(harness.app);
    await clearRateLimitCounters(harness.app);
    appStore = await seedReview(Store.APP_STORE, '1234567890', 'rss-1');
    play = await seedReview(
      Store.GOOGLE_PLAY,
      'com.focus',
      '4f2c1b9e-6d1a-4b7e-9f3a-2c8d5e7a1b00',
    );
  });

  afterAll(async () => {
    await harness.prisma.storeConnection.deleteMany({});
    await harness.prisma.workspace.deleteMany({
      where: { id: OTHER_WORKSPACE },
    });
    await harness.prisma.user.deleteMany({ where: { email: MEMBER.email } });
    await obliterateQueues(harness.app);
    await harness.app.close();
    await harness.prisma.$disconnect();
  });

  it('locates an app store review, posts the kept reply and reads it as replied', async () => {
    await connectBoth();
    scriptApple();
    const before = await listOf(appStore.appId);

    const posted = await owner.post(postPath(appStore)).expect(200);

    const { review } = posted.body as ReviewReplyPostResult;
    expect(review.reply?.post).toMatchObject({
      state: 'pending',
      postedText: REPLY,
      storeResponseId: 'response-1',
      postedBy: 'owner@example.com',
    });
    expect(review.repliedAt).not.toBeNull();
    expect(review.replyText).toBe(REPLY);
    const [list] = appleCalls('GET', /customerReviews/);
    expect(list.path).toContain('/v1/apps/1234567890/customerReviews');
    expect(list.path).toContain('filter[territory]=USA');
    const [created] = appleCalls('POST', /customerReviewResponses/);
    expect(created.body).toMatchObject({
      data: {
        attributes: { responseBody: REPLY },
        relationships: { review: { data: { id: ASC_REVIEW_ID } } },
      },
    });
    const replied = await listOf(appStore.appId, '?replyState=replied');
    expect(replied.reviews.map((each) => each.id)).toEqual([appStore.reviewId]);
    expect(replied.counts.replied).toBe(before.counts.replied + 1);
    await expect(replyAccess(Store.APP_STORE)).resolves.toMatchObject({
      replyAccess: 'allowed',
    });
  });

  it('posts an edited reply again without locating the review', async () => {
    await connectBoth();
    scriptApple();
    await owner.post(postPath(appStore)).expect(200);
    await owner
      .patch(`/apps/${appStore.appId}/reviews/${appStore.reviewId}/reply`)
      .send({ text: 'Fixed in 3.5, thanks for your patience.' })
      .expect(200);
    harness.asc.requests.length = 0;

    const again = await owner.post(postPath(appStore)).expect(200);

    expect(appleCalls('GET', /customerReviews/)).toHaveLength(0);
    expect(appleCalls('POST', /customerReviewResponses/)).toHaveLength(1);
    expect(
      (again.body as ReviewReplyPostResult).review.reply?.post?.postedText,
    ).toBe('Fixed in 3.5, thanks for your patience.');
  });

  it('replies to a google play review by its id and records it as published', async () => {
    await connectBoth();
    scriptGoogle();
    const before = await listOf(play.appId);

    const posted = await owner.post(postPath(play)).expect(200);

    const { review } = posted.body as ReviewReplyPostResult;
    expect(review.reply?.post?.state).toBe('published');
    expect(review.repliedAt).toBe('2026-10-21T12:00:00.000Z');
    const [reply] = harness.gcs.requests.filter((call) =>
      /androidpublisher/.test(call.url),
    );
    expect(reply.url).toContain(
      '/applications/com.focus/reviews/4f2c1b9e-6d1a-4b7e-9f3a-2c8d5e7a1b00:reply',
    );
    expect(reply.json).toEqual({ replyText: REPLY });
    const after = await listOf(play.appId);
    expect(after.counts).toMatchObject({
      drafted: before.counts.drafted - 1,
      replied: before.counts.replied + 1,
    });
    const row = await harness.prisma.review.findUniqueOrThrow({
      where: { id: play.reviewId },
    });
    expect(row.repliedAt).toEqual(new Date('2026-10-21T12:00:00.000Z'));
  });

  it('answers 409 naming settings without a connection and calls no store', async () => {
    const refused = await owner.post(postPath(appStore)).expect(409);

    expect((refused.body as ApiErrorEnvelope).message).toBe(
      CONNECT_FIRST.APP_STORE,
    );
    await owner.post(postPath(play)).expect(409);
    expect(harness.asc.requests).toEqual([]);
    expect(harness.gcs.requests).toEqual([]);
  });

  it('names the cloud project of a disabled android publisher api and leaves reply access alone', async () => {
    await connectBoth();
    const disabled =
      'Google Play Android Developer API has not been used in project 1076421972429 before or it is disabled. Enable it by visiting https://console.developers.google.com/apis/api/androidpublisher.googleapis.com/overview?project=1076421972429 then retry.';
    harness.gcs.on(
      'POST',
      /androidpublisher/,
      gcsAnswer(
        {
          error: {
            code: 403,
            message: disabled,
            errors: [{ reason: 'accessNotConfigured', message: disabled }],
            status: 'PERMISSION_DENIED',
            details: [
              {
                '@type': 'type.googleapis.com/google.rpc.ErrorInfo',
                reason: 'SERVICE_DISABLED',
                metadata: { consumer: 'projects/1076421972429' },
              },
            ],
          },
        },
        403,
      ),
    );

    const refused = await owner.post(postPath(play)).expect(409);

    expect((refused.body as ApiErrorEnvelope).message).toContain(
      'Google Cloud project 1076421972429',
    );
    expect((refused.body as ApiErrorEnvelope).message).not.toContain(
      'Reply to reviews permission',
    );
    await expect(replyAccess(Store.GOOGLE_PLAY)).resolves.toMatchObject({
      status: 'active',
      replyAccess: 'unknown',
    });
  });

  it('answers 403 with the role a key needs and remembers it, keeping the connection active', async () => {
    await connectBoth();
    scriptApple();
    harness.asc.on(
      'POST',
      /customerReviewResponses/,
      refusal(403, 'FORBIDDEN_ERROR'),
    );

    const refused = await owner.post(postPath(appStore)).expect(403);

    expect((refused.body as ApiErrorEnvelope).message).toBe(
      REPLY_ROLE_NEEDED.APP_STORE,
    );
    await expect(replyAccess(Store.APP_STORE)).resolves.toMatchObject({
      status: 'active',
      replyAccess: 'forbidden',
    });
  });

  it("answers 422 with apple's words and leaves the reply unposted", async () => {
    await connectBoth();
    scriptApple();
    harness.asc.on(
      'POST',
      /customerReviewResponses/,
      refusal(409, 'ENTITY_ERROR'),
    );

    const refused = await owner.post(postPath(appStore)).expect(422);

    expect((refused.body as ApiErrorEnvelope).message).toBe(
      'App Store Connect refused the reply: ENTITY_ERROR',
    );
    const row = await harness.prisma.reviewReply.findUniqueOrThrow({
      where: { reviewId: appStore.reviewId },
    });
    expect(row.postedAt).toBeNull();
  });

  it('answers 404 when no app store connect review matches', async () => {
    await connectBoth();
    harness.asc.on('GET', /customerReviews/, answer({ data: [], links: {} }));

    const missing = await owner.post(postPath(appStore)).expect(404);

    expect((missing.body as ApiErrorEnvelope).message).toBe(
      REVIEW_NOT_IN_APP_STORE_CONNECT,
    );
  });

  it('withdraws an app store response and keeps the text, and refuses on google play', async () => {
    await connectBoth();
    scriptApple();
    scriptGoogle();
    await owner.post(postPath(appStore)).expect(200);

    const withdrawn = await owner.delete(postPath(appStore)).expect(200);

    const { review } = withdrawn.body as ReviewReplyPostResult;
    expect(review.reply).toMatchObject({
      text: REPLY,
      post: null,
      repliedAt: null,
    });
    expect(review.repliedAt).toBeNull();
    expect(review.replyText).toBeNull();
    const [deleted] = appleCalls('DELETE', /customerReviewResponses/);
    expect(deleted.path).toBe('/v1/customerReviewResponses/response-1');
    await owner.delete(postPath(appStore)).expect(404);

    await owner.post(postPath(play)).expect(200);
    const refused = await owner.delete(postPath(play)).expect(409);
    expect((refused.body as ApiErrorEnvelope).message).toBe(PLAY_NO_WITHDRAW);
  });

  it('lets a member post and withdraw, and refuses a write token', async () => {
    await connectBoth();
    scriptApple();
    const member = request.agent(harness.app.getHttpServer());
    await member.post('/auth/login').send(MEMBER).expect(200);

    const posted = await member.post(postPath(appStore)).expect(200);
    expect(
      (posted.body as ReviewReplyPostResult).review.reply?.post?.postedBy,
    ).toBe(MEMBER.email);
    await member.delete(postPath(appStore)).expect(200);

    const token = await seedApiToken(harness.prisma, {
      seed: 'replyposter',
      email: 'owner@example.com',
      workspaceId: DEFAULT_WORKSPACE_ID,
      role: 'owner',
      scope: 'write',
    });
    harness.asc.requests.length = 0;
    for (const method of ['post', 'delete'] as const) {
      await request(harness.app.getHttpServer())
        [method](postPath(appStore))
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    }
    expect(harness.asc.requests).toEqual([]);
  });

  it('answers 404 for a review of another workspace before any store request', async () => {
    await connectBoth();
    scriptApple();
    const foreign = await seedReview(
      Store.APP_STORE,
      '999',
      'rss-foreign',
      OTHER_WORKSPACE,
    );

    await owner.post(postPath(foreign)).expect(404);
    await owner
      .post(postPath({ ...appStore, reviewId: foreign.reviewId }))
      .expect(404);
    expect(harness.asc.requests).toEqual([]);
  });
});
