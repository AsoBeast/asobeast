import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundError } from '@mradex77/google-play-scraper';
import { PrismaClient, Store } from '@prisma/client';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { ListingCaptureService } from '../src/apps/listing-capture.service';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import {
  GOOGLE_PLAY_LIB,
  GooglePlayAppResult,
} from '../src/store-providers/google-play.lib';
import { useCookies } from './helpers/session';
import { asWorkspace } from './helpers/tenancy';
import { testDb } from './helpers/test-db';
import { obliterateQueues, pauseQueues } from './obliterate-queues';

const STORE_APP_ID = 'com.example.listed';

const listing: GooglePlayAppResult = {
  appId: STORE_APP_ID,
  title: 'Listed',
  summary: 'Short description',
  description: 'Full description',
  icon: 'https://icon',
  score: 4.2,
  ratings: 5000,
  minInstalls: 1000000,
  price: 0,
  version: '3.1.0',
  released: 'May 30, 2013',
  updated: 1719792000000,
  genre: 'Tools',
  genreId: 'TOOLS',
  screenshots: [],
  recentChanges: 'Bug fixes',
};

const notFound = () =>
  new NotFoundError(
    'App not found (404)',
    404,
    `https://play.google.com/store/apps/details?id=${STORE_APP_ID}`,
  );

describe('Google Play not found retry (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let capture: ListingCaptureService;
  const playApp = jest.fn<Promise<GooglePlayAppResult>, [unknown]>();

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(GOOGLE_PLAY_LIB)
      .useValue({ app: playApp })
      .compile();
    app = moduleFixture.createNestApplication();
    useCookies(app);
    await app.init();
    await pauseQueues(app);
    prisma = testDb();
    capture = app.get(ListingCaptureService);
    await prisma.workspace.upsert({
      where: { id: DEFAULT_WORKSPACE_ID },
      update: {},
      create: { id: DEFAULT_WORKSPACE_ID, name: 'Default' },
    });
  });

  beforeEach(async () => {
    playApp.mockReset();
    jest.restoreAllMocks();
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "App", "AlertEvent" RESTART IDENTITY CASCADE',
    );
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await obliterateQueues(app);
    await app.close();
  });

  const seedPlayApp = () =>
    prisma.app.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store: Store.GOOGLE_PLAY,
        storeAppId: STORE_APP_ID,
        country: 'us',
        name: 'Listed',
      },
    });

  const refresh = (appId: string) =>
    asWorkspace(app, () => capture.refreshListing(appId));

  it('keeps a play app listed after one not found answer', async () => {
    const listed = await seedPlayApp();
    playApp.mockRejectedValueOnce(notFound()).mockResolvedValue(listing);

    await refresh(listed.id);

    const stored = await prisma.app.findUniqueOrThrow({
      where: { id: listed.id },
    });
    expect(stored.delistedAt).toBeNull();
    expect(
      await prisma.alertEvent.count({ where: { event: 'app.delisted' } }),
    ).toBe(0);
    expect(
      await prisma.appSnapshot.count({ where: { appId: listed.id } }),
    ).toBe(1);
    expect(playApp).toHaveBeenCalledTimes(2);
  }, 15_000);
});
