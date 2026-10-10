import { execSync } from 'child_process';
import { join } from 'path';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient, Store } from '@prisma/client';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import { APP_STORE_LIB } from '../src/store-providers/app-store.lib';
import { GOOGLE_PLAY_LIB } from '../src/store-providers/google-play.lib';
import { Abortable } from '../src/store-providers/store-deadline';
import { obliterateQueues, pauseQueues } from './obliterate-queues';
import { ownerAgent, useCookies } from './helpers/session';
import { testDb } from './helpers/test-db';

const SLOW_STORE_MS = 26_000;
const MCP_DISPATCH_MS = 25_000;
const APPLE_ID = '1475326567';
const PLAY_ID = 'com.cyberlink.youcammakeup';

const aborted: string[] = [];

function answerLate<T>(
  label: string,
  value: T,
  options: Abortable,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => resolve(value), SLOW_STORE_MS);
    options.signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        aborted.push(label);
        reject(new Error('The operation was aborted due to timeout'));
      },
      { once: true },
    );
  });
}

const slowAppStore = {
  app: (options: Abortable) =>
    answerLate(
      'apple app',
      {
        id: Number(APPLE_ID),
        trackId: Number(APPLE_ID),
        title: '2048',
        subtitle: 'Number puzzle',
        description: 'Slide tiles',
        supportedDevices: ['iPhone15-iPhone15'],
      },
      options,
    ),
  page: (options: Abortable) =>
    answerLate('apple page', '<h1>2048</h1>', options),
};

const slowGooglePlay = {
  app: (options: Abortable) =>
    answerLate(
      'play app',
      {
        appId: PLAY_ID,
        title: 'YouCam Makeup',
        summary: 'Makeup camera',
        description: 'Try on looks',
        icon: 'https://example.com/icon.png',
        price: 0,
        version: '6.0',
        updated: 1719792000000,
        genre: 'Beauty',
        genreId: 'BEAUTY',
        screenshots: [],
      },
      options,
    ),
};

describe('on demand store calls (e2e)', () => {
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
    })
      .overrideProvider(APP_STORE_LIB)
      .useValue(slowAppStore)
      .overrideProvider(GOOGLE_PLAY_LIB)
      .useValue(slowGooglePlay)
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
    aborted.length = 0;
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "App", "Keyword" RESTART IDENTITY CASCADE',
    );
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await obliterateQueues(app);
    await app.close();
  });

  const seed = (store: Store, storeAppId: string, name: string) =>
    prisma.app.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store,
        storeAppId,
        country: 'us',
        name,
      },
    });

  const timed = async (
    route: string,
    send: () => Promise<{ status: number; body: { message?: string } }>,
  ) => {
    const started = Date.now();
    const response = await send();
    return {
      route,
      status: response.status,
      message: response.body.message,
      answeredInTime: Date.now() - started < MCP_DISPATCH_MS,
    };
  };

  it('answers a slow store with the store sentence before the proxy gives up and creates nothing afterwards', async () => {
    const apple = await seed(Store.APP_STORE, '284882215', '2048');
    const play = await seed(Store.GOOGLE_PLAY, PLAY_ID, 'YouCam Makeup');

    const answers = await Promise.all([
      timed('POST /apps', () =>
        api
          .post('/apps')
          .send({ url: `https://apps.apple.com/us/app/id${APPLE_ID}` }),
      ),
      timed('POST /apps/{2048}/refresh', () =>
        api.post(`/apps/${apple.id}/refresh`),
      ),
      timed('POST /apps/{YouCam Makeup}/refresh', () =>
        api.post(`/apps/${play.id}/refresh`),
      ),
    ]);

    expect(answers).toEqual([
      {
        route: 'POST /apps',
        status: 502,
        message: 'The App Store did not answer. Try again in a few minutes.',
        answeredInTime: true,
      },
      {
        route: 'POST /apps/{2048}/refresh',
        status: 502,
        message: 'The App Store did not answer. Try again in a few minutes.',
        answeredInTime: true,
      },
      {
        route: 'POST /apps/{YouCam Makeup}/refresh',
        status: 502,
        message: 'Google Play did not answer. Try again in a few minutes.',
        answeredInTime: true,
      },
    ]);
    expect(aborted.sort()).toEqual(['apple app', 'apple app', 'play app']);
    expect(await prisma.app.count({ where: { storeAppId: APPLE_ID } })).toBe(0);
    expect(
      await prisma.appSnapshot.count({
        where: { appId: { in: [apple.id, play.id] } },
      }),
    ).toBe(0);
  }, 40_000);
});
