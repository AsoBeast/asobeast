import { execSync } from 'child_process';
import { join } from 'path';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient, Store } from '@prisma/client';
import {
  ApiErrorEnvelope,
  KeywordCoverageRow,
  MetadataAuditResult,
} from '@asobeast/shared';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import { obliterateQueues, settleBootRegistration } from './obliterate-queues';
import { testDb } from './helpers/test-db';
import { ownerAgent, useCookies } from './helpers/session';

describe('metadata audit per market (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let api: Awaited<ReturnType<typeof ownerAgent>>;

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
    await settleBootRegistration(app);
    prisma = testDb();
    await prisma.workspace.upsert({
      where: { id: DEFAULT_WORKSPACE_ID },
      update: {},
      create: { id: DEFAULT_WORKSPACE_ID, name: 'Default' },
    });
    api = await ownerAgent(app);
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

  const createApp = (store: Store, storeAppId: string) =>
    prisma.app.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store,
        storeAppId,
        country: 'us',
        name: 'Mine',
      },
    });

  const listing = (
    appId: string,
    country: string | null,
    texts: { title: string; subtitle?: string; summary?: string },
  ) =>
    prisma.appSnapshot.create({
      data: {
        appId,
        country,
        title: texts.title,
        subtitle: texts.subtitle ?? null,
        summary: texts.summary ?? null,
        description: `${texts.title} description`,
        raw: {},
      },
    });

  const track = async (
    appId: string,
    store: Store,
    text: string,
    country: string,
  ) => {
    const keyword = await prisma.keyword.create({
      data: { text, store, country },
    });
    await prisma.trackedKeyword.create({
      data: { appId, keywordId: keyword.id, source: 'MANUAL', active: true },
    });
  };

  const seed = async () => {
    const mine = await createApp(Store.APP_STORE, '111');
    await listing(mine.id, null, {
      title: 'Habit Tracker',
      subtitle: 'Daily Streak Counter',
    });
    await listing(mine.id, 'de', {
      title: 'Gewohnheits Tracker',
      subtitle: 'Taegliche Serie',
    });
    const keywords: Array<[string, string]> = [
      ['habit tracker', 'us'],
      ['gewohnheits tracker', 'de'],
      ['serie', 'de'],
      ['schlaf', 'de'],
      ['sleep timer', 'us'],
      ['kopfhoerer', 'pl'],
    ];
    for (const [text, country] of keywords) {
      await track(mine.id, Store.APP_STORE, text, country);
    }
    return mine;
  };

  const audit = async (path: string) =>
    (await api.get(path).expect(200)).body as MetadataAuditResult;

  const rowOf = (result: MetadataAuditResult, text: string) =>
    result.coverage.find((row) => row.text === text) as KeywordCoverageRow;

  it('judges a keyword against the listing of its own market', async () => {
    const mine = await seed();

    const result = await audit(`/apps/${mine.id}/metadata/audit`);

    expect(rowOf(result, 'gewohnheits tracker')).toMatchObject({
      uncovered: false,
      country: 'de',
      listingCountry: 'de',
    });
  });

  it('falls back to the home listing for a market without one', async () => {
    const mine = await seed();

    const result = await audit(`/apps/${mine.id}/metadata/audit`);

    expect(rowOf(result, 'kopfhoerer')).toMatchObject({
      country: 'pl',
      listingCountry: 'us',
      uncovered: true,
    });
  });

  it('judges a fallback keyword against the whole home listing', async () => {
    const mine = await seed();
    await track(mine.id, Store.APP_STORE, 'kopfhoerer', 'us');
    await prisma.trackedKeyword.updateMany({
      where: { keyword: { text: 'kopfhoerer', country: 'us' } },
      data: { source: 'KEYWORD_FIELD' },
    });

    const result = await audit(`/apps/${mine.id}/metadata/audit`);

    const fallback = result.coverage.find(
      (row) => row.text === 'kopfhoerer' && row.country === 'pl',
    );
    expect(fallback).toMatchObject({ listingCountry: 'us', uncovered: false });
    expect(fallback?.fields).toContainEqual({
      field: 'keywordField',
      covered: true,
    });
  });

  it('shows the listing of one market and only its keywords', async () => {
    const mine = await seed();

    const result = await audit(`/apps/${mine.id}/metadata/audit?country=de`);

    expect(result.country).toBe('de');
    expect(result.fields.find((field) => field.field === 'title')?.value).toBe(
      'Gewohnheits Tracker',
    );
    expect(result.fields.map((field) => field.field)).not.toContain(
      'keywordField',
    );
    expect(result.keywordFieldSuggestion).toBeNull();
    expect(result.coverage.map((row) => row.text).sort()).toEqual([
      'gewohnheits tracker',
      'schlaf',
      'serie',
    ]);
    for (const row of result.coverage) {
      expect(row.fields.map((field) => field.field)).toEqual([
        'title',
        'subtitle',
      ]);
    }
  });

  it('answers 404 for a market with no listing', async () => {
    const mine = await seed();

    const response = await api
      .get(`/apps/${mine.id}/metadata/audit?country=pl`)
      .expect(404);

    expect((response.body as ApiErrorEnvelope).message).toContain('pl');
  });

  it('audits a google play listing in a market', async () => {
    const play = await createApp(Store.GOOGLE_PLAY, 'com.example.habit');
    await listing(play.id, null, {
      title: 'Habit Tracker',
      summary: 'Daily Streak',
    });
    await listing(play.id, 'de', {
      title: 'Gewohnheits Tracker',
      summary: 'Taegliche Serie',
    });
    await track(play.id, Store.GOOGLE_PLAY, 'serie', 'de');

    const result = await audit(`/apps/${play.id}/metadata/audit?country=de`);

    expect(result.fields.map((field) => field.field)).toEqual([
      'title',
      'shortDescription',
      'description',
    ]);
    expect(rowOf(result, 'serie').uncovered).toBe(false);
    expect(
      rowOf(result, 'serie').fields.find(
        (field) => field.field === 'shortDescription',
      )?.covered,
    ).toBe(true);
  });

  it('suggests only home keywords for the keyword field', async () => {
    const mine = await seed();

    const result = await audit(`/apps/${mine.id}/metadata/audit`);

    expect(result.keywordFieldSuggestion?.addedTerms).toContain('sleep timer');
    expect(result.keywordFieldSuggestion?.addedTerms).not.toContain('schlaf');
  });

  it('reads the home market named by code as the home view', async () => {
    const mine = await seed();

    const result = await audit(`/apps/${mine.id}/metadata/audit?country=us`);

    expect(result.country).toBe('us');
    expect(result.coverage.map((row) => row.text).sort()).toEqual([
      'habit tracker',
      'sleep timer',
    ]);
    expect(result.fields.find((field) => field.field === 'title')?.value).toBe(
      'Habit Tracker',
    );
  });

  it('answers 400 for a code that is not a storefront', async () => {
    const mine = await seed();

    await api.get(`/apps/${mine.id}/metadata/audit?country=zz`).expect(400);
  });
});
