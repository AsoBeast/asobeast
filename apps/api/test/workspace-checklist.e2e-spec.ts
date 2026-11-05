import './helpers/enable-store-connect';
import { execSync } from 'child_process';
import { join } from 'path';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient, Store } from '@prisma/client';
import type {
  WorkspaceChecklist,
  WorkspaceChecklistItem,
  WorkspaceChecklistItemId,
} from '@asobeast/shared';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import { seedApiToken, seedWorkspace } from './helpers/api-tokens';
import { ownerAgent, useCookies } from './helpers/session';
import { testDb } from './helpers/test-db';
import { obliterateQueues, pauseQueues } from './obliterate-queues';

describe('Workspace checklist (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let api: Awaited<ReturnType<typeof ownerAgent>>;
  let readToken: string;
  let writeToken: string;
  let created = 0;

  beforeAll(async () => {
    execSync('pnpm prisma migrate deploy', {
      cwd: join(__dirname, '..'),
      env: process.env,
      stdio: 'ignore',
    });
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    useCookies(app);
    await app.init();
    await pauseQueues(app);

    prisma = testDb();
    await seedWorkspace(prisma, DEFAULT_WORKSPACE_ID, 'Default');
    api = await ownerAgent(app);
    readToken = await seedApiToken(prisma, {
      seed: 'checklistread',
      email: 'checklist-reader@example.com',
      workspaceId: DEFAULT_WORKSPACE_ID,
      role: 'member',
    });
    writeToken = await seedApiToken(prisma, {
      seed: 'checklistwrite',
      email: 'checklist-writer@example.com',
      workspaceId: DEFAULT_WORKSPACE_ID,
      role: 'member',
      scope: 'write',
    });
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "App", "Keyword", "Webhook", "EmailAlert", "StoreConnection" RESTART IDENTITY CASCADE',
    );
    await prisma.apiToken.updateMany({ data: { lastUsedAt: null } });
    await prisma.workspace.update({
      where: { id: DEFAULT_WORKSPACE_ID },
      data: { checklistGoal: null, checklistDismissedAt: null },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await obliterateQueues(app);
    await app.close();
  });

  const createApp = (
    overrides: { store?: Store; primaryAppId?: string } = {},
  ) => {
    created += 1;
    return prisma.app.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store: overrides.store ?? Store.APP_STORE,
        storeAppId: `55500${created}`,
        country: 'us',
        name: `Checklist app ${created}`,
        isCompetitor: overrides.primaryAppId !== undefined,
        primaryAppId: overrides.primaryAppId,
        createdAt: new Date(Date.UTC(2026, 10, 1, 0, 0, created)),
      },
    });
  };

  const track = async (appId: string, country: string, active = true) => {
    const keyword = await prisma.keyword.upsert({
      where: {
        text_store_country: { text: 'focus', store: Store.APP_STORE, country },
      },
      update: {},
      create: { text: 'focus', store: Store.APP_STORE, country },
    });
    await prisma.trackedKeyword.create({
      data: { appId, keywordId: keyword.id, source: 'MANUAL', active },
    });
  };

  const read = async () =>
    (await api.get('/workspace/checklist').expect(200))
      .body as WorkspaceChecklist;

  const patch = async (body: object) =>
    (await api.patch('/workspace/checklist').send(body).expect(200))
      .body as WorkspaceChecklist;

  const stored = () =>
    prisma.workspace.findUniqueOrThrow({
      where: { id: DEFAULT_WORKSPACE_ID },
      select: { checklistGoal: true, checklistDismissedAt: true },
    });

  const itemOf = async (
    id: WorkspaceChecklistItemId,
  ): Promise<WorkspaceChecklistItem | undefined> =>
    (await read()).items.find((item) => item.id === id);

  const ids = (checklist: WorkspaceChecklist) =>
    checklist.items.map((item) => item.id);

  const EMPTY_ORDER = [
    'import_app',
    'second_market',
    'add_competitor',
    'connect_console',
    'connect_ai_client',
    'turn_on_alert',
    'fill_keyword_field',
  ];

  it('answers an empty checklist for a workspace that chose nothing', async () => {
    const checklist = await read();

    expect(checklist.goal).toBeNull();
    expect(checklist.dismissedAt).toBeNull();
    expect(checklist.done).toBe(0);
    expect(checklist.total).toBe(7);
    expect(ids(checklist)).toEqual(EMPTY_ORDER);
    expect(checklist.items.every((item) => item.appId === null)).toBe(true);
  });

  it('reads an upgraded workspace row as no goal and visible', async () => {
    await prisma.$executeRawUnsafe(
      `UPDATE "Workspace" SET "checklistGoal" = NULL, "checklistDismissedAt" = NULL WHERE "id" = '${DEFAULT_WORKSPACE_ID}'`,
    );

    const checklist = await read();

    expect(checklist.goal).toBeNull();
    expect(checklist.dismissedAt).toBeNull();
    expect(ids(checklist)).toEqual(EMPTY_ORDER);
  });

  it('marks the import done and targets the oldest app', async () => {
    const first = await createApp();
    await createApp();

    await expect(itemOf('import_app')).resolves.toMatchObject({
      done: true,
      appId: first.id,
    });
  });

  it('counts the active markets of one app for a second market', async () => {
    const first = await createApp();
    const second = await createApp();
    await track(first.id, 'us');
    await track(first.id, 'de');
    await track(second.id, 'us');
    await track(second.id, 'fr', false);

    await expect(itemOf('second_market')).resolves.toMatchObject({
      done: true,
      appId: second.id,
    });
  });

  it('leaves the second market open when the other market is paused', async () => {
    const only = await createApp();
    await track(only.id, 'us');
    await track(only.id, 'fr', false);

    await expect(itemOf('second_market')).resolves.toMatchObject({
      done: false,
      appId: only.id,
    });
  });

  it('marks a competitor and targets the oldest app without one', async () => {
    const first = await createApp();
    const second = await createApp();
    await createApp({ primaryAppId: second.id });

    await expect(itemOf('add_competitor')).resolves.toMatchObject({
      done: true,
      appId: first.id,
    });
    await expect(itemOf('import_app')).resolves.toMatchObject({
      appId: first.id,
    });
  });

  it('marks the keyword field only when a saved field holds phrases', async () => {
    const appStore = await createApp();
    await prisma.keywordField.create({
      data: {
        appId: appStore.id,
        workspaceId: DEFAULT_WORKSPACE_ID,
        localization: 'en-GB',
        phrases: [],
      },
    });

    await expect(itemOf('fill_keyword_field')).resolves.toMatchObject({
      done: false,
      appId: appStore.id,
    });

    await prisma.keywordField.create({
      data: {
        appId: appStore.id,
        workspaceId: DEFAULT_WORKSPACE_ID,
        localization: 'en-US',
        phrases: ['focus'],
      },
    });

    await expect(itemOf('fill_keyword_field')).resolves.toMatchObject({
      done: true,
      appId: appStore.id,
    });
  });

  it('leaves the keyword field out of a Google Play workspace', async () => {
    await createApp({ store: Store.GOOGLE_PLAY });

    const checklist = await read();

    expect(ids(checklist)).not.toContain('fill_keyword_field');
    expect(checklist.total).toBe(6);
  });

  it('counts an active webhook or a confirmed active email alert', async () => {
    await prisma.webhook.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        url: 'https://hooks.example.com/paused',
        active: false,
      },
    });
    await prisma.emailAlert.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        email: 'waiting@example.com',
        active: true,
      },
    });
    await expect(itemOf('turn_on_alert')).resolves.toMatchObject({
      done: false,
      appId: null,
    });

    await prisma.emailAlert.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        email: 'confirmed@example.com',
        active: true,
        confirmedAt: new Date(),
      },
    });
    await expect(itemOf('turn_on_alert')).resolves.toMatchObject({
      done: true,
    });

    await prisma.emailAlert.deleteMany();
    await prisma.webhook.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        url: 'https://hooks.example.com/live',
      },
    });
    await expect(itemOf('turn_on_alert')).resolves.toMatchObject({
      done: true,
    });
  });

  it('marks the console only for an active connection', async () => {
    await prisma.storeConnection.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store: Store.APP_STORE,
        issuerId: 'issuer',
        keyId: 'key',
        keyFingerprint: 'fingerprint',
        credentialCiphertext: 'sealed',
        status: 'rejected',
      },
    });
    await expect(itemOf('connect_console')).resolves.toMatchObject({
      done: false,
      appId: null,
    });

    await prisma.storeConnection.updateMany({ data: { status: 'active' } });
    await expect(itemOf('connect_console')).resolves.toMatchObject({
      done: true,
    });
  });

  it('marks the AI client once a token has been used', async () => {
    await expect(itemOf('connect_ai_client')).resolves.toMatchObject({
      done: false,
      appId: null,
    });

    const viaToken = await request(app.getHttpServer())
      .get('/workspace/checklist')
      .set('Authorization', `Bearer ${readToken}`)
      .expect(200);
    const fromToken = (viaToken.body as WorkspaceChecklist).items.find(
      (item) => item.id === 'connect_ai_client',
    );

    expect(fromToken?.done).toBe(true);
    await expect(itemOf('connect_ai_client')).resolves.toMatchObject({
      done: true,
    });
  });

  it('asks for a reply once a review is stored and counts a marked one', async () => {
    const first = await createApp();
    await expect(itemOf('reply_to_review')).resolves.toBeUndefined();

    const review = await prisma.review.create({
      data: {
        appId: first.id,
        reviewId: 'review-1',
        score: 2,
        text: 'Crashes on launch',
      },
    });
    await expect(itemOf('reply_to_review')).resolves.toMatchObject({
      done: false,
      appId: first.id,
    });

    await prisma.reviewReply.create({
      data: {
        reviewId: review.id,
        appId: first.id,
        workspaceId: DEFAULT_WORKSPACE_ID,
        text: 'Thanks, a fix is coming.',
      },
    });
    await expect(itemOf('reply_to_review')).resolves.toMatchObject({
      done: false,
    });

    await prisma.reviewReply.update({
      where: { reviewId: review.id },
      data: { repliedAt: new Date() },
    });
    await expect(itemOf('reply_to_review')).resolves.toMatchObject({
      done: true,
    });
  });

  it('ignores the reviews and replies of a competitor', async () => {
    const primary = await createApp();
    const rival = await createApp({ primaryAppId: primary.id });
    const review = await prisma.review.create({
      data: { appId: rival.id, reviewId: 'rival-1', score: 1, text: 'Slow' },
    });
    await expect(itemOf('reply_to_review')).resolves.toBeUndefined();

    await prisma.review.create({
      data: { appId: primary.id, reviewId: 'own-1', score: 2, text: 'Meh' },
    });
    await prisma.reviewReply.create({
      data: {
        reviewId: review.id,
        appId: rival.id,
        workspaceId: DEFAULT_WORKSPACE_ID,
        text: 'Not ours to answer.',
        repliedAt: new Date(),
      },
    });
    await expect(itemOf('reply_to_review')).resolves.toMatchObject({
      done: false,
      appId: primary.id,
    });
  });

  it('points the reply at the oldest app with a review that needs one', async () => {
    const first = await createApp();
    const second = await createApp();
    const answered = await prisma.review.create({
      data: { appId: first.id, reviewId: 'first-1', score: 2, text: 'Meh' },
    });
    await prisma.reviewReply.create({
      data: {
        reviewId: answered.id,
        appId: first.id,
        workspaceId: DEFAULT_WORKSPACE_ID,
        text: 'Thanks.',
        repliedAt: new Date(),
      },
    });
    await prisma.review.create({
      data: { appId: second.id, reviewId: 'second-1', score: 1, text: 'Bad' },
    });

    await expect(itemOf('reply_to_review')).resolves.toMatchObject({
      done: true,
      appId: second.id,
    });
  });

  it('orders the list for the stored goal and ignores an unknown one', async () => {
    await prisma.workspace.update({
      where: { id: DEFAULT_WORKSPACE_ID },
      data: { checklistGoal: 'use_with_ai' },
    });
    const chosen = await read();
    expect(chosen.goal).toBe('use_with_ai');
    expect(ids(chosen)[1]).toBe('connect_ai_client');

    await prisma.workspace.update({
      where: { id: DEFAULT_WORKSPACE_ID },
      data: { checklistGoal: 'nonsense' },
    });
    const unknown = await read();
    expect(unknown.goal).toBeNull();
    expect(ids(unknown)).toEqual(EMPTY_ORDER);
  });

  it('echoes the dismissal', async () => {
    const dismissedAt = new Date('2026-11-02T09:30:00.000Z');
    await prisma.workspace.update({
      where: { id: DEFAULT_WORKSPACE_ID },
      data: { checklistDismissedAt: dismissedAt },
    });

    await expect(read()).resolves.toMatchObject({
      dismissedAt: dismissedAt.toISOString(),
    });
  });

  it('answers a read scoped token', async () => {
    await request(app.getHttpServer())
      .get('/workspace/checklist')
      .set('Authorization', `Bearer ${readToken}`)
      .expect(200);
  });

  it('answers 404 below the route', async () => {
    await api.get('/workspace/checklist/x').expect(404);
  });

  describe('PATCH', () => {
    it('saves a goal and answers the reordered list', async () => {
      const saved = await patch({ goal: 'improve_rankings' });

      expect(saved.goal).toBe('improve_rankings');
      expect(ids(saved)[1]).toBe('fill_keyword_field');
      await expect(stored()).resolves.toMatchObject({
        checklistGoal: 'improve_rankings',
      });
      await expect(read()).resolves.toEqual(saved);
    });

    it('changes and clears the goal', async () => {
      await patch({ goal: 'use_with_ai' });
      const cleared = await patch({ goal: null });

      expect(cleared.goal).toBeNull();
      expect(ids(cleared)).toEqual(EMPTY_ORDER);
      await expect(stored()).resolves.toMatchObject({ checklistGoal: null });
    });

    it('hides the list once and shows it again', async () => {
      const hidden = await patch({ dismissed: true });
      expect(hidden.dismissedAt).toEqual(expect.any(String));

      const again = await patch({ dismissed: true });
      expect(again.dismissedAt).toBe(hidden.dismissedAt);

      const shown = await patch({ dismissed: false });
      expect(shown.dismissedAt).toBeNull();
      await expect(stored()).resolves.toMatchObject({
        checklistDismissedAt: null,
      });
    });

    it('keeps the first dismissal when hides arrive together', async () => {
      const answers = await Promise.all(
        Array.from({ length: 8 }, () => patch({ dismissed: true })),
      );
      const stamped = (await stored()).checklistDismissedAt?.toISOString();

      expect(stamped).toEqual(expect.any(String));
      expect(new Set(answers.map((answer) => answer.dismissedAt))).toEqual(
        new Set([stamped]),
      );
    });

    it('changes nothing for an empty body', async () => {
      await patch({ goal: 'research_idea', dismissed: true });
      const before = await stored();

      const answered = await patch({});

      expect(answered.goal).toBe('research_idea');
      await expect(stored()).resolves.toEqual(before);
    });

    it.each([
      ['an unknown goal', { goal: 'speed' }],
      ['a goal that is not text', { goal: 3 }],
      ['a dismissal that is not a boolean', { dismissed: 'yes' }],
      ['a null dismissal', { dismissed: null }],
      ['a field it does not take', { workspaceId: 'ws_other' }],
      ['a goal with a NUL character', { goal: 'research\u0000idea' }],
    ])('refuses %s with 400', async (_name, body) => {
      await api.patch('/workspace/checklist').send(body).expect(400);

      await expect(stored()).resolves.toEqual({
        checklistGoal: null,
        checklistDismissedAt: null,
      });
    });

    it('refuses a read scoped token and takes a write scoped one', async () => {
      await request(app.getHttpServer())
        .patch('/workspace/checklist')
        .set('Authorization', `Bearer ${readToken}`)
        .send({ dismissed: true })
        .expect(403);

      await request(app.getHttpServer())
        .patch('/workspace/checklist')
        .set('Authorization', `Bearer ${writeToken}`)
        .send({ goal: 'use_with_ai' })
        .expect(200);
      await expect(stored()).resolves.toMatchObject({
        checklistGoal: 'use_with_ai',
      });
    });
  });
});
