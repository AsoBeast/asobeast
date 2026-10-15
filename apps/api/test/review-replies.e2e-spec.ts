import { execSync } from 'child_process';
import { join } from 'path';
import { INestApplication, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient, Store } from '@prisma/client';
import {
  countChars,
  type ApiErrorEnvelope,
  type ReviewList,
  type ReviewReplyDraftResult,
  type ReviewReplyItem,
} from '@asobeast/shared';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { aiCompletion } from '../src/ai/ai-completion.fixture';
import {
  AiClient,
  AiCompletion,
  AiStructuredRequest,
  OPENAI_CLIENT,
} from '../src/ai/openai.client';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import { ReviewRepliesService } from '../src/reviews/review-replies.service';
import { seedApiToken } from './helpers/api-tokens';
import { ownerAgent, useCookies } from './helpers/session';
import { asWorkspace } from './helpers/tenancy';
import { testDb } from './helpers/test-db';
import {
  clearRateLimitCounters,
  obliterateQueues,
  settleBootRegistration,
} from './obliterate-queues';

const OTHER_WORKSPACE = 'ws_replies_other';
const USAGE = { inputTokens: 900, cachedInputTokens: 0, outputTokens: 120 };
const DRAFT = {
  reply: 'Thanks Jordan, sorry about the crash. Version 3.5.0 fixes it.',
  language: 'en',
};

const structured = jest.fn<Promise<AiCompletion>, [AiStructuredRequest]>();
const fakeAiClient: AiClient = { model: 'gpt-test', structured };

