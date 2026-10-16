import { execSync } from 'child_process';
import { join } from 'path';
import { INestApplication, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient, Store } from '@prisma/client';
import {
  REVIEW_REPLY_GUIDELINES_MAX,
  REVIEW_REPLY_INSTRUCTIONS_MAX,
  REVIEW_REPLY_LIMITS,
  type ApiErrorEnvelope,
  type ReviewList,
  type ReviewReplyDraftResult,
  type ReviewReplyItem,
  type ReviewTranslation,
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
import { ReviewReplyAssistant } from '../src/reviews/review-reply-assistant.service';
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
    const text = 'a'.repeat(REVIEW_REPLY_LIMITS.GOOGLE_PLAY + 1);

    const refused = await api.patch(replyPath(play)).send({ text }).expect(400);
    expect((refused.body as ApiErrorEnvelope).message).toContain('350');
    await api.patch(replyPath(appStore)).send({ text }).expect(200);
  });

  it('holds an app store reply to 2000 characters', async () => {
    await api
      .patch(replyPath(appStore))
      .send({ text: 'a'.repeat(REVIEW_REPLY_LIMITS.APP_STORE) })
      .expect(200);
    const refused = await api
      .patch(replyPath(appStore))
      .send({ text: 'a'.repeat(REVIEW_REPLY_LIMITS.APP_STORE + 1) })
      .expect(400);

    expect((refused.body as ApiErrorEnvelope).message).toContain('2000');
  });

  it('refuses an empty reply and an unknown field', async () => {
    await api.patch(replyPath(appStore)).send({ text: '' }).expect(400);
    await api.patch(replyPath(appStore)).send({ posted: true }).expect(400);
    await api.patch(replyPath(appStore)).send({}).expect(400);
  });

  it('refuses a null replied mark that holds no text', async () => {
    const refused = await api
      .patch(replyPath(appStore))
      .send({ replied: null })
      .expect(400);

    expect((refused.body as ApiErrorEnvelope).message).toBe(
      'Send the reply text or a replied mark',
    );
    expect((await listOf(appStore.appId)).reviews[0].reply).toBeNull();
    expect(await prisma.reviewReply.count()).toBe(0);

    const blank = await api
      .patch(replyPath(appStore))
      .send({ text: '   ', replied: null })
      .expect(400);
    expect((blank.body as ApiErrorEnvelope).message).toBe(
      'A reply needs some text',
    );
    await api
      .patch(replyPath(appStore))
      .send({ text: null, replied: null })
      .expect(400);
    expect(await prisma.reviewReply.count()).toBe(0);
  });

  it('keeps saving text that arrives with a null replied mark', async () => {
    const saved = await api
      .patch(replyPath(appStore))
      .send({ text: 'Thanks for the report', replied: null })
      .expect(200);

    expect((saved.body as ReviewReplyItem).text).toBe('Thanks for the report');
    expect((await listOf(appStore.appId)).counts?.drafted).toBe(1);
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
    await api
      .delete(replyPath({ appId: appStore.appId, reviewId: play.reviewId }))
      .expect(404);
    await api
      .delete(replyPath({ appId: appStore.appId, reviewId: 'unknown' }))
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

  it('refuses a read scoped token on every reply write', async () => {
    await api.patch(replyPath(appStore)).send({ text: 'Kept' }).expect(200);
    const asReader = (test: request.Test) =>
      test.set('Authorization', `Bearer ${readToken}`).expect(403);
    const server = request(app.getHttpServer());

    await asReader(server.patch(replyPath(appStore)).send({ text: 'Read' }));
    await asReader(server.delete(replyPath(appStore)));
    await asReader(
      server
        .put(`/apps/${appStore.appId}/reviews/reply-guidelines`)
        .send({ guidelines: 'Read' }),
    );

    await expect(
      prisma.reviewReply.findUniqueOrThrow({
        where: { reviewId: appStore.reviewId },
      }),
    ).resolves.toMatchObject({ text: 'Kept' });
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
        .send({ guidelines: 'a'.repeat(REVIEW_REPLY_GUIDELINES_MAX + 1) })
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

      const [aiRequest] = structured.mock.calls[0];
      const [part] = aiRequest.content;
      const text = part.type === 'text' ? part.text : '';
      const block = text.indexOf('REFERENCE DATA');
      const end = text.indexOf('END OF REFERENCE DATA');
      expect(aiRequest.system).toContain('SECURITY');
      expect(text).toContain('Current version: "3.5.0"');
      expect(text.indexOf('Sign as the Mine team.')).toBeLessThan(block);
      for (const untrusted of [
        'Crashes on launch',
        'Fixed the launch crash.',
      ]) {
        expect(text.indexOf(untrusted)).toBeGreaterThan(block);
        expect(text.indexOf(untrusted)).toBeLessThan(end);
      }
      expect(text).not.toContain('com.example.replies');
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
      expect(body.reply.text).toBe(`${'a'.repeat(300)}.`);
    });

    it('refuses a draft with an address the owner never gave and keeps the call counted', async () => {
      structured.mockResolvedValue(
        aiCompletion(
          { reply: 'Sorry! Write to refunds@evil.example.', language: 'en' },
          USAGE,
        ),
      );

      await api.post(draftPath(appStore)).send({}).expect(502);

      await expect(prisma.reviewReply.count()).resolves.toBe(0);
      await expect(
        prisma.aiCall.count({
          where: { feature: 'reviewReply', status: 'counted' },
        }),
      ).resolves.toBe(1);
    });

    it('keeps a draft whose address the guidelines give', async () => {
      structured.mockResolvedValue(
        aiCompletion(
          { reply: 'Sorry! Write to help@mine.app.', language: 'en' },
          USAGE,
        ),
      );
      await api
        .put(`/apps/${appStore.appId}/reviews/reply-guidelines`)
        .send({ guidelines: 'Support: help@mine.app' })
        .expect(200);

      await api.post(draftPath(appStore)).send({}).expect(201);
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
        .send({ instructions: 'a'.repeat(REVIEW_REPLY_INSTRUCTIONS_MAX + 1) })
        .expect(400);

      expect(structured).not.toHaveBeenCalled();
    });

    it('answers 404 for a review of another app before spending', async () => {
      await api
        .post(draftPath({ appId: appStore.appId, reviewId: play.reviewId }))
        .send({})
        .expect(404);

      expect(structured).not.toHaveBeenCalled();
      await expect(prisma.aiCall.count()).resolves.toBe(0);
    });

    it('answers 404 across workspaces before spending', async () => {
      await expect(
        asWorkspace(
          app,
          () =>
            app
              .get(ReviewReplyAssistant)
              .draft(appStore.appId, appStore.reviewId, {}, 'user-1'),
          OTHER_WORKSPACE,
        ),
      ).rejects.toBeInstanceOf(NotFoundException);

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

  describe('translation', () => {
    const TRANSLATED = {
      title: '',
      text: 'Se bloquea al abrir',
      sourceLanguage: 'en',
    };
    const translationPath = (target: { appId: string; reviewId: string }) =>
      `/apps/${target.appId}/reviews/${target.reviewId}/translation`;

    it('translates once, keeps it on the review and answers it again for free', async () => {
      structured.mockResolvedValue(aiCompletion(TRANSLATED, USAGE));

      const first = await api
        .post(translationPath(appStore))
        .send({ language: 'es' })
        .expect(201);
      const again = await api
        .post(translationPath(appStore))
        .send({ language: 'es' })
        .expect(201);

      expect(first.body as ReviewTranslation).toMatchObject({
        language: 'es',
        sourceLanguage: 'en',
        title: null,
        text: 'Se bloquea al abrir',
      });
      expect(again.body).toEqual(first.body);
      expect(structured).toHaveBeenCalledTimes(1);
      await expect(
        prisma.aiCall.count({
          where: { feature: 'reviewTranslation', status: 'counted' },
        }),
      ).resolves.toBe(1);
      const [listed] = (await listOf(appStore.appId)).reviews;
      expect(listed.translation).toEqual(first.body);
    });

    it('refuses a malformed or unknown language and a review without text before spending', async () => {
      const blank = await prisma.review.create({
        data: { appId: appStore.appId, reviewId: 'blank', score: 4, text: ' ' },
      });

      await api
        .post(translationPath(appStore))
        .send({ language: 'en-US' })
        .expect(400);
      await api
        .post(translationPath(appStore))
        .send({ language: 'qq' })
        .expect(400);
      await api
        .post(translationPath({ appId: appStore.appId, reviewId: blank.id }))
        .send({ language: 'es' })
        .expect(400);

      expect(structured).not.toHaveBeenCalled();
      await expect(prisma.aiCall.count()).resolves.toBe(0);
    });

    it('answers 404 for a review of another app before spending', async () => {
      await api
        .post(
          translationPath({ appId: appStore.appId, reviewId: play.reviewId }),
        )
        .send({ language: 'es' })
        .expect(404);

      expect(structured).not.toHaveBeenCalled();
    });

    it('refuses a read scoped token with 403', async () => {
      await request(app.getHttpServer())
        .post(translationPath(appStore))
        .set('Authorization', `Bearer ${readToken}`)
        .send({ language: 'es' })
        .expect(403);

      expect(structured).not.toHaveBeenCalled();
    });
  });
});
