import { execSync } from 'child_process';
import { join } from 'path';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient, Store } from '@prisma/client';
import {
  ApiErrorEnvelope,
  KEYWORD_FIELD_CHAR_LIMIT,
  keywordFieldLocalizations,
  MarketKeywordFields,
} from '@asobeast/shared';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import { seedApiToken } from './helpers/api-tokens';
import { ownerAgent, useCookies } from './helpers/session';
import { testDb } from './helpers/test-db';
import { obliterateQueues, pauseQueues } from './obliterate-queues';

describe('Market keyword fields (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let api: Awaited<ReturnType<typeof ownerAgent>>;

  const seedApp = async (
    country = 'us',
    store: Store = Store.APP_STORE,
  ): Promise<string> =>
    (
      await prisma.app.create({
        data: {
          workspaceId: DEFAULT_WORKSPACE_ID,
          store,
          storeAppId: `market-${store}-${country}`,
          country,
        },
        select: { id: true },
      })
    ).id;

  const ship = async (
    appId: string,
    localization: string,
    phrases: string[] = [],
  ) => {
    await prisma.appLocalization.create({
      data: {
        appId,
        workspaceId: DEFAULT_WORKSPACE_ID,
        localization,
        origin: 'manual',
      },
    });
    if (phrases.length > 0) {
      await prisma.keywordField.create({
        data: {
          appId,
          workspaceId: DEFAULT_WORKSPACE_ID,
          localization,
          phrases,
        },
      });
    }
  };

  const read = (appId: string, country?: string) =>
    api
      .get(`/apps/${appId}/keyword-fields/market`)
      .query(country === undefined ? {} : { country });

  const bodyOf = (response: { body: unknown }) =>
    response.body as MarketKeywordFields;

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

  it('E-MKT-01 reads ten localizations for a us app that ships two, the rest unshipped', async () => {
    const appId = await seedApp();
    await ship(appId, 'es-MX', ['uno', 'dos']);

    const body = bodyOf(await read(appId).expect(200));

    expect(body).toMatchObject({ country: 'us', home: true });
    expect(body.localizations.map(({ localization }) => localization)).toEqual(
      keywordFieldLocalizations('us'),
    );
    expect(body.localizations[0]).toMatchObject({
      localization: 'en-US',
      role: 'default',
      shipped: true,
      origin: 'home',
    });
    expect(
      body.localizations.find(({ localization }) => localization === 'es-MX'),
    ).toEqual({
      localization: 'es-MX',
      role: 'additional',
      shipped: true,
      origin: 'manual',
      phrases: ['uno', 'dos'],
      charactersUsed: 7,
      charactersLimit: KEYWORD_FIELD_CHAR_LIMIT,
    });
    const unshipped = body.localizations.filter(({ shipped }) => !shipped);
    expect(unshipped).toHaveLength(8);
    expect(
      unshipped.every(
        ({ origin, phrases, charactersUsed }) =>
          origin === null && phrases.length === 0 && charactersUsed === 0,
      ),
    ).toBe(true);
  });

  it('E-MKT-02 reads the mx market of a us app: spanish default shipped, english (u.k.) unshipped', async () => {
    const appId = await seedApp();
    await ship(appId, 'es-MX', ['uno', 'dos']);

    const body = bodyOf(await read(appId, 'mx').expect(200));

    expect(body).toEqual({
      country: 'mx',
      home: false,
      localizations: [
        {
          localization: 'es-MX',
          role: 'default',
          shipped: true,
          origin: 'manual',
          phrases: ['uno', 'dos'],
          charactersUsed: 7,
          charactersLimit: KEYWORD_FIELD_CHAR_LIMIT,
        },
        {
          localization: 'en-GB',
          role: 'additional',
          shipped: false,
          origin: null,
          phrases: [],
          charactersUsed: 0,
          charactersLimit: KEYWORD_FIELD_CHAR_LIMIT,
        },
      ],
    });
  });

  it('E-MKT-03 reads a storefront the app does not track keywords in', async () => {
    const appId = await seedApp();

    const body = bodyOf(await read(appId, 'de').expect(200));

    expect(
      body.localizations.map(({ localization, role, shipped }) => [
        localization,
        role,
        shipped,
      ]),
    ).toEqual([
      ['de', 'default', false],
      ['en-GB', 'additional', false],
    ]);
  });

  it('E-MKT-04 refuses a country that is not a storefront', async () => {
    const appId = await seedApp();

    const response = await read(appId, 'zz').expect(400);

    expect((response.body as ApiErrorEnvelope).message).toBe(
      'zz is not an App Store storefront',
    );
  });

  it('E-MKT-05 reads english (u.k.) for a home country that is no storefront', async () => {
    const appId = await seedApp('zz');

    const body = bodyOf(await read(appId).expect(200));

    expect(body).toMatchObject({ country: 'zz', home: true });
    expect(body.localizations).toEqual([
      expect.objectContaining({
        localization: 'en-GB',
        role: 'default',
        shipped: true,
        origin: 'home',
      }),
    ]);
    await read(appId, 'zz').expect(200);
  });

  it.each(['MX', 'usa', 'm', ''])(
    'E-MKT-06 refuses a malformed country (%j)',
    async (country) => {
      const appId = await seedApp();

      await read(appId, country).expect(400);
    },
  );

  it('E-MKT-07 refuses a Google Play app and a missing app', async () => {
    const appId = await seedApp('us', Store.GOOGLE_PLAY);

    const response = await read(appId).expect(400);

    expect((response.body as ApiErrorEnvelope).message).toBe(
      'The keyword field is only available for App Store apps',
    );
    await api.get('/apps/missing-app/keyword-fields/market').expect(404);
  });

  it('E-MKT-08 lets a read only token read', async () => {
    const appId = await seedApp();
    const token = await seedApiToken(prisma, {
      seed: 'marketreader',
      email: 'market-reader@example.com',
      workspaceId: DEFAULT_WORKSPACE_ID,
      role: 'member',
      scope: 'read',
    });

    await request(app.getHttpServer())
      .get(`/apps/${appId}/keyword-fields/market`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
  });
});
