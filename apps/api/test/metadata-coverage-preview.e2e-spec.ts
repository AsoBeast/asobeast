import { execSync } from 'child_process';
import { join } from 'path';
import { getQueueToken } from '@nestjs/bullmq';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient, Store } from '@prisma/client';
import type {
  ApiErrorEnvelope,
  CoveragePreviewKeyword,
  CoveragePreviewResult,
} from '@asobeast/shared';
import { Queue } from 'bullmq';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import { QUEUES } from '../src/jobs/jobs.types';
import { StoreProviderRegistry } from '../src/store-providers/store-provider.registry';
import { seedApiToken } from './helpers/api-tokens';
import { ownerAgent, useCookies } from './helpers/session';
import { testDb } from './helpers/test-db';
import { obliterateQueues, pauseQueues } from './obliterate-queues';

const D0 = new Date('2026-07-01T00:00:00.000Z');

interface Listing {
  country?: string;
  localization?: string;
  title: string;
  subtitle?: string;
  summary?: string;
  description?: string;
}

describe('Metadata coverage preview (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let api: Awaited<ReturnType<typeof ownerAgent>>;
  let readToken: string;

  beforeAll(async () => {
    execSync('pnpm prisma migrate deploy', {
      cwd: join(__dirname, '..'),
      env: process.env,
      stdio: 'ignore',
    });
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(StoreProviderRegistry)
      .useValue({
        get: () => {
          throw new Error('the coverage preview never calls a store');
        },
      })
      .compile();
    app = moduleFixture.createNestApplication();
    useCookies(app);
    await app.init();
    await pauseQueues(app);

    prisma = testDb();
    await prisma.workspace.upsert({
      where: { id: DEFAULT_WORKSPACE_ID },
      update: {},
      create: { id: DEFAULT_WORKSPACE_ID, name: 'Default' },
    });
    api = await ownerAgent(app);
    readToken = await seedApiToken(prisma, {
      seed: 'coveragepreview',
      email: 'preview-reader@example.com',
      workspaceId: DEFAULT_WORKSPACE_ID,
      role: 'member',
    });
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "App", "Keyword" RESTART IDENTITY CASCADE',
    );
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await obliterateQueues(app);
    await app.close();
  });

  const createApp = async (
    store: Store,
    extra: { isCompetitor?: boolean; primaryAppId?: string } = {},
  ): Promise<string> => {
    const created = await prisma.app.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store,
        storeAppId: `${store}-${Math.random()}`,
        country: 'us',
        name: 'Zenly',
        isCompetitor: extra.isCompetitor ?? false,
        primaryAppId: extra.primaryAppId ?? null,
      },
    });
    return created.id;
  };

  const capture = (appId: string, listing: Listing) =>
    prisma.appSnapshot.create({
      data: {
        appId,
        country: listing.country ?? null,
        localization: listing.localization ?? null,
        title: listing.title,
        subtitle: listing.subtitle ?? null,
        summary: listing.summary ?? listing.subtitle ?? null,
        description: listing.description ?? '',
        raw: {},
        capturedAt: D0,
      },
    });

  const track = async (
    appId: string,
    store: Store,
    text: string,
    country = 'us',
  ): Promise<void> => {
    const keyword = await prisma.keyword.create({
      data: { text, store, country },
    });
    await prisma.trackedKeyword.create({
      data: { appId, keywordId: keyword.id, source: 'MANUAL', active: true },
    });
  };

  const saveField = (appId: string, localization: string, phrases: string[]) =>
    prisma.keywordField.create({
      data: {
        appId,
        workspaceId: DEFAULT_WORKSPACE_ID,
        localization,
        phrases,
      },
    });

  const focusTimer = async (): Promise<string> => {
    const appId = await createApp(Store.APP_STORE);
    await capture(appId, { title: 'Focus Timer', subtitle: 'Daily goals' });
    for (const text of [
      'focus timer',
      'daily goals',
      'habit tracker',
      'sleep sounds',
    ]) {
      await track(appId, Store.APP_STORE, text);
    }
    return appId;
  };

  const preview = async (
    appId: string,
    body: object,
  ): Promise<CoveragePreviewResult> =>
    (
      await api
        .post(`/apps/${appId}/metadata/coverage-preview`)
        .send(body)
        .expect(200)
    ).body as CoveragePreviewResult;

  const refusal = async (
    appId: string,
    body: object,
    status = 400,
  ): Promise<string> =>
    (
      (
        await api
          .post(`/apps/${appId}/metadata/coverage-preview`)
          .send(body)
          .expect(status)
      ).body as ApiErrorEnvelope
    ).message;

  const changes = (keywords: CoveragePreviewKeyword[]) =>
    keywords.map((row) => [row.change, row.text, row.country]);

  it('judges a drafted App Store title beside the live listing', async () => {
    const appId = await focusTimer();

    const result = await preview(appId, {
      localization: 'en-US',
      title: 'Habit Tracker',
    });

    expect(result).toMatchObject({
      appId,
      store: 'APP_STORE',
      localization: 'en-US',
      markets: ['us'],
      waitingMarkets: [],
      counts: { lost: 1, gained: 1, missing: 1, kept: 1 },
    });
    expect(changes(result.keywords)).toEqual([
      ['lost', 'focus timer', 'us'],
      ['gained', 'habit tracker', 'us'],
      ['missing', 'sleep sounds', 'us'],
      ['kept', 'daily goals', 'us'],
    ]);
    expect(result.fields.map((field) => [field.field, field.value])).toEqual([
      ['title', 'Habit Tracker'],
      ['subtitle', 'Daily goals'],
      ['description', ''],
    ]);
  });

  it('judges each target keyword of the drafted localization', async () => {
    const appId = await focusTimer();
    await prisma.listingTarget.create({
      data: {
        appId,
        workspaceId: DEFAULT_WORKSPACE_ID,
        localization: 'en-US',
        slots: ['habit tracker', '', 'focus timer'],
      },
    });

    const result = await preview(appId, {
      localization: 'en-US',
      title: 'Habit Tracker',
    });

    expect(
      result.targets?.map((target) => [
        target.position,
        target.role,
        target.text,
        target.live.covered,
        target.draft.covered,
      ]),
    ).toEqual([
      [1, 'title', 'habit tracker', false, true],
      [3, 'subtitle', 'focus timer', true, false],
    ]);
  });

  it('answers no targets for a localization without targets', async () => {
    const appId = await focusTimer();

    const result = await preview(appId, {
      localization: 'en-US',
      title: 'Habit Tracker',
    });

    expect(result).not.toHaveProperty('targets');
  });

  it('keeps a keyword the drafted keyword field covers', async () => {
    const appId = await focusTimer();

    const result = await preview(appId, {
      title: 'Habit Tracker',
      keywordField: 'focus,timer',
    });

    expect(
      result.keywords.find((row) => row.text === 'focus timer'),
    ).toMatchObject({
      change: 'kept',
      draft: { covered: true, wordsSplit: false },
    });
    expect(result.wastedWords).toEqual([]);
    expect(result.fields.map((field) => field.field)).toContain('keywordField');
  });

  it('reports a word the draft repeats across indexed fields', async () => {
    const appId = await focusTimer();

    const result = await preview(appId, {
      title: 'Habit Tracker',
      subtitle: 'Daily goals habit',
    });

    expect(result.wastedWords).toEqual([
      { word: 'habit', reason: 'repeated', fields: ['title', 'subtitle'] },
    ]);
  });

  it('judges only the market that reads another localization once its listing is captured', async () => {
    const appId = await focusTimer();
    await capture(appId, { country: 'gb', title: 'Focus Timer' });
    await track(appId, Store.APP_STORE, 'habit tracker', 'gb');

    const result = await preview(appId, {
      localization: 'en-GB',
      title: 'Habit Tracker',
    });

    expect(result.markets).toEqual(['gb']);
    expect(changes(result.keywords)).toEqual([
      ['gained', 'habit tracker', 'gb'],
    ]);
  });

  it('names a reader still on the home listing as waiting', async () => {
    const appId = await focusTimer();
    await track(appId, Store.APP_STORE, 'habit tracker', 'gb');

    const result = await preview(appId, {
      localization: 'en-GB',
      title: 'Habit Tracker',
    });

    expect(result).toMatchObject({
      markets: [],
      waitingMarkets: ['gb'],
      keywords: [],
    });
  });

  it('judges a market that falls back to home with a home draft', async () => {
    const appId = await focusTimer();
    await track(appId, Store.APP_STORE, 'habit tracker', 'de');

    const result = await preview(appId, { title: 'Habit Tracker' });

    expect(result.markets).toEqual(['us', 'de']);
    expect(
      result.keywords.find(
        (row) => row.text === 'habit tracker' && row.country === 'de',
      )?.change,
    ).toBe('gained');
  });

  it('keeps the home regime for a market without its own listing', async () => {
    const appId = await focusTimer();
    await saveField(appId, 'en-US', ['habit tracker']);
    await track(appId, Store.APP_STORE, 'habit tracker', 'gb');

    const result = await preview(appId, { title: 'Sleep Sounds' });

    expect(result.keywords.find((row) => row.country === 'gb')?.change).toBe(
      'kept',
    );
  });

  it('judges a localization no market reads without throwing', async () => {
    const appId = await focusTimer();

    const result = await preview(appId, {
      localization: 'ja',
      title: '集中タイマー',
    });

    expect(result).toMatchObject({
      localization: 'ja',
      markets: [],
      waitingMarkets: [],
      keywords: [],
    });
    expect(result.fields[0]).toMatchObject({
      field: 'title',
      value: '集中タイマー',
    });
  });

  it('judges a Google Play draft on title, short description and description', async () => {
    const appId = await createApp(Store.GOOGLE_PLAY);
    await capture(appId, {
      title: 'Focus Timer',
      summary: 'Plan your day',
      description: 'Sleep sounds included.',
    });
    for (const text of ['habit tracker', 'focus timer', 'sleep sounds']) {
      await track(appId, Store.GOOGLE_PLAY, text);
    }

    const result = await preview(appId, {
      country: 'us',
      shortDescription: 'The habit tracker for your day',
    });

    expect(result).toMatchObject({ country: 'us', markets: ['us'] });
    expect(changes(result.keywords)).toEqual([
      ['gained', 'habit tracker', 'us'],
      ['kept', 'focus timer', 'us'],
      ['kept', 'sleep sounds', 'us'],
    ]);
    expect(result.keywords[0].draft.fields.map((field) => field.field)).toEqual(
      ['title', 'shortDescription', 'description'],
    );
  });

  it('refuses a field Google Play does not have', async () => {
    const appId = await createApp(Store.GOOGLE_PLAY);

    await expect(refusal(appId, { subtitle: 'Daily goals' })).resolves.toBe(
      'Google Play has no subtitle or keyword field; draft the short description instead',
    );
    await expect(refusal(appId, { localization: 'en-US' })).resolves.toBe(
      'Google Play has no localizations; name the market with country instead',
    );
  });

  it('refuses a competitor app', async () => {
    const primary = await focusTimer();
    const competitor = await createApp(Store.APP_STORE, {
      isCompetitor: true,
      primaryAppId: primary,
    });

    await expect(refusal(competitor, { title: 'Habit' })).resolves.toBe(
      'A competitor app has no draft; draft its primary app instead',
    );
  });

  it('answers 404 for an unknown app', async () => {
    await refusal('app_missing', { title: 'Habit' }, 404);
  });

  it('refuses an unknown localization and an overlong title', async () => {
    const appId = await focusTimer();

    await refusal(appId, { localization: 'xx-YY' });
    await refusal(appId, { title: 'a'.repeat(3000) });
  });

  it('refuses a null text field with a 400', async () => {
    const appId = await focusTimer();

    for (const field of [
      'title',
      'subtitle',
      'keywordField',
      'description',
      'localization',
      'country',
    ]) {
      await refusal(appId, { [field]: null });
    }
  });

  it('answers an over limit title with its lint', async () => {
    const appId = await focusTimer();

    const result = await preview(appId, { title: 'a'.repeat(31) });

    expect(result.fields[0]).toMatchObject({ chars: 31, limit: 30 });
    expect(result.fields[0].issues.map((issue) => issue.rule)).toContain(
      'over-limit',
    );
  });

  it('writes nothing and queues nothing', async () => {
    const appId = await focusTimer();
    await saveField(appId, 'en-US', ['focus']);
    const queue = app.get<Queue>(getQueueToken(QUEUES.APP_STORE), {
      strict: false,
    });
    const counts = () =>
      Promise.all([
        prisma.keywordField.count(),
        prisma.trackedKeyword.count(),
        prisma.appLocalization.count(),
        prisma.appSnapshot.count(),
        prisma.keyword.count(),
        queue.getJobCounts('waiting', 'paused', 'delayed', 'prioritized'),
      ]);
    const before = await counts();

    await preview(appId, {
      title: 'Habit Tracker',
      keywordField: 'habit,water',
    });
    await preview(appId, { localization: 'de', keywordField: 'fokus' });

    await expect(counts()).resolves.toEqual(before);
  });

  it('lets a read-only token preview a draft listing', async () => {
    const appId = await focusTimer();

    const response = await request(app.getHttpServer())
      .post(`/apps/${appId}/metadata/coverage-preview`)
      .set('Authorization', `Bearer ${readToken}`)
      .send({ title: 'Habit Tracker' });

    expect(response.status).toBe(200);
  });
});
