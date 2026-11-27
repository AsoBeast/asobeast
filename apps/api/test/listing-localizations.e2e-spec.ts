import { execSync } from 'child_process';
import { join } from 'path';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import {
  AppDetail,
  AppLocalizationsResult,
  AppScreenshots,
  ChangeTimeline,
  CompetitorItem,
  CoveragePreviewResult,
  KeywordBreakdown,
  KeywordFieldResult,
  ListingMarket,
  MarketKeywordFields,
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
  BRITISH_ONLY,
  DE_APP_URL,
  ENGLISH,
  ENGLISH_ONLY,
  FRENCH,
  GERMAN,
  GERMAN_ONLY,
  JP_APP_URL,
  LocalizedRegistry,
  PL_APP_URL,
  POLISH,
  POLISH_ONLY,
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

  const defaultOf = async (appId: string) =>
    (
      await prisma.app.findUniqueOrThrow({
        where: { id: appId },
        select: { defaultLocalization: true },
      })
    ).defaultLocalization;

  const localizationItems = async (appId: string) =>
    (
      (await api.get(`/apps/${appId}/localizations`).expect(200))
        .body as AppLocalizationsResult
    ).localizations;

  const titleOf = (audit: MetadataAuditResult) =>
    audit.fields.find((field) => field.field === 'title')?.value;

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

  it('captures and covers a shipped localization a market reads besides its default', async () => {
    registry.listings.set('ch:fr', {
      title: 'Où suis-je? Quiz Géographique',
      subtitle: 'Carte du Monde',
      description: 'Découvrez le monde',
      screenshots: [],
    });
    const appId = await importFrom(US_APP_URL);
    await api
      .post(`/apps/${appId}/localizations`)
      .send({ localization: 'fr' })
      .expect(201);
    await api
      .post(`/apps/${appId}/keywords`)
      .send({ keywords: ['quiz géographique'], country: 'ch' })
      .expect(201);
    registry.calls.length = 0;

    await api.post(`/apps/${appId}/refresh?country=ch`).expect(200);

    expect(registry.calls).toEqual([
      { country: 'ch' },
      { country: 'ch', localization: 'fr' },
    ]);
    const audit = (
      await api.get(`/apps/${appId}/metadata/audit?country=ch`).expect(200)
    ).body as MetadataAuditResult;
    expect(
      audit.coverage.find((item) => item.text === 'quiz géographique'),
    ).toMatchObject({
      uncovered: false,
      listingCountry: 'ch',
      fields: expect.arrayContaining([
        expect.objectContaining({
          field: 'title',
          covered: true,
          localization: 'fr',
        }),
      ]) as unknown,
    });
  });

  it('stops reading a captured localization once the app no longer ships it', async () => {
    registry.listings.set('ch:fr', {
      title: 'Où suis-je? Quiz Géographique',
      subtitle: 'Carte du Monde',
      description: 'Découvrez le monde',
      screenshots: [],
    });
    const appId = await importFrom(US_APP_URL);
    await api
      .post(`/apps/${appId}/localizations`)
      .send({ localization: 'fr' })
      .expect(201);
    await api
      .post(`/apps/${appId}/keywords`)
      .send({ keywords: ['quiz géographique'], country: 'ch' })
      .expect(201);
    await api.post(`/apps/${appId}/refresh?country=ch`).expect(200);

    await api.delete(`/apps/${appId}/localizations/fr`).expect(204);

    const audit = (
      await api.get(`/apps/${appId}/metadata/audit?country=ch`).expect(200)
    ).body as MetadataAuditResult;
    expect(
      audit.coverage.find((item) => item.text === 'quiz géographique'),
    ).toMatchObject({ uncovered: true });
    const markets = (
      await api.get(`/apps/${appId}/listing-markets`).expect(200)
    ).body as ListingMarket[];
    expect(
      markets.find((market) => market.country === 'ch')?.localizations,
    ).toBeUndefined();
  });

  it('stores only the default listing of an app without a polish listing', async () => {
    const appId = await importFrom(PL_APP_URL);

    await expect(snapshotsOf(appId)).resolves.toEqual([
      { country: null, localization: null, title: ENGLISH.title },
    ]);
  });

  it('stores no localization whose page only drops the subtitle', async () => {
    registry.listings.set('pl:pl', { ...ENGLISH, subtitle: undefined });

    const appId = await importFrom(PL_APP_URL);

    await expect(snapshotsOf(appId)).resolves.toEqual([
      { country: null, localization: null, title: ENGLISH.title },
    ]);
  });

  it('stores the localization whose own subtitle differs from the default', async () => {
    registry.listings.set('pl:pl', { ...ENGLISH, subtitle: POLISH.subtitle });

    const appId = await importFrom(PL_APP_URL);

    await expect(snapshotsOf(appId)).resolves.toHaveLength(2);
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

    it('audits the default listing when the request names the default localization of its storefront', async () => {
      registry.listings.set('pl:pl', POLISH);
      registry.listings.set('de:default', GERMAN);
      const appId = await importFrom(PL_APP_URL);
      await api
        .post(`/apps/${appId}/keywords`)
        .send({ keywords: ['karte'], country: 'de' })
        .expect(201);
      await api.post(`/apps/${appId}/refresh?country=de`).expect(200);
      const auditOf = async (query: string) =>
        (await api.get(`/apps/${appId}/metadata/audit${query}`).expect(200))
          .body as MetadataAuditResult;
      const titleOf = (audit: MetadataAuditResult) =>
        audit.fields.find((field) => field.field === 'title')?.value;

      const home = await auditOf('?localization=en-GB');
      const market = await auditOf('?country=de&localization=de');

      expect(titleOf(home)).toBe(ENGLISH.title);
      expect(home.localization).toBe('en-GB');
      expect(home.coverage).toEqual((await auditOf('')).coverage);
      expect(titleOf(market)).toBe(GERMAN.title);
      expect(market.coverage).toEqual((await auditOf('?country=de')).coverage);
    });

    it('reads the default listing and its screenshots when the request names the default localization of its storefront', async () => {
      registry.listings.set('pl:pl', POLISH);
      registry.listings.set('de:default', GERMAN);
      const appId = await importFrom(PL_APP_URL);
      await api
        .post(`/apps/${appId}/keywords`)
        .send({ keywords: ['karte'], country: 'de' })
        .expect(201);
      await api.post(`/apps/${appId}/refresh?country=de`).expect(200);
      const detailOf = async (query: string) =>
        (await api.get(`/apps/${appId}${query}`).expect(200)).body as AppDetail;
      const screenshotsOf = async (query: string) =>
        (await api.get(`/apps/${appId}/screenshots${query}`).expect(200))
          .body as AppScreenshots;
      const urlsOf = (shots: AppScreenshots) =>
        shots.screenshots.map((item) => item.url);

      const home = await detailOf('?localization=en-GB');
      const market = await detailOf('?country=de&localization=de');
      const homeShots = await screenshotsOf('?localization=en-GB');
      const marketShots = await screenshotsOf('?country=de&localization=de');

      expect(home.latestSnapshot?.title).toBe(ENGLISH.title);
      expect(home.localization).toBe('en-GB');
      expect(market.latestSnapshot?.title).toBe(GERMAN.title);
      expect(market.localization).toBe('de');
      expect(urlsOf(homeShots)).toEqual(ENGLISH.screenshots);
      expect(homeShots.localization).toBe('en-GB');
      expect(urlsOf(marketShots)).toEqual(GERMAN.screenshots);
      expect(marketShots.localization).toBe('de');
    });

    it('still refuses a localization for a google play app', async () => {
      const appId = await importFrom(
        'https://play.google.com/store/apps/details?id=com.example.app&gl=us',
      );

      for (const path of ['', '/screenshots', '/metadata/audit']) {
        await api.get(`/apps/${appId}${path}`).expect(200);
        await api.get(`/apps/${appId}${path}?localization=en-US`).expect(404);
      }
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

  describe('the localizations a capture proves', () => {
    const localizationsOf = (appId: string) =>
      prisma.appLocalization.findMany({
        where: { appId },
        orderBy: { localization: 'asc' },
        select: { localization: true, origin: true },
      });

    it('records the polish localization as detected for an app imported from a polish url', async () => {
      registry.listings.set('pl:pl', POLISH);

      const appId = await importFrom(PL_APP_URL);

      await expect(localizationsOf(appId)).resolves.toEqual([
        { localization: 'pl', origin: 'detected' },
      ]);
    });

    it('lists the detected localization as shipped', async () => {
      registry.listings.set('pl:pl', POLISH);
      const appId = await importFrom(PL_APP_URL);

      const { localizations } = (
        await api.get(`/apps/${appId}/localizations`).expect(200)
      ).body as AppLocalizationsResult;

      expect(localizations).toContainEqual(
        expect.objectContaining({ localization: 'pl', origin: 'detected' }),
      );
    });

    it('records nothing when the polish listing echoes the default', async () => {
      const appId = await importFrom(PL_APP_URL);

      await expect(snapshotsOf(appId)).resolves.toHaveLength(1);
      await expect(localizationsOf(appId)).resolves.toEqual([]);
    });

    it('keeps a manual localization manual when the capture proves it', async () => {
      registry.listings.set('pl:pl', POLISH);
      const appId = await importFrom(US_APP_URL);
      await api
        .post(`/apps/${appId}/keywords`)
        .send({ keywords: ['quiz geograficzny'], country: 'pl' })
        .expect(201);
      await api
        .post(`/apps/${appId}/localizations`)
        .send({ localization: 'pl' })
        .expect(201);

      await api.post(`/apps/${appId}/refresh?country=pl`).expect(200);

      await expect(snapshotsOf(appId)).resolves.toContainEqual({
        country: 'pl',
        localization: 'pl',
        title: POLISH.title,
      });
      await expect(localizationsOf(appId)).resolves.toEqual([
        { localization: 'pl', origin: 'manual' },
      ]);
    });

    it('does not bring a removed localization back on the next capture', async () => {
      registry.listings.set('pl:pl', POLISH);
      const appId = await importFrom(PL_APP_URL);

      await api.delete(`/apps/${appId}/localizations/pl`).expect(204);
      await api.post(`/apps/${appId}/refresh`).expect(200);

      await expect(localizationsOf(appId)).resolves.toEqual([]);
    });

    describe('the default localization of a market', () => {
      const trackIn = async (appId: string, country: string) => {
        await api
          .post(`/apps/${appId}/keywords`)
          .send({ keywords: ['geo quiz'], country })
          .expect(201);
      };

      it('ships the default localization of a market whose listing the store localizes', async () => {
        registry.listings.set('de:default', GERMAN);
        const appId = await importFrom(US_APP_URL);
        await trackIn(appId, 'de');

        await api.post(`/apps/${appId}/refresh?country=de`).expect(200);

        const { localizations } = (
          await api.get(`/apps/${appId}/localizations`).expect(200)
        ).body as AppLocalizationsResult;
        expect(localizations).toContainEqual(
          expect.objectContaining({
            localization: 'de',
            origin: 'detected',
            readBy: [{ country: 'de', role: 'default', home: false }],
          }),
        );
      });

      it('ships nothing for a market whose listing echoes the home one', async () => {
        const appId = await importFrom(US_APP_URL);
        await trackIn(appId, 'de');

        await api.post(`/apps/${appId}/refresh?country=de`).expect(200);

        const { localizations } = (
          await api.get(`/apps/${appId}/localizations`).expect(200)
        ).body as AppLocalizationsResult;
        expect(localizations.map((item) => item.localization)).toEqual([
          'en-US',
        ]);
      });

      it('records the default once however many captures run', async () => {
        registry.listings.set('de:default', GERMAN);
        const appId = await importFrom(US_APP_URL);
        await trackIn(appId, 'de');

        await api.post(`/apps/${appId}/refresh?country=de`).expect(200);
        await api.post(`/apps/${appId}/refresh?country=de`).expect(200);

        await expect(localizationsOf(appId)).resolves.toEqual([
          { localization: 'de', origin: 'detected' },
        ]);
      });

      it('does not ship the default of a market while one of its localizations could not be read', async () => {
        registry.listings.set('ch:default', GERMAN);
        registry.failing = 'fr';
        const appId = await importFrom(US_APP_URL);
        await api
          .post(`/apps/${appId}/localizations`)
          .send({ localization: 'fr' })
          .expect(201);
        await trackIn(appId, 'ch');

        await api.post(`/apps/${appId}/refresh?country=ch`).expect(200);

        await expect(localizationsOf(appId)).resolves.toEqual([
          { localization: 'fr', origin: 'manual' },
        ]);
      });

      it('does not ship the default of a market where an additional localization echoes the listing', async () => {
        registry.listings.set('ch:default', FRENCH);
        registry.listings.set('ch:fr', FRENCH);
        const appId = await importFrom(US_APP_URL);
        await api
          .post(`/apps/${appId}/localizations`)
          .send({ localization: 'fr' })
          .expect(201);
        await trackIn(appId, 'ch');

        await api.post(`/apps/${appId}/refresh?country=ch`).expect(200);

        await expect(localizationsOf(appId)).resolves.toEqual([
          { localization: 'fr', origin: 'manual' },
        ]);
      });
    });
  });

  describe('the language of the default listing', () => {
    const polishOnly = () => {
      for (const key of ['pl:default', 'pl:pl', 'pl:en-GB']) {
        registry.listings.set(key, POLISH_ONLY);
      }
    };

    it('records polish as the default of a polish only app', async () => {
      polishOnly();

      const imported = (
        await api.post('/apps').send({ url: PL_APP_URL }).expect(201)
      ).body as AppDetail;

      expect(imported.defaultLocalization).toBe('pl');
      await expect(defaultOf(imported.id)).resolves.toBe('pl');
    });

    it('keeps an english only app on the storefront default', async () => {
      for (const key of ['pl:default', 'pl:pl', 'pl:en-GB']) {
        registry.listings.set(key, ENGLISH_ONLY);
      }

      const appId = await importFrom(PL_APP_URL);

      await expect(defaultOf(appId)).resolves.toBeNull();
    });

    it('clears the default once the store serves a distinct polish page', async () => {
      polishOnly();
      const appId = await importFrom(PL_APP_URL);
      registry.listings.set('pl:default', ENGLISH_ONLY);
      registry.listings.set('pl:en-GB', ENGLISH_ONLY);

      await api.post(`/apps/${appId}/refresh`).expect(200);

      await expect(defaultOf(appId)).resolves.toBeNull();
      await expect(snapshotsOf(appId)).resolves.toContainEqual({
        country: null,
        localization: 'pl',
        title: POLISH_ONLY.title,
      });
    });

    it('labels the home localization of a polish only app polish', async () => {
      polishOnly();
      const appId = await importFrom(PL_APP_URL);

      const items = await localizationItems(appId);

      expect(items[0]).toMatchObject({ localization: 'pl', origin: 'home' });
      expect(items.map((item) => item.localization)).not.toContain('en-GB');
    });

    it('labels an english only app english (u.k.)', async () => {
      for (const key of ['pl:default', 'pl:pl', 'pl:en-GB']) {
        registry.listings.set(key, ENGLISH_ONLY);
      }
      const appId = await importFrom(PL_APP_URL);

      const items = await localizationItems(appId);

      expect(items[0]).toMatchObject({ localization: 'en-GB', origin: 'home' });
    });

    it('keeps a saved english field as a removable item', async () => {
      const appId = await importFrom(PL_APP_URL);
      await api
        .put(`/apps/${appId}/keyword-fields/en-GB`)
        .send({ text: 'dziennik,oceny', trackIn: [] })
        .expect(200);
      polishOnly();

      await api.post(`/apps/${appId}/refresh`).expect(200);

      const items = await localizationItems(appId);
      expect(
        items.map(({ localization, origin }) => ({ localization, origin })),
      ).toEqual([
        { localization: 'pl', origin: 'home' },
        { localization: 'en-GB', origin: 'manual' },
      ]);
      expect(items[1].phrases).toEqual(['dziennik', 'oceny']);
      const refused = await api
        .delete(`/apps/${appId}/localizations/pl`)
        .expect(409);
      expect((refused.body as { message: string }).message).toBe(
        'Polish is the language of the home listing and cannot be removed',
      );
      await api.delete(`/apps/${appId}/localizations/en-GB`).expect(204);
    });

    it('saves the polish home field without a manual row', async () => {
      polishOnly();
      const appId = await importFrom(PL_APP_URL);

      await api
        .put(`/apps/${appId}/keyword-fields/pl`)
        .send({ text: 'frekwencja', trackIn: [] })
        .expect(200);

      await expect(
        prisma.appLocalization.findMany({ where: { appId } }),
      ).resolves.toEqual([]);
      const items = await localizationItems(appId);
      expect(items[0]).toMatchObject({
        localization: 'pl',
        origin: 'home',
        phrases: ['frekwencja'],
      });
    });

    it('reads the polish home field from the keyword field route without a query', async () => {
      polishOnly();
      const appId = await importFrom(PL_APP_URL);
      await api
        .put(`/apps/${appId}/keyword-fields/pl`)
        .send({ text: 'frekwencja', trackIn: [] })
        .expect(200);

      const field = (await api.get(`/apps/${appId}/keyword-field`).expect(200))
        .body as KeywordFieldResult;

      expect(field).toMatchObject({
        localization: 'pl',
        phrases: ['frekwencja'],
      });
    });

    it('audits the polish default listing under pl', async () => {
      polishOnly();
      const appId = await importFrom(PL_APP_URL);

      const audit = (
        await api
          .get(`/apps/${appId}/metadata/audit?localization=pl`)
          .expect(200)
      ).body as MetadataAuditResult;

      expect(titleOf(audit)).toBe(POLISH_ONLY.title);
    });

    it('still audits the default listing under en-GB', async () => {
      polishOnly();
      const appId = await importFrom(PL_APP_URL);

      const audit = (
        await api
          .get(`/apps/${appId}/metadata/audit?localization=en-GB`)
          .expect(200)
      ).body as MetadataAuditResult;

      expect(titleOf(audit)).toBe(POLISH_ONLY.title);
    });

    it('reads the market detail and screenshots under pl', async () => {
      polishOnly();
      const appId = await importFrom(PL_APP_URL);

      const detail = (
        await api.get(`/apps/${appId}?localization=pl`).expect(200)
      ).body as AppDetail;
      const shots = (
        await api.get(`/apps/${appId}/screenshots?localization=pl`).expect(200)
      ).body as AppScreenshots;

      expect(detail.latestSnapshot?.title).toBe(POLISH_ONLY.title);
      expect(detail.localization).toBe('pl');
      expect(shots.screenshots.map((item) => item.url)).toEqual(
        POLISH_ONLY.screenshots,
      );
    });

    it('offers no stale polish entry in the market switcher', async () => {
      registry.listings.set('pl:default', ENGLISH_ONLY);
      registry.listings.set('pl:pl', POLISH_ONLY);
      const appId = await importFrom(PL_APP_URL);
      polishOnly();
      await api.post(`/apps/${appId}/refresh`).expect(200);

      const markets = (
        await api.get(`/apps/${appId}/listing-markets`).expect(200)
      ).body as ListingMarket[];

      await expect(defaultOf(appId)).resolves.toBe('pl');
      const home = markets.find((market) => market.home);
      expect(home?.localizations ?? []).not.toContain('pl');
    });

    it('answers the default localization on the app detail', async () => {
      polishOnly();
      const polishId = await importFrom(PL_APP_URL);
      registry.reset();
      const englishId = await importFrom(US_APP_URL);

      const polish = (await api.get(`/apps/${polishId}`).expect(200))
        .body as AppDetail;
      const english = (await api.get(`/apps/${englishId}`).expect(200))
        .body as AppDetail;

      expect(polish.defaultLocalization).toBe('pl');
      expect('defaultLocalization' in english).toBe(false);
    });

    it('keeps refusing a polish view of another market', async () => {
      const appId = await importFrom(US_APP_URL);

      await api
        .get(`/apps/${appId}/metadata/audit?country=pl&localization=pl`)
        .expect(404);
    });

    const trackPolish = async (appId: string, keywords: string[]) => {
      await api
        .post(`/apps/${appId}/keywords`)
        .send({ keywords, country: 'pl' })
        .expect(201);
      const listed = (
        await api.get(`/apps/${appId}/keywords`).query({ country: 'pl' })
      ).body as TrackedKeywordItem[];
      return new Map(listed.map((item) => [item.text, item]));
    };

    const savePolishField = (appId: string, text: string) =>
      api
        .put(`/apps/${appId}/keyword-fields/pl`)
        .send({ text, trackIn: [] })
        .expect(200);

    it('covers a polish keyword split between the polish title and the polish field', async () => {
      polishOnly();
      const appId = await importFrom(PL_APP_URL);
      await trackPolish(appId, ['ucznia frekwencja']);
      await savePolishField(appId, 'frekwencja');

      const audit = (await api.get(`/apps/${appId}/metadata/audit`).expect(200))
        .body as MetadataAuditResult;

      expect(
        audit.coverage.find((row) => row.text === 'ucznia frekwencja'),
      ).toMatchObject({ uncovered: false });
    });

    it('flags the split polish keyword covered in the keywords table', async () => {
      polishOnly();
      const appId = await importFrom(PL_APP_URL);
      await trackPolish(appId, ['ucznia frekwencja']);
      await savePolishField(appId, 'frekwencja');

      const listed = (
        await api.get(`/apps/${appId}/keywords`).query({ country: 'pl' })
      ).body as TrackedKeywordItem[];

      expect(
        listed.find((item) => item.text === 'ucznia frekwencja')?.uncovered,
      ).toBe(false);
    });

    it('previews a polish draft as the default listing', async () => {
      polishOnly();
      const appId = await importFrom(PL_APP_URL);
      await trackPolish(appId, ['dzienniczek']);

      const preview = (
        await api
          .post(`/apps/${appId}/metadata/coverage-preview`)
          .send({ localization: 'pl', title: 'Plan lekcji' })
          .expect(200)
      ).body as CoveragePreviewResult;

      expect(
        preview.keywords.find((item) => item.text === 'dzienniczek')?.change,
      ).toBe('lost');
    });

    it('labels the default group of the keyword field diagnostics polish', async () => {
      polishOnly();
      const appId = await importFrom(PL_APP_URL);
      await trackPolish(appId, ['ucznia frekwencja']);
      await api
        .put(`/apps/${appId}/keyword-fields/en-GB`)
        .send({ text: 'frekwencja', trackIn: [] })
        .expect(200);

      const market = (
        await api
          .get(`/apps/${appId}/keyword-fields/market`)
          .query({ country: 'pl' })
          .expect(200)
      ).body as MarketKeywordFields;

      expect(
        market.splitPhrases.find(
          (phrase) => phrase.phrase === 'ucznia frekwencja',
        )?.parts,
      ).toEqual([
        { word: 'ucznia', localizations: ['pl'] },
        { word: 'frekwencja', localizations: ['en-GB'] },
      ]);
    });

    it('labels the default listing of the breakdown polish', async () => {
      polishOnly();
      const appId = await importFrom(PL_APP_URL);
      const tracked = await trackPolish(appId, ['ucznia frekwencja']);
      const keywordId = tracked.get('ucznia frekwencja')?.keywordId;

      const breakdown = (
        await api
          .get(`/apps/${appId}/keywords/${keywordId}/breakdown`)
          .expect(200)
      ).body as KeywordBreakdown;
      const you = breakdown.apps.find((each) => each.isYou);

      expect(you?.listings[0]).toMatchObject({ localization: 'pl' });
      expect(you?.unread).not.toContain('pl');
    });

    it('leaves the default alone when the polish lookup fails', async () => {
      polishOnly();
      const appId = await importFrom(PL_APP_URL);
      await api.post(`/apps/${appId}/refresh`).expect(200);
      registry.failing = 'pl';

      await api.post(`/apps/${appId}/refresh`).expect(200);

      await expect(defaultOf(appId)).resolves.toBe('pl');
    });
  });

  describe('a home listing in another language its storefront reads', () => {
    const englishOnly = (country: string) => {
      registry.listings.set(`${country}:default`, ENGLISH_ONLY);
    };

    const englishProbes = (country: string, localization = 'en-GB') =>
      registry.calls.filter(
        (call) =>
          call.country === country && call.localization === localization,
      );

    it('records english (u.k.) as the default of an english only app in germany', async () => {
      englishOnly('de');

      const imported = (
        await api.post('/apps').send({ url: DE_APP_URL }).expect(201)
      ).body as AppDetail;

      expect(imported.defaultLocalization).toBe('en-GB');
      await expect(defaultOf(imported.id)).resolves.toBe('en-GB');
      expect(englishProbes('de')).toHaveLength(1);
    });

    it('labels the home localization of an english only app in germany english (u.k.)', async () => {
      englishOnly('de');
      const appId = await importFrom(DE_APP_URL);

      const items = await localizationItems(appId);

      expect(items[0]).toMatchObject({ localization: 'en-GB', origin: 'home' });
      expect(items.map((item) => item.localization)).not.toContain('de');
    });

    it('audits the english default listing in germany under en-GB', async () => {
      englishOnly('de');
      const appId = await importFrom(DE_APP_URL);

      const audit = (await api.get(`/apps/${appId}/metadata/audit`).expect(200))
        .body as MetadataAuditResult;

      expect(audit.keywordFieldSuggestion?.localization).toBe('en-GB');
      expect(titleOf(audit)).toBe(ENGLISH_ONLY.title);
    });

    it('still audits the default listing under de', async () => {
      englishOnly('de');
      const appId = await importFrom(DE_APP_URL);

      const audit = (
        await api
          .get(`/apps/${appId}/metadata/audit?localization=de`)
          .expect(200)
      ).body as MetadataAuditResult;

      expect(titleOf(audit)).toBe(ENGLISH_ONLY.title);
    });

    it('keeps a german only app german without an english probe', async () => {
      registry.listings.set('de:default', GERMAN_ONLY);

      const appId = await importFrom(DE_APP_URL);

      await expect(defaultOf(appId)).resolves.toBeNull();
      expect((await localizationItems(appId))[0].localization).toBe('de');
      expect(
        registry.calls.filter(
          (call) => call.country === 'de' && call.localization !== undefined,
        ),
      ).toEqual([]);
    });

    it('keeps the storefront default when the english page differs', async () => {
      englishOnly('de');
      registry.listings.set('de:en-GB', BRITISH_ONLY);

      const appId = await importFrom(DE_APP_URL);

      await expect(defaultOf(appId)).resolves.toBeNull();
      const items = await localizationItems(appId);
      expect(items[0].localization).toBe('de');
      expect(items).toContainEqual(
        expect.objectContaining({ localization: 'en-GB', origin: 'detected' }),
      );
      await expect(snapshotsOf(appId)).resolves.toContainEqual({
        country: null,
        localization: 'en-GB',
        title: BRITISH_ONLY.title,
      });
    });

    it('records english (u.s.) as the default of an english only app in japan', async () => {
      englishOnly('jp');

      const appId = await importFrom(JP_APP_URL);

      await expect(defaultOf(appId)).resolves.toBe('en-US');
      expect((await localizationItems(appId))[0].localization).toBe('en-US');
    });

    it('clears the english default once the listing is german', async () => {
      englishOnly('de');
      const appId = await importFrom(DE_APP_URL);
      registry.listings.set('de:default', GERMAN_ONLY);
      registry.listings.set('de:en-GB', ENGLISH_ONLY);

      await api.post(`/apps/${appId}/refresh`).expect(200);

      await expect(defaultOf(appId)).resolves.toBeNull();
      const items = await localizationItems(appId);
      expect(items[0].localization).toBe('de');
      expect(items).toContainEqual(
        expect.objectContaining({ localization: 'en-GB', origin: 'detected' }),
      );
    });

    it('leaves the english default alone when the english lookup fails', async () => {
      englishOnly('de');
      const appId = await importFrom(DE_APP_URL);
      registry.failing = 'en-GB';

      await api.post(`/apps/${appId}/refresh`).expect(200);

      await expect(defaultOf(appId)).resolves.toBe('en-GB');
    });

    it('probes english once per capture', async () => {
      englishOnly('de');
      const appId = await importFrom(DE_APP_URL);

      await api.post(`/apps/${appId}/refresh`).expect(200);

      expect(englishProbes('de')).toHaveLength(2);
    });

    it('keeps a german field saved before the fix as a removable item', async () => {
      englishOnly('de');
      registry.failing = 'en-GB';
      const appId = await importFrom(DE_APP_URL);
      await api
        .put(`/apps/${appId}/keyword-fields/de`)
        .send({ text: 'tagebuch,noten', trackIn: [] })
        .expect(200);
      registry.failing = null;

      await api.post(`/apps/${appId}/refresh`).expect(200);

      const items = await localizationItems(appId);
      expect(items[0]).toMatchObject({ localization: 'en-GB', origin: 'home' });
      expect(items.find((item) => item.localization === 'de')?.phrases).toEqual(
        ['tagebuch', 'noten'],
      );
      await api.delete(`/apps/${appId}/localizations/en-GB`).expect(409);
      await api.delete(`/apps/${appId}/localizations/de`).expect(204);
    });

    const trackedTexts = async (appId: string) =>
      (
        (await api.get(`/apps/${appId}/keywords`).expect(200))
          .body as TrackedKeywordItem[]
      ).map((keyword) => keyword.text);

    it('seeds english words of an english default in germany', async () => {
      registry.listings.set('de:default', {
        ...ENGLISH_ONLY,
        title: 'Die Cast Garage',
        subtitle: 'Model cars to collect',
      });

      const appId = await importFrom(DE_APP_URL);

      const texts = await trackedTexts(appId);
      expect(texts.some((text) => text.split(' ').includes('die'))).toBe(true);
    });

    it('seeds a german listing in germany as before', async () => {
      registry.listings.set('de:default', GERMAN_ONLY);

      const appId = await importFrom(DE_APP_URL);

      const texts = await trackedTexts(appId);
      expect(texts).toContain('schultagebuch');
      expect(
        texts.filter((text) => ['und', 'die', 'der'].includes(text)),
      ).toEqual([]);
    });

    it('never probes a suspect for a competitor', async () => {
      registry.listings.set('de:default', GERMAN_ONLY);
      const appId = await importFrom(DE_APP_URL);
      englishOnly('de');
      registry.calls.length = 0;

      const competitor = (
        await api
          .post(`/apps/${appId}/competitors`)
          .send({ url: 'https://apps.apple.com/de/app/rival/id9876543210' })
          .expect(201)
      ).body as CompetitorItem;

      expect(englishProbes('de')).toEqual([]);
      await expect(defaultOf(competitor.id)).resolves.toBeNull();
    });
  });
});
