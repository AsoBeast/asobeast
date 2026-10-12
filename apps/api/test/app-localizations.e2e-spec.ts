import { execSync } from 'child_process';
import { join } from 'path';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient, Store } from '@prisma/client';
import {
  ApiErrorEnvelope,
  AppLocalizationsResult,
  KEYWORD_FIELD_CHAR_LIMIT,
  KeywordFieldResult,
} from '@asobeast/shared';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import { StoreProviderRegistry } from '../src/store-providers/store-provider.registry';
import { ownerAgent, useCookies } from './helpers/session';
import { testDb } from './helpers/test-db';
import { obliterateQueues, pauseQueues } from './obliterate-queues';

const noStoreRequests = {
  get: () => {
    throw new Error('no store request expected');
  },
};

describe('App localizations (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let api: Awaited<ReturnType<typeof ownerAgent>>;

  const seedApp = async (country = 'us', store: Store = Store.APP_STORE) =>
    (
      await prisma.app.create({
        data: {
          workspaceId: DEFAULT_WORKSPACE_ID,
          store,
          storeAppId: `${store}-${country}`,
          country,
          name: 'Habit Tracker',
        },
        select: { id: true },
      })
    ).id;

  const localizationsOf = async (id: string) =>
    (await api.get(`/apps/${id}/localizations`).expect(200))
      .body as AppLocalizationsResult;

  const tagsOf = async (id: string) =>
    (await localizationsOf(id)).localizations.map((item) => item.localization);

  const itemOf = async (id: string, localization: string) =>
    (await localizationsOf(id)).localizations.find(
      (item) => item.localization === localization,
    );

  const saveField = (id: string, query: Record<string, string>, text: string) =>
    api.put(`/apps/${id}/keyword-field`).query(query).send({ text });

  const track = (id: string, country: string, keyword: string) =>
    api
      .post(`/apps/${id}/keywords`)
      .send({ keywords: [keyword], country })
      .expect(201);

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
      .useValue(noStoreRequests)
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

  beforeEach(() =>
    prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "App", "Keyword" RESTART IDENTITY CASCADE',
    ),
  );

  afterAll(async () => {
    await prisma.$disconnect();
    await obliterateQueues(app);
    await app.close();
  });

  describe('listing the localizations', () => {
    it('lists only the home localization of an app that ships nothing else', async () => {
      const id = await seedApp();

      await expect(localizationsOf(id)).resolves.toEqual({
        home: 'us',
        markets: ['us'],
        localizations: [
          {
            localization: 'en-US',
            origin: 'home',
            phrases: [],
            charactersUsed: 0,
            charactersLimit: KEYWORD_FIELD_CHAR_LIMIT,
            readBy: [{ country: 'us', role: 'default', home: true }],
            updatedAt: null,
          },
        ],
      });
    });

    it('reports the saved field of the home localization', async () => {
      const id = await seedApp();
      await saveField(id, {}, 'habit,goals').expect(200);

      const [home] = (await localizationsOf(id)).localizations;
      const field = await prisma.keywordField.findFirstOrThrow();

      expect(home).toMatchObject({
        phrases: ['habit', 'goals'],
        charactersUsed: 11,
        updatedAt: field.updatedAt.toISOString(),
      });
    });

    it('lists a localization saved through the old route as manual, after the home one', async () => {
      const id = await seedApp();
      await saveField(id, { localization: 'es-MX' }, 'habito,metas').expect(
        200,
      );

      const { localizations } = await localizationsOf(id);

      expect(localizations.map((item) => item.localization)).toEqual([
        'en-US',
        'es-MX',
      ]);
      expect(localizations[1]).toMatchObject({
        origin: 'manual',
        phrases: ['habito', 'metas'],
      });
    });

    it('orders the other localizations by display name', async () => {
      const id = await seedApp();
      await saveField(id, { localization: 'es-MX' }, 'habito').expect(200);
      await saveField(id, { localization: 'fr' }, 'habitude').expect(200);
      await saveField(id, { localization: 'pt-BR' }, 'habito').expect(200);

      await expect(tagsOf(id)).resolves.toEqual([
        'en-US',
        'fr',
        'pt-BR',
        'es-MX',
      ]);
    });

    it('says which markets read each localization and in which role', async () => {
      const id = await seedApp();
      await track(id, 'mx', 'habito');
      await track(id, 'de', 'gewohnheit');
      await saveField(id, { localization: 'es-MX' }, 'habito').expect(200);
      await saveField(
        id,
        { country: 'mx', localization: 'en-GB' },
        'habit',
      ).expect(200);

      const result = await localizationsOf(id);

      expect(result.markets).toEqual(['us', 'de', 'mx']);
      expect(
        result.localizations.map((item) => [item.localization, item.readBy]),
      ).toEqual([
        ['en-US', [{ country: 'us', role: 'default', home: true }]],
        [
          'en-GB',
          [
            { country: 'de', role: 'additional', home: false },
            { country: 'mx', role: 'additional', home: false },
          ],
        ],
        [
          'es-MX',
          [
            { country: 'us', role: 'additional', home: true },
            { country: 'mx', role: 'default', home: false },
          ],
        ],
      ]);
    });

    it('treats English (U.K.) as the home localization of a country that is no storefront', async () => {
      const id = await seedApp('uk');

      const result = await localizationsOf(id);

      expect(result.home).toBe('uk');
      expect(result.markets).toEqual(['uk']);
      expect(result.localizations).toEqual([
        expect.objectContaining({
          localization: 'en-GB',
          origin: 'home',
          readBy: [{ country: 'uk', role: 'default', home: true }],
        }),
      ]);
    });

    it('lists a row with no field as shipped and empty', async () => {
      const id = await seedApp();
      await prisma.appLocalization.create({
        data: {
          appId: id,
          workspaceId: DEFAULT_WORKSPACE_ID,
          localization: 'es-MX',
          origin: 'detected',
        },
      });

      await expect(itemOf(id, 'es-MX')).resolves.toMatchObject({
        origin: 'detected',
        phrases: [],
        updatedAt: null,
      });
    });

    it('lists a field that has no row as manual', async () => {
      const id = await seedApp();
      await prisma.keywordField.create({
        data: {
          appId: id,
          workspaceId: DEFAULT_WORKSPACE_ID,
          localization: 'fr',
          phrases: ['habitude'],
        },
      });

      await expect(itemOf(id, 'fr')).resolves.toMatchObject({
        origin: 'manual',
        phrases: ['habitude'],
      });
    });

    it('drops a stored tag that is no App Store localization', async () => {
      const id = await seedApp();
      await prisma.appLocalization.create({
        data: {
          appId: id,
          workspaceId: DEFAULT_WORKSPACE_ID,
          localization: 'xx',
          origin: 'manual',
        },
      });

      await expect(tagsOf(id)).resolves.toEqual(['en-US']);
    });

    it("keeps an emptied field's localization shipped", async () => {
      const id = await seedApp();
      await saveField(id, { localization: 'es-MX' }, 'habito').expect(200);
      await saveField(id, { localization: 'es-MX' }, '').expect(200);

      await expect(itemOf(id, 'es-MX')).resolves.toMatchObject({
        phrases: [],
        updatedAt: null,
      });
    });

    it('lists the home localization once when a row is stored for it', async () => {
      const id = await seedApp();
      await prisma.appLocalization.create({
        data: {
          appId: id,
          workspaceId: DEFAULT_WORKSPACE_ID,
          localization: 'en-US',
          origin: 'manual',
        },
      });

      const { localizations } = await localizationsOf(id);

      expect(localizations).toHaveLength(1);
      expect(localizations[0].origin).toBe('home');
    });

    it('answers 400 for a Google Play app', async () => {
      const id = await seedApp('us', Store.GOOGLE_PLAY);

      const response = await api.get(`/apps/${id}/localizations`).expect(400);

      expect((response.body as ApiErrorEnvelope).message).toBe(
        'The keyword field is only available for App Store apps',
      );
    });

    it('answers 404 for a missing app', async () => {
      await api.get('/apps/missing-app/localizations').expect(404);
    });
  });

  describe('the old keyword field route records the localization', () => {
    const rowsOf = (appId: string) =>
      prisma.appLocalization.findMany({
        where: { appId },
        select: { localization: true, origin: true, workspaceId: true },
      });

    it('answers exactly what it answered and now records the localization', async () => {
      const id = await seedApp();

      const response = await saveField(
        id,
        { localization: 'es-MX' },
        'habito,metas',
      ).expect(200);
      const body = response.body as KeywordFieldResult;

      expect(Object.keys(body).sort()).toEqual([
        'charactersLimit',
        'charactersUsed',
        'country',
        'duplicatesRemoved',
        'localization',
        'phrases',
        'tracked',
      ]);
      expect(body).toMatchObject({
        country: 'us',
        localization: 'es-MX',
        phrases: ['habito', 'metas'],
        charactersUsed: 12,
        charactersLimit: KEYWORD_FIELD_CHAR_LIMIT,
        duplicatesRemoved: 0,
      });
      expect(body.tracked.map((item) => item.text)).toEqual([
        'habito',
        'metas',
      ]);
      await expect(rowsOf(id)).resolves.toEqual([
        {
          localization: 'es-MX',
          origin: 'manual',
          workspaceId: DEFAULT_WORKSPACE_ID,
        },
      ]);
    });

    it('records nothing for the home localization', async () => {
      const id = await seedApp();

      await saveField(id, {}, 'habit').expect(200);

      await expect(prisma.appLocalization.count()).resolves.toBe(0);
    });

    it('records nothing for an emptied field that never had a row', async () => {
      const id = await seedApp();

      await saveField(id, { localization: 'es-MX' }, '').expect(200);

      await expect(prisma.appLocalization.count()).resolves.toBe(0);
    });

    it('never downgrades a detected localization', async () => {
      const id = await seedApp();
      await prisma.appLocalization.create({
        data: {
          appId: id,
          workspaceId: DEFAULT_WORKSPACE_ID,
          localization: 'es-MX',
          origin: 'detected',
        },
      });

      await saveField(id, { localization: 'es-MX' }, 'habito').expect(200);

      await expect(rowsOf(id)).resolves.toEqual([
        {
          localization: 'es-MX',
          origin: 'detected',
          workspaceId: DEFAULT_WORKSPACE_ID,
        },
      ]);
    });
  });
});
