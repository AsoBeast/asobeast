import { execSync } from 'child_process';
import { join } from 'path';
import { PrismaClient, Store } from '@prisma/client';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import { migrationSql } from './helpers/migration-sql';
import { testDb } from './helpers/test-db';

const DATE = new Date('2026-10-01T00:00:00.000Z');

describe('the repair app store category depth migration', () => {
  const sql = migrationSql('repair_app_store_category_depth');
  let prisma: PrismaClient;

  beforeAll(async () => {
    execSync('pnpm prisma migrate deploy', {
      cwd: join(__dirname, '..'),
      env: process.env,
      stdio: 'ignore',
    });
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
    await prisma.$disconnect();
  });

  const seedRank = async (store: Store, depth: number) => {
    const app = await prisma.app.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store,
        storeAppId: `${store}-${depth}`,
        country: 'us',
        name: store,
      },
    });
    await prisma.categoryRank.create({
      data: {
        appId: app.id,
        date: DATE,
        collection: 'free',
        genre: 'overall',
        position: null,
        depth,
      },
    });
    return app.id;
  };

  const depthOf = async (appId: string) =>
    (await prisma.categoryRank.findFirstOrThrow({ where: { appId } })).depth;

  it('records the depth the app store feed answers and leaves google play alone', async () => {
    const appStore = await seedRank(Store.APP_STORE, 200);
    const googlePlay = await seedRank(Store.GOOGLE_PLAY, 200);

    await prisma.$executeRawUnsafe(sql);

    await expect(depthOf(appStore)).resolves.toBe(100);
    await expect(depthOf(googlePlay)).resolves.toBe(200);
  });
});
