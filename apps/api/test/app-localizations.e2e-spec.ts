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
  TrackedKeywordItem,
} from '@asobeast/shared';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import { AppLocalizationsService } from '../src/keywords/app-localizations.service';
import { KeywordFieldService } from '../src/keywords/keyword-field.service';
import { StoreProviderRegistry } from '../src/store-providers/store-provider.registry';
import { ownerAgent, useCookies } from './helpers/session';
import { asWorkspace } from './helpers/tenancy';
import { testDb } from './helpers/test-db';
import { obliterateQueues, pauseQueues } from './obliterate-queues';

const COMPETITOR_REFUSAL =
  'A competitor app has no localizations or keyword fields; use its primary app';

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

  const seedCompetitor = async (primaryAppId: string) =>
    (
      await prisma.app.create({
        data: {
          workspaceId: DEFAULT_WORKSPACE_ID,
          store: Store.APP_STORE,
          storeAppId: 'rival',
          country: 'us',
          name: 'Rival Habits',
          isCompetitor: true,
          primaryAppId,
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

  const sources = async (id: string, country: string) =>
    Object.fromEntries(
      (
        (await api.get(`/apps/${id}/keywords`).query({ country }).expect(200))
          .body as TrackedKeywordItem[]
      ).map((item) => [item.text, `${item.source}:${item.active}`]),
    );

  const add = (id: string, body: object) =>
    api.post(`/apps/${id}/localizations`).send(body);

  const remove = (id: string, localization: string) =>
    api.delete(`/apps/${id}/localizations/${localization}`);

  const messageOf = (response: { body: unknown }) =>
    (response.body as ApiErrorEnvelope).message;

  const seedRow = (appId: string, localization: string, origin = 'manual') =>
    prisma.appLocalization.create({
      data: {
        appId,
        workspaceId: DEFAULT_WORKSPACE_ID,
        localization,
        origin,
      },
    });

  const seedField = (appId: string, localization: string, phrases: string[]) =>
    prisma.keywordField.create({
      data: {
        appId,
        workspaceId: DEFAULT_WORKSPACE_ID,
        localization,
        phrases,
      },
    });

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
        storeManaged: false,
        storeSync: null,
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

    it('answers 400 for a competitor app', async () => {
      const rival = await seedCompetitor(await seedApp());

      const response = await api
        .get(`/apps/${rival}/localizations`)
        .expect(400);

      expect((response.body as ApiErrorEnvelope).message).toBe(
        COMPETITOR_REFUSAL,
      );
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

    it('keeps accepting a competitor app, as it did before localizations', async () => {
      const rival = await seedCompetitor(await seedApp());

      await saveField(rival, {}, 'habit').expect(200);
      const read = await api.get(`/apps/${rival}/keyword-field`).expect(200);

      expect((read.body as KeywordFieldResult).phrases).toEqual(['habit']);
      await expect(
        prisma.keywordField.findMany({
          where: { appId: rival },
          select: { localization: true, phrases: true },
        }),
      ).resolves.toEqual([{ localization: 'en-US', phrases: ['habit'] }]);
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

  describe('adding a localization', () => {
    it('adds a localization and answers 201 with the item', async () => {
      const id = await seedApp();

      const response = await add(id, { localization: 'es-MX' }).expect(201);

      expect(response.body).toEqual({
        localization: 'es-MX',
        origin: 'manual',
        phrases: [],
        charactersUsed: 0,
        charactersLimit: 100,
        readBy: [{ country: 'us', role: 'additional', home: true }],
        updatedAt: null,
      });
      await expect(
        prisma.appLocalization.findMany({
          where: { appId: id },
          select: { localization: true, origin: true },
        }),
      ).resolves.toEqual([{ localization: 'es-MX', origin: 'manual' }]);
      await expect(tagsOf(id)).resolves.toEqual(['en-US', 'es-MX']);
    });

    it.each([
      ['en-US', 'English (U.S.)', 'home'],
      ['es-MX', 'Spanish (Mexico)', 'row'],
      ['fr', 'French', 'field'],
    ] as const)(
      'answers 409 for a localization the app already ships (%s)',
      async (localization, name, shipped) => {
        const id = await seedApp();
        if (shipped === 'row') await seedRow(id, localization);
        if (shipped === 'field') await seedField(id, localization, ['a']);
        const before = await prisma.appLocalization.count();

        const response = await add(id, { localization }).expect(409);

        expect(messageOf(response)).toBe(
          `${name} is already one of this app's localizations`,
        );
        await expect(prisma.appLocalization.count()).resolves.toBe(before);
      },
    );

    it.each([
      { localization: 'xx' },
      { localization: 'en-us' },
      { localization: 'es' },
      { localization: '' },
      {},
      { localization: 5 },
    ])('answers 400 for a tag outside the 50 (%j)', async (body) => {
      const id = await seedApp();

      await add(id, body).expect(400);

      await expect(prisma.appLocalization.count()).resolves.toBe(0);
    });

    it('answers 400 for a property it does not know', async () => {
      const id = await seedApp();

      await add(id, { localization: 'es-MX', origin: 'detected' }).expect(400);

      await expect(prisma.appLocalization.count()).resolves.toBe(0);
    });

    it('adds a localization no market reads', async () => {
      const id = await seedApp();

      const response = await add(id, { localization: 'de' }).expect(201);

      expect((response.body as { readBy: unknown[] }).readBy).toEqual([]);
    });

    it('answers 400 for a Google Play app and 404 for a missing app', async () => {
      const play = await seedApp('us', Store.GOOGLE_PLAY);

      const response = await add(play, { localization: 'es-MX' }).expect(400);

      expect(messageOf(response)).toBe(
        'The keyword field is only available for App Store apps',
      );
      await add('missing-app', { localization: 'es-MX' }).expect(404);
    });

    it('answers 400 for a competitor app and stores nothing', async () => {
      const rival = await seedCompetitor(await seedApp());

      const response = await add(rival, { localization: 'es-MX' }).expect(400);

      expect(messageOf(response)).toBe(COMPETITOR_REFUSAL);
      await expect(prisma.appLocalization.count()).resolves.toBe(0);
    });

    it('lets exactly one of two racing adds win', async () => {
      const id = await seedApp();
      const body = { localization: 'es-MX' };

      const responses = await Promise.all([add(id, body), add(id, body)]);

      expect(responses.map((response) => response.status).sort()).toEqual([
        201, 409,
      ]);
      await expect(prisma.appLocalization.count()).resolves.toBe(1);
    });
  });

  describe('removing a localization', () => {
    it('removes the row and the field and answers 204', async () => {
      const id = await seedApp();
      await saveField(id, { localization: 'es-MX' }, 'habito,metas').expect(
        200,
      );

      await remove(id, 'es-MX').expect(204);

      await expect(tagsOf(id)).resolves.toEqual(['en-US']);
      await expect(
        prisma.keywordField.count({ where: { appId: id } }),
      ).resolves.toBe(0);
      await expect(
        prisma.appLocalization.count({ where: { appId: id } }),
      ).resolves.toBe(0);
    });

    it('untracks the field phrases in every market that reads it and keeps a manual keyword', async () => {
      const id = await seedApp();
      await track(id, 'us', 'metas');
      await saveField(id, { localization: 'es-MX' }, 'habito,metas').expect(
        200,
      );
      await saveField(id, { country: 'mx' }, 'habito,metas').expect(200);

      await remove(id, 'es-MX').expect(204);

      await expect(sources(id, 'us')).resolves.toEqual({
        habito: 'KEYWORD_FIELD:false',
        metas: 'MANUAL:true',
      });
      await expect(sources(id, 'mx')).resolves.toEqual({
        habito: 'KEYWORD_FIELD:false',
        metas: 'KEYWORD_FIELD:false',
      });
    });

    it('keeps a phrase another saved field of the market still holds', async () => {
      const id = await seedApp();
      await saveField(id, {}, 'habit').expect(200);
      await saveField(id, { localization: 'es-MX' }, 'habit,metas').expect(200);

      await remove(id, 'es-MX').expect(204);

      await expect(sources(id, 'us')).resolves.toEqual({
        habit: 'KEYWORD_FIELD:true',
        metas: 'KEYWORD_FIELD:false',
      });
    });

    it('answers 409 for the home localization and changes nothing', async () => {
      const id = await seedApp();
      await saveField(id, {}, 'habit').expect(200);

      const response = await remove(id, 'en-US').expect(409);

      expect(messageOf(response)).toBe(
        'English (U.S.) is the default localization of the US storefront and cannot be removed',
      );
      await expect(itemOf(id, 'en-US')).resolves.toMatchObject({
        phrases: ['habit'],
      });
    });

    it('answers 404 for a localization the app does not ship', async () => {
      const id = await seedApp();

      const response = await remove(id, 'es-MX').expect(404);

      expect(messageOf(response)).toBe(
        "Spanish (Mexico) is not one of this app's localizations",
      );
    });

    it('answers 400 for a tag outside the 50', async () => {
      const id = await seedApp();

      const response = await remove(id, 'xx-YY').expect(400);

      expect(messageOf(response)).toBe('Unknown App Store localization: xx-YY');
      await remove(id, 'en-us').expect(400);
    });

    it('removes a localization that has a field and no row', async () => {
      const id = await seedApp();
      await seedField(id, 'fr', ['habitude']);

      await remove(id, 'fr').expect(204);

      await expect(
        prisma.keywordField.count({ where: { appId: id } }),
      ).resolves.toBe(0);
    });

    it('removes a detected localization that has no field', async () => {
      const id = await seedApp();
      await seedRow(id, 'es-MX', 'detected');

      await remove(id, 'es-MX').expect(204);

      await expect(prisma.appLocalization.count()).resolves.toBe(0);
    });

    it('answers 400 for a Google Play app and 404 for a missing app', async () => {
      const play = await seedApp('us', Store.GOOGLE_PLAY);

      await remove(play, 'es-MX').expect(400);
      await remove('missing-app', 'es-MX').expect(404);
    });

    it('answers 400 for a competitor app and keeps its row', async () => {
      const rival = await seedCompetitor(await seedApp());
      await seedRow(rival, 'es-MX');

      const response = await remove(rival, 'es-MX').expect(400);

      expect(messageOf(response)).toBe(COMPETITOR_REFUSAL);
      await expect(
        prisma.appLocalization.count({ where: { appId: rival } }),
      ).resolves.toBe(1);
    });

    it('leaves a field and its row together when a remove races a save', async () => {
      const id = await seedApp();
      await saveField(id, { localization: 'es-MX' }, 'habito').expect(200);

      const settled = await Promise.allSettled([
        asWorkspace(app, () =>
          app
            .get(KeywordFieldService)
            .setKeywordField(id, 'habito,metas', { localization: 'es-MX' }),
        ),
        asWorkspace(app, () =>
          app.get(AppLocalizationsService).remove(id, 'es-MX'),
        ),
      ]);

      const [fields, rows] = await Promise.all([
        prisma.keywordField.count({ where: { appId: id } }),
        prisma.appLocalization.count({ where: { appId: id } }),
      ]);
      expect(settled.filter(({ status }) => status === 'rejected')).toEqual([]);
      expect([0, 1]).toContain(fields);
      expect(fields).toBe(rows);
    });
  });
});