describe('Review replies (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let api: Awaited<ReturnType<typeof ownerAgent>>;
  let readToken: string;
  let appStore: { appId: string; reviewId: string };
  let play: { appId: string; reviewId: string };

  const seedApp = async (store: Store, storeAppId: string) => {
    const created = await prisma.app.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store,
        storeAppId,
        country: 'us',
        name: `${store} app`,
      },
    });
    const review = await prisma.review.create({
      data: {
        appId: created.id,
        reviewId: `${storeAppId}-review`,
        userName: 'Jordan',
        score: 1,
        text: 'Crashes on launch',
        version: '3.4.0',
        reviewedAt: new Date('2026-10-01T00:00:00Z'),
      },
    });
    return { appId: created.id, reviewId: review.id };
  };

  const replyPath = (target: { appId: string; reviewId: string }) =>
    `/apps/${target.appId}/reviews/${target.reviewId}/reply`;

  const listOf = async (appId: string) =>
    (await api.get(`/apps/${appId}/reviews`).expect(200)).body as ReviewList;

  beforeAll(async () => {
    execSync('pnpm prisma migrate deploy', {
      cwd: join(__dirname, '..'),
      env: process.env,
      stdio: 'ignore',
    });
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(OPENAI_CLIENT)
      .useValue(fakeAiClient)
      .compile();
    app = moduleFixture.createNestApplication();
    useCookies(app);
    await app.init();
    await settleBootRegistration(app);
    prisma = testDb();
    await prisma.workspace.upsert({
      where: { id: DEFAULT_WORKSPACE_ID },
      update: {},
      create: { id: DEFAULT_WORKSPACE_ID, name: 'Default' },
    });
    await prisma.workspace.upsert({
      where: { id: OTHER_WORKSPACE },
      update: {},
      create: { id: OTHER_WORKSPACE, name: 'Other' },
    });
    api = await ownerAgent(app);
    readToken = await seedApiToken(prisma, {
      seed: 'replyreader',
      email: 'reply-reader@example.com',
      workspaceId: DEFAULT_WORKSPACE_ID,
      role: 'member',
      scope: 'read',
    });
  });

  beforeEach(async () => {
    structured.mockReset();
    structured.mockResolvedValue(aiCompletion(DRAFT, USAGE));
    await prisma.aiCall.deleteMany();
    await clearRateLimitCounters(app);
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "App", "Keyword" RESTART IDENTITY CASCADE',
    );
    appStore = await seedApp(Store.APP_STORE, '111');
    play = await seedApp(Store.GOOGLE_PLAY, 'com.example.replies');
  });

  afterAll(async () => {
    await prisma.aiCall.deleteMany();
    await prisma.user.deleteMany({
      where: { email: 'reply-reader@example.com' },
    });
    await prisma.workspace.deleteMany({ where: { id: OTHER_WORKSPACE } });
    await prisma.$disconnect();
    await obliterateQueues(app);
    await app.close();
  });

  it('saves a reply written by hand', async () => {
    const saved = await api
      .patch(replyPath(appStore))
      .send({ text: 'Thanks for the report' })
      .expect(200);

    expect(saved.body as ReviewReplyItem).toMatchObject({
      text: 'Thanks for the report',
      tone: null,
      model: null,
      generatedAt: null,
      repliedAt: null,
    });
    const list = await listOf(appStore.appId);
    expect(list.reviews[0].reply?.text).toBe('Thanks for the report');
    expect(list.counts?.drafted).toBe(1);
  });

  it('marks and unmarks a review', async () => {
    await api
      .patch(replyPath(appStore))
      .send({ text: 'Thanks for the report' })
      .expect(200);

    const marked = await api
      .patch(replyPath(appStore))
      .send({ replied: true })
      .expect(200);
    expect((marked.body as ReviewReplyItem).repliedAt).not.toBeNull();
    expect((marked.body as ReviewReplyItem).text).toBe('Thanks for the report');
    expect((await listOf(appStore.appId)).counts?.replied).toBe(1);

    const unmarked = await api
      .patch(replyPath(appStore))
      .send({ replied: false })
      .expect(200);
    expect((unmarked.body as ReviewReplyItem).repliedAt).toBeNull();
    expect((await listOf(appStore.appId)).counts?.drafted).toBe(1);
  });

  it('marks a review the owner answered in the console without keeping text', async () => {
    const marked = await api
      .patch(replyPath(appStore))
      .send({ replied: true })
      .expect(200);
    expect(marked.body as ReviewReplyItem).toMatchObject({ text: '' });
    expect((marked.body as ReviewReplyItem).repliedAt).not.toBeNull();

    await api.patch(replyPath(appStore)).send({ replied: false }).expect(200);

    expect((await listOf(appStore.appId)).reviews[0].reply).toBeNull();
  });

  it('holds a google play reply to 350 characters', async () => {
    const text = 'a'.repeat(351);

    const refused = await api.patch(replyPath(play)).send({ text }).expect(400);
    expect((refused.body as ApiErrorEnvelope).message).toContain('350');
    await api.patch(replyPath(appStore)).send({ text }).expect(200);
  });

  it('refuses an empty reply and an unknown field', async () => {
    await api.patch(replyPath(appStore)).send({ text: '' }).expect(400);
    await api.patch(replyPath(appStore)).send({ posted: true }).expect(400);
    await api.patch(replyPath(appStore)).send({}).expect(400);
  });

  it('discards a reply', async () => {
    await api
      .patch(replyPath(appStore))
      .send({ text: 'Thanks for the report' })
      .expect(200);

    await api.delete(replyPath(appStore)).expect(204);
    await api.delete(replyPath(appStore)).expect(204);

    expect((await listOf(appStore.appId)).reviews[0].reply).toBeNull();
  });

  it('answers 404 for a review of another app', async () => {
    await api
      .patch(replyPath({ appId: appStore.appId, reviewId: play.reviewId }))
      .send({ text: 'Wrong app' })
      .expect(404);
  });

  it('answers 404 across workspaces', async () => {
    await api
      .patch(replyPath(appStore))
      .send({ text: 'Thanks for the report' })
      .expect(200);
    const replies = app.get(ReviewRepliesService);

    await expect(
      asWorkspace(
        app,
        () => replies.patch(appStore.appId, appStore.reviewId, { text: 'x' }),
        OTHER_WORKSPACE,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      asWorkspace(
        app,
        () => replies.remove(appStore.appId, appStore.reviewId),
        OTHER_WORKSPACE,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      prisma.reviewReply.findUniqueOrThrow({
        where: { reviewId: appStore.reviewId },
      }),
    ).resolves.toMatchObject({ text: 'Thanks for the report' });
  });

  it('refuses a read scoped token', async () => {
    await request(app.getHttpServer())
      .patch(replyPath(appStore))
      .set('Authorization', `Bearer ${readToken}`)
      .send({ text: 'Read only' })
      .expect(403);
  });

  describe('reply guidelines', () => {
    const guidelinesPath = (appId: string) =>
      `/apps/${appId}/reviews/reply-guidelines`;

    it('keeps reply guidelines per app', async () => {
      const text = 'Support: help@example.com. Never promise a date.';
      await api
        .get(guidelinesPath(appStore.appId))
        .expect(200, { guidelines: '' });

      await api
        .put(guidelinesPath(appStore.appId))
        .send({ guidelines: text })
        .expect(200, { guidelines: text });
      await api
        .get(guidelinesPath(appStore.appId))
        .expect(200, { guidelines: text });
      await api
        .put(guidelinesPath(appStore.appId))
        .send({ guidelines: '' })
        .expect(200, { guidelines: '' });
      await api
        .get(guidelinesPath(appStore.appId))
        .expect(200, { guidelines: '' });
    });

    it('holds the guidelines to 1,000 characters', async () => {
      await api
        .put(guidelinesPath(appStore.appId))
        .send({ guidelines: 'a'.repeat(1001) })
        .expect(400);
    });

    it('keeps the guidelines of one app out of another', async () => {
      await api
        .put(guidelinesPath(appStore.appId))
        .send({ guidelines: 'Sign as the team.' })
        .expect(200);

      await api.get(guidelinesPath(play.appId)).expect(200, { guidelines: '' });
    });

    it('answers 404 across workspaces', async () => {
      const replies = app.get(ReviewRepliesService);

      await expect(
        asWorkspace(
          app,
          () => replies.guidelines(appStore.appId),
          OTHER_WORKSPACE,
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
      await expect(
        asWorkspace(
          app,
          () => replies.setGuidelines(appStore.appId, 'Hijacked'),
          OTHER_WORKSPACE,
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
      await expect(
        prisma.app.findUniqueOrThrow({
          where: { id: appStore.appId },
          select: { replyGuidelines: true },
        }),
      ).resolves.toEqual({ replyGuidelines: null });
    });
  });

  describe('ai drafts', () => {
    const draftPath = (target: { appId: string; reviewId: string }) =>
      `${replyPath(target)}/draft`;

    const seedSnapshot = (appId: string) =>
      prisma.appSnapshot.create({
        data: {
          appId,
          title: 'Mine',
          description: 'Track your focus.',
          version: '3.5.0',
          raw: { releaseNotes: 'Fixed the launch crash.' },
        },
      });

    it('drafts a reply and keeps it on the review', async () => {
      const drafted = await api
        .post(draftPath(appStore))
        .send({ tone: 'friendly' })
        .expect(201);

      const body = drafted.body as ReviewReplyDraftResult;
      expect(body).toMatchObject({
        reply: {
          text: DRAFT.reply,
          tone: 'friendly',
          model: 'gpt-test',
          repliedAt: null,
        },
        language: 'en',
        truncated: false,
      });
      expect(body.reply.generatedAt).not.toBeNull();
      await expect(
        prisma.aiCall.count({
          where: { feature: 'reviewReply', status: 'counted' },
        }),
      ).resolves.toBe(1);
      expect((await listOf(appStore.appId)).counts?.drafted).toBe(1);
    });

    it('sends the review, the guidelines and the release notes and never another app', async () => {
      await seedSnapshot(appStore.appId);
      await api
        .put(`/apps/${appStore.appId}/reviews/reply-guidelines`)
        .send({ guidelines: 'Sign as the Mine team.' })
        .expect(200);

      await api.post(draftPath(appStore)).send({}).expect(201);

      const [request] = structured.mock.calls[0];
      const [part] = request.content;
      const text = part.type === 'text' ? part.text : '';
      expect(request.system).toContain('SECURITY');
      expect(text).toContain('Crashes on launch');
      expect(text).toContain('Sign as the Mine team.');
      expect(text).toContain('Current version: 3.5.0');
      expect(text).toContain('Fixed the launch crash.');
      expect(text).not.toContain('GOOGLE_PLAY app');
    });

    it('fits a google play draft to 350 characters', async () => {
      structured.mockResolvedValue(
        aiCompletion(
          { reply: `${'a'.repeat(300)}. ${'b'.repeat(98)}.`, language: 'en' },
          USAGE,
        ),
      );

      const drafted = await api.post(draftPath(play)).send({}).expect(201);

      const body = drafted.body as ReviewReplyDraftResult;
      expect(body.truncated).toBe(true);
      expect(countChars(body.reply.text)).toBeLessThanOrEqual(350);
    });

    it("keeps the owner's mark when redrafting", async () => {
      const marked = await api
        .patch(replyPath(appStore))
        .send({ text: 'Handwritten', replied: true })
        .expect(200);

      const drafted = await api.post(draftPath(appStore)).send({}).expect(201);

      expect((drafted.body as ReviewReplyDraftResult).reply.repliedAt).toBe(
        (marked.body as ReviewReplyItem).repliedAt,
      );
    });

    it('refuses an unknown tone and over long instructions', async () => {
      await api.post(draftPath(appStore)).send({ tone: 'angry' }).expect(400);
      await api
        .post(draftPath(appStore))
        .send({ instructions: 'a'.repeat(501) })
        .expect(400);

      expect(structured).not.toHaveBeenCalled();
    });

    it('answers 404 across workspaces before spending', async () => {
      await api
        .post(draftPath({ appId: appStore.appId, reviewId: play.reviewId }))
        .send({})
        .expect(404);

      expect(structured).not.toHaveBeenCalled();
      await expect(prisma.aiCall.count()).resolves.toBe(0);
    });

    it('refuses a read scoped token with 403', async () => {
      await request(app.getHttpServer())
        .post(draftPath(appStore))
        .set('Authorization', `Bearer ${readToken}`)
        .send({})
        .expect(403);

      expect(structured).not.toHaveBeenCalled();
    });
  });
});
