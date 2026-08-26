import { execSync } from 'child_process';
import { join } from 'path';
import { ConflictException, INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient, Store } from '@prisma/client';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { AppsService } from '../src/apps/apps.service';
import { CompetitorsService } from '../src/competitors/competitors.service';
import { KeywordsService } from '../src/keywords/keywords.service';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import { StoreProviderRegistry } from '../src/store-providers/store-provider.registry';
import { NormalizedApp, StoreProvider } from '../src/store-providers/types';
import { asWorkspace } from './helpers/tenancy';
import { testDb } from './helpers/test-db';
import { obliterateQueues, pauseQueues } from './obliterate-queues';

const FIXTURE: NormalizedApp = {
  store: Store.APP_STORE,
  storeAppId: '1',
  title: 'Contested App',
  description: 'Contested description',
  raw: { source: 'fixture' },
};

const CONTESTED = '5550001';
const CONTESTED_URL = `https://apps.apple.com/us/app/fixture/id${CONTESTED}`;

class SlowRegistry {
  get(store: Store): StoreProvider {
    return {
      store,
      getApp: (storeAppId: string) =>
        new Promise((resolve) =>
          setTimeout(() => resolve({ ...FIXTURE, storeAppId }), 25),
        ),
      search: () => Promise.resolve([]),
      suggest: () => Promise.resolve([]),
      similar: () => Promise.resolve([]),
    } as unknown as StoreProvider;
  }
}

describe('Store identity under concurrency (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let apps: AppsService;
  let competitors: CompetitorsService;
  let keywords: KeywordsService;

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
      .useValue(new SlowRegistry())
      .compile();

    app = moduleFixture.createNestApplication<App>();
    await app.init();
    await pauseQueues(app);

    apps = app.get(AppsService);
    competitors = app.get(CompetitorsService);
    keywords = app.get(KeywordsService);

    prisma = testDb();
    await prisma.workspace.upsert({
      where: { id: DEFAULT_WORKSPACE_ID },
      update: {},
      create: { id: DEFAULT_WORKSPACE_ID, name: 'Default' },
    });
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "App", "Keyword" RESTART IDENTITY CASCADE',
    );
  });

  afterAll(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "App", "Keyword" RESTART IDENTITY CASCADE',
    );
    await obliterateQueues(app);
    await app.close();
    await prisma.$disconnect();
  });

  const seedPrimary = () =>
    prisma.app.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store: Store.APP_STORE,
        storeAppId: 'host',
        country: 'us',
      },
      select: { id: true },
    });

  const seedSnapshot = async () => {
    const row = await prisma.app.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store: Store.APP_STORE,
        storeAppId: CONTESTED,
        country: 'us',
        name: FIXTURE.title,
      },
      select: { id: true },
    });
    await prisma.appSnapshot.create({
      data: {
        appId: row.id,
        title: FIXTURE.title,
        subtitle: 'Tower defense strategy',
        description: FIXTURE.description ?? '',
        raw: {},
      },
    });
    return row.id;
  };

  const rowsFor = (storeAppId: string) =>
    prisma.app.findMany({
      where: { storeAppId },
      select: { isCompetitor: true, primaryAppId: true },
    });

  it('lets only one of a racing import and competitor add claim the identity', async () => {
    const host = await seedPrimary();

    const settled = await asWorkspace(app, () =>
      Promise.allSettled([
        apps.importFromUrl(CONTESTED_URL),
        competitors.add(host.id, CONTESTED_URL),
      ]),
    );

    const fulfilled = settled.filter((entry) => entry.status === 'fulfilled');
    const refused = settled.filter(
      (entry) =>
        entry.status === 'rejected' &&
        entry.reason instanceof ConflictException,
    );

    expect(fulfilled).toHaveLength(1);
    expect(refused).toHaveLength(1);

    const rows = await rowsFor(CONTESTED);
    expect(rows).toHaveLength(1);
    expect(rows[0].isCompetitor).toBe(rows[0].primaryAppId !== null);
  });

  it('lets only one of two racing imports claim the identity', async () => {
    const settled = await asWorkspace(app, () =>
      Promise.allSettled([
        apps.importFromUrl(CONTESTED_URL),
        apps.importFromUrl(CONTESTED_URL),
      ]),
    );

    expect(
      settled.filter((entry) => entry.status === 'fulfilled'),
    ).toHaveLength(2);

    const rows = await rowsFor(CONTESTED);
    expect(rows).toHaveLength(1);
    expect(rows[0].isCompetitor).toBe(false);
  });

  it('auto tracks the snapshot once when two syncs run at the same time', async () => {
    const appId = await seedSnapshot();

    const settled = await asWorkspace(app, () =>
      Promise.allSettled([
        keywords.syncFromSnapshot(appId),
        keywords.syncFromSnapshot(appId),
      ]),
    );

    expect(settled.filter((entry) => entry.status === 'rejected')).toEqual([]);

    const tracked = await prisma.trackedKeyword.findMany({
      where: { appId },
      select: { keywordId: true },
    });
    expect(tracked.length).toBeGreaterThan(0);
    expect(new Set(tracked.map((row) => row.keywordId)).size).toBe(
      tracked.length,
    );
  });

  it('refuses a competitor add once the import already owns the identity', async () => {
    const host = await seedPrimary();
    await asWorkspace(app, () => apps.importFromUrl(CONTESTED_URL));

    await expect(
      asWorkspace(app, () => competitors.add(host.id, CONTESTED_URL)),
    ).rejects.toBeInstanceOf(ConflictException);

    const rows = await rowsFor(CONTESTED);
    expect(rows).toHaveLength(1);
    expect(rows[0].isCompetitor).toBe(false);
  });
});
