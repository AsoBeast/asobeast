import { execSync } from 'child_process';
import { join } from 'path';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient, Store } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import { RetentionService } from '../src/jobs/retention.service';
import { testDb } from './helpers/test-db';
import { obliterateQueues } from './obliterate-queues';

const ASSET =
  'https://is1-ssl.mzstatic.com/image/thumb/PurpleSource/v4/aa/bb/cc/1.jpg';

describe('Screenshot tables (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;

  beforeAll(async () => {
    execSync('pnpm prisma migrate deploy', {
      cwd: join(__dirname, '..'),
      env: process.env,
      stdio: 'ignore',
    });
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
    prisma = testDb();
    await prisma.workspace.upsert({
      where: { id: DEFAULT_WORKSPACE_ID },
      update: {},
      create: { id: DEFAULT_WORKSPACE_ID, name: 'Default' },
    });
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "App", "ScreenshotText" RESTART IDENTITY CASCADE',
    );
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await obliterateQueues(app);
    await app.close();
  });

  const seedSnapshot = async () => {
    const owned = await prisma.app.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store: Store.APP_STORE,
        storeAppId: '111',
        country: 'us',
        name: 'Mine',
      },
    });
    const snapshot = await prisma.appSnapshot.create({
      data: { appId: owned.id, title: 'Mine', description: 'd', raw: {} },
    });
    await prisma.snapshotScreenshot.createMany({
      data: [1, 2].map((position) => ({
        snapshotId: snapshot.id,
        workspaceId: DEFAULT_WORKSPACE_ID,
        position,
        url: `${ASSET}/392x696bb.jpg`,
        assetKey: ASSET,
      })),
    });
    return { owned, snapshot };
  };

  it('defaults a new screenshot to pending with no caption', async () => {
    const { snapshot } = await seedSnapshot();

    const rows = await prisma.snapshotScreenshot.findMany({
      where: { snapshotId: snapshot.id },
      orderBy: { position: 'asc' },
    });

    expect(rows.map((row) => [row.position, row.status, row.caption])).toEqual([
      [1, 'pending', null],
      [2, 'pending', null],
    ]);
  });

  it('removes the screenshots of a snapshot when the snapshot is deleted', async () => {
    const { snapshot } = await seedSnapshot();

    await prisma.appSnapshot.delete({ where: { id: snapshot.id } });

    await expect(prisma.snapshotScreenshot.count()).resolves.toBe(0);
  });

  it('removes the screenshots of an app when the app is deleted and keeps the shared text', async () => {
    const { owned } = await seedSnapshot();
    await prisma.screenshotText.create({
      data: {
        assetKey: ASSET,
        recipe: 'ocr1:eng',
        status: 'read',
        caption: 'Track every habit',
        engine: 'tesseract.js@7.0.0',
      },
    });

    await prisma.app.delete({ where: { id: owned.id } });

    await expect(prisma.snapshotScreenshot.count()).resolves.toBe(0);
    await expect(prisma.screenshotText.count()).resolves.toBe(1);
  });

  it('keeps one cached text per image and recipe and lets another recipe coexist', async () => {
    const data = {
      assetKey: ASSET,
      status: 'read',
      engine: 'tesseract.js@7.0.0',
    };
    await prisma.screenshotText.create({
      data: { ...data, recipe: 'ocr1:eng' },
    });
    await prisma.screenshotText.create({
      data: { ...data, recipe: 'ocr1:eng+jpn' },
    });

    await expect(
      prisma.screenshotText.create({ data: { ...data, recipe: 'ocr1:eng' } }),
    ).rejects.toThrow();
    await expect(prisma.screenshotText.count()).resolves.toBe(2);
  });

  it('stores a structured detail on a change event and reads it back', async () => {
    const { owned } = await seedSnapshot();
    const detail = { kind: 'captions', added: ['Track habits'], removed: [] };

    const event = await prisma.changeEvent.create({
      data: { appId: owned.id, field: 'screenshotCaptions', detail },
    });

    await expect(
      prisma.changeEvent.findUnique({ where: { id: event.id } }),
    ).resolves.toMatchObject({ detail });
  });
  it('prunes a cached text unused for ninety days and keeps a recent one', async () => {
    const old = new Date(Date.now() - 100 * 86_400_000);
    await prisma.screenshotText.createMany({
      data: [
        {
          assetKey: `${ASSET}/old`,
          recipe: 'ocr1:eng',
          status: 'read',
          engine: 'e',
          usedAt: old,
        },
        {
          assetKey: `${ASSET}/new`,
          recipe: 'ocr1:eng',
          status: 'read',
          engine: 'e',
        },
      ],
    });

    const deleted = await app.get(RetentionService).prune();

    expect(deleted.screenshotText).toBe(1);
    await expect(
      prisma.screenshotText.findMany({ select: { assetKey: true } }),
    ).resolves.toEqual([{ assetKey: `${ASSET}/new` }]);
  });

  it('removes the screenshot rows of a pruned snapshot and keeps the newest snapshot of the app', async () => {
    const { owned, snapshot } = await seedSnapshot();
    const newest = await prisma.appSnapshot.create({
      data: { appId: owned.id, title: 'Mine', description: 'd', raw: {} },
    });
    await prisma.appSnapshot.update({
      where: { id: snapshot.id },
      data: { capturedAt: new Date(Date.now() - 400 * 86_400_000) },
    });

    await app.get(RetentionService).prune();

    await expect(
      prisma.appSnapshot.findUnique({ where: { id: snapshot.id } }),
    ).resolves.toBeNull();
    await expect(
      prisma.appSnapshot.findUnique({ where: { id: newest.id } }),
    ).resolves.not.toBeNull();
    await expect(prisma.snapshotScreenshot.count()).resolves.toBe(0);
  });

  it('prunes market snapshots per market and keeps the screenshot rows of the newest one', async () => {
    const { owned, snapshot: home } = await seedSnapshot();
    const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000);
    const marketSnapshot = async (capturedAt: Date) => {
      const created = await prisma.appSnapshot.create({
        data: {
          appId: owned.id,
          country: 'de',
          title: 'Mine',
          description: 'd',
          raw: {},
          capturedAt,
        },
      });
      await prisma.snapshotScreenshot.create({
        data: {
          snapshotId: created.id,
          workspaceId: DEFAULT_WORKSPACE_ID,
          position: 1,
          url: `${ASSET}/392x696bb.jpg`,
          assetKey: ASSET,
        },
      });
      return created;
    };
    const pruned = await marketSnapshot(daysAgo(500));
    const kept = await marketSnapshot(daysAgo(400));
    await prisma.appSnapshot.update({
      where: { id: home.id },
      data: { capturedAt: daysAgo(450) },
    });

    await app.get(RetentionService).prune();

    const rows = await prisma.snapshotScreenshot.findMany({
      select: { snapshotId: true },
    });
    expect(new Set(rows.map((row) => row.snapshotId))).toEqual(
      new Set([home.id, kept.id]),
    );
    await expect(
      prisma.appSnapshot.findUnique({ where: { id: pruned.id } }),
    ).resolves.toBeNull();
  });
});
