import { execSync } from 'child_process';
import { join } from 'path';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import {
  AppDetail,
  AppScreenshots,
  ChangeTimeline,
  ListingMarket,
  MetadataAuditResult,
  SnapshotDiffResult,
  TrackedKeywordItem,
} from '@asobeast/shared';
import { App } from 'supertest/types';
import { AlertsDispatcher } from '../src/alerts/alerts.dispatcher';
import { AppModule } from '../src/app.module';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import { StoreProviderRegistry } from '../src/store-providers/store-provider.registry';
import {
  ENGLISH,
  LocalizedRegistry,
  PL_APP_URL,
  POLISH,
  US_APP_URL,
} from './helpers/localized-store';
import { ownerAgent, useCookies } from './helpers/session';
import { testDb } from './helpers/test-db';
import { obliterateQueues, pauseQueues } from './obliterate-queues';

describe('Native localizations of a listing (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let api: Awaited<ReturnType<typeof ownerAgent>>;
  const registry = new LocalizedRegistry();

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
      .useValue(registry)
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
  });

  beforeEach(async () => {
    registry.reset();
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "App", "Keyword", "AppGroup" RESTART IDENTITY CASCADE',
    );
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await obliterateQueues(app);
    await app.close();
  });

  const importFrom = async (url: string) =>
    ((await api.post('/apps').send({ url }).expect(201)).body as AppDetail).id;

  const snapshotsOf = (appId: string) =>
    prisma.appSnapshot.findMany({
      where: { appId },
      orderBy: [{ capturedAt: 'asc' }, { localization: 'asc' }],
      select: { country: true, localization: true, title: true },
    });

  it('stores the english and the polish listing of an app imported from a polish url', async () => {
    registry.listings.set('pl:pl', POLISH);

    const appId = await importFrom(PL_APP_URL);

    await expect(snapshotsOf(appId)).resolves.toEqual(
      expect.arrayContaining([
        { country: null, localization: null, title: ENGLISH.title },
        { country: null, localization: 'pl', title: POLISH.title },
      ]),
    );
    await expect(snapshotsOf(appId)).resolves.toHaveLength(2);
    expect(registry.calls).toEqual([
      { country: 'pl' },
      { country: 'pl', localization: 'pl' },
    ]);
  });

  it('auto tracks polish and english phrases for an app imported from a polish url', async () => {
    registry.listings.set('pl:pl', POLISH);

    const appId = await importFrom(PL_APP_URL);

    const keywords = (await api.get(`/apps/${appId}/keywords`).expect(200))
      .body as TrackedKeywordItem[];
    const texts = keywords.map((keyword) => keyword.text);
    expect(texts).toEqual(expect.arrayContaining(['quiz geograficzny']));
    expect(texts.some((text) => text.includes('geoguess'))).toBe(true);
    expect(texts.length).toBeLessThanOrEqual(15);
    expect(keywords.every((keyword) => keyword.country === 'pl')).toBe(true);
  });

  it('covers a polish keyword in a polish title', async () => {
    registry.listings.set('pl:pl', POLISH);
    const appId = await importFrom(US_APP_URL);
    await api
      .post(`/apps/${appId}/keywords`)
      .send({ keywords: ['quiz geograficzny'], country: 'pl' })
      .expect(201);
    await api.post(`/apps/${appId}/refresh?country=pl`).expect(200);

    const audit = (
      await api.get(`/apps/${appId}/metadata/audit?country=pl`).expect(200)
    ).body as MetadataAuditResult;
    const row = audit.coverage.find(
      (item) => item.text === 'quiz geograficzny',
    );

    expect(row).toMatchObject({
      uncovered: false,
      listingCountry: 'pl',
      fields: [
        { field: 'title', covered: true, localization: 'pl' },
        { field: 'subtitle', covered: false },
      ],
    });
  });

  it('stores only the default listing of an app without a polish listing', async () => {
    const appId = await importFrom(PL_APP_URL);

    await expect(snapshotsOf(appId)).resolves.toEqual([
      { country: null, localization: null, title: ENGLISH.title },
    ]);
  });

  it('keeps capturing a removed localization and records the change', async () => {
    registry.listings.set('pl:pl', POLISH);
    const appId = await importFrom(PL_APP_URL);
    registry.listings.delete('pl:pl');

    await api.post(`/apps/${appId}/refresh`).expect(200);

    const localized = (await snapshotsOf(appId)).filter(
      (snapshot) => snapshot.localization === 'pl',
    );
    expect(localized.map((snapshot) => snapshot.title)).toEqual([
      POLISH.title,
      ENGLISH.title,
    ]);
    await expect(
      prisma.changeEvent.findMany({
        where: { appId, field: 'title' },
        select: { country: true, localization: true, after: true },
      }),
    ).resolves.toEqual([
      { country: null, localization: 'pl', after: ENGLISH.title },
    ]);
  });

  it('asks a united states app for nothing more', async () => {
    await importFrom(US_APP_URL);

    expect(registry.calls).toEqual([{ country: 'us' }]);
  });

  it('never fails a refresh because a localization fails', async () => {
    const appId = await importFrom(PL_APP_URL);
    registry.failing = 'pl';

    const response = await api.post(`/apps/${appId}/refresh`).expect(200);

    expect((response.body as SnapshotDiffResult).country).toBe('pl');
  });

  it('lists a polish title change in the refresh answer and sends no alert for it', async () => {
    registry.listings.set('pl:pl', POLISH);
    const appId = await importFrom(PL_APP_URL);
    const renamed = 'Where Am I? Quiz Geograficzny Świat';
    registry.listings.set('pl:pl', { ...POLISH, title: renamed });
    const dispatch = jest.spyOn(app.get(AlertsDispatcher), 'dispatch');

    const response = await api.post(`/apps/${appId}/refresh`).expect(200);

    expect((response.body as SnapshotDiffResult).changes).toContainEqual({
      field: 'title',
      before: POLISH.title.length,
      after: renamed.length,
      localization: 'pl',
    });
    expect(JSON.stringify(dispatch.mock.calls)).not.toContain(renamed);
    dispatch.mockRestore();
  });

  describe('reading a localized listing', () => {
    it('reads the polish listing of a polish app and the default without the parameter', async () => {
      registry.listings.set('pl:pl', POLISH);
      const appId = await importFrom(PL_APP_URL);

      const polish = (
        await api.get(`/apps/${appId}?localization=pl`).expect(200)
      ).body as AppDetail;
      const english = (await api.get(`/apps/${appId}`).expect(200))
        .body as AppDetail;

      expect(polish.latestSnapshot?.title).toBe(POLISH.title);
      expect(polish.localization).toBe('pl');
      expect(english.latestSnapshot?.title).toBe(ENGLISH.title);
      expect('localization' in english).toBe(false);
    });

    it('lists the captured localizations of a market', async () => {
      registry.listings.set('pl:pl', POLISH);
      const appId = await importFrom(PL_APP_URL);
      await api
        .post(`/apps/${appId}/keywords`)
        .send({ keywords: ['karte'], country: 'de' })
        .expect(201);
      await api.post(`/apps/${appId}/refresh?country=de`).expect(200);

      const markets = (
        await api.get(`/apps/${appId}/listing-markets`).expect(200)
      ).body as ListingMarket[];

      expect(markets.find((market) => market.home)).toMatchObject({
        country: 'pl',
        localizations: ['pl'],
      });
      const de = markets.find((market) => market.country === 'de');
      expect(de).toBeDefined();
      expect(de && 'localizations' in de).toBe(false);
    });

    it('refuses an unknown localization and answers 404 for one never captured', async () => {
      const polishAppId = await importFrom(PL_APP_URL);
      await api.get(`/apps/${polishAppId}?localization=xx`).expect(400);
      registry.reset();
      const usAppId = await importFrom(US_APP_URL);

      await api.get(`/apps/${usAppId}?localization=pl`).expect(404);
      await api.get(`/apps/${usAppId}/screenshots?localization=pl`).expect(404);
      await api
        .get(`/apps/${usAppId}/metadata/audit?localization=pl`)
        .expect(404);
    });

    it('reads the screenshots and the fields of a localization', async () => {
      registry.listings.set('pl:pl', POLISH);
      const appId = await importFrom(PL_APP_URL);

      const shots = (
        await api.get(`/apps/${appId}/screenshots?localization=pl`).expect(200)
      ).body as AppScreenshots;
      const localized = (
        await api
          .get(`/apps/${appId}/metadata/audit?localization=pl`)
          .expect(200)
      ).body as MetadataAuditResult;
      const plain = (await api.get(`/apps/${appId}/metadata/audit`).expect(200))
        .body as MetadataAuditResult;

      expect(shots.screenshots.map((item) => item.url)).toEqual(
        POLISH.screenshots,
      );
      expect(shots.localization).toBe('pl');
      expect(
        localized.fields.find((field) => field.field === 'title')?.value,
      ).toBe(POLISH.title);
      expect(localized.localization).toBe('pl');
      expect(localized.coverage).toEqual(plain.coverage);
    });

    it('shows localized events on the market timeline only', async () => {
      registry.listings.set('pl:pl', POLISH);
      const appId = await importFrom(PL_APP_URL);
      registry.listings.set('pl:pl', { ...POLISH, title: 'Gdzie jestem?' });
      await api.post(`/apps/${appId}/refresh`).expect(200);

      const timeline = (await api.get(`/apps/${appId}/changes`).expect(200))
        .body as ChangeTimeline;
      const recent = (await api.get('/changes/recent').expect(200))
        .body as ChangeTimeline;

      expect(timeline.events).toContainEqual(
        expect.objectContaining({
          field: 'title',
          after: 'Gdzie jestem?',
          localization: 'pl',
        }),
      );
      expect(
        recent.events.some((event) => event.after === 'Gdzie jestem?'),
      ).toBe(false);
    });
  });
});
