import { execSync } from 'child_process';
import { join } from 'path';
import { PrismaClient, Store } from '@prisma/client';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import { migrationSql } from './helpers/migration-sql';
import { testDb } from './helpers/test-db';

describe('the app setup table (e2e)', () => {
  const sql = migrationSql('add_app_setup');
  const backfill = /INSERT INTO "AppSetup"[\s\S]*?;/.exec(sql)?.[0] ?? '';
  let prisma: PrismaClient;

  const seedApp = (
    storeAppId: string,
    options: { country?: string; primaryAppId?: string } = {},
  ) =>
    prisma.app.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store: Store.APP_STORE,
        storeAppId,
        country: options.country ?? 'us',
        name: storeAppId,
        isCompetitor: Boolean(options.primaryAppId),
        primaryAppId: options.primaryAppId,
      },
    });

  const rows = () =>
    prisma.appSetup.findMany({
      orderBy: { appId: 'asc' },
      select: {
        appId: true,
        workspaceId: true,
        status: true,
        skipped: true,
        countriesReviewed: true,
        selectedMarkets: true,
        completedAt: true,
      },
    });

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

  beforeEach(() =>
    prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "App", "Keyword" RESTART IDENTITY CASCADE',
    ),
  );

  afterAll(() => prisma.$disconnect());

  it('backfills a not started row for every primary app without one', async () => {
    const app = await seedApp('a', { country: 'de' });

    await prisma.$executeRawUnsafe(backfill);

    await expect(rows()).resolves.toEqual([
      {
        appId: app.id,
        workspaceId: DEFAULT_WORKSPACE_ID,
        status: 'not_started',
        skipped: [],
        countriesReviewed: false,
        selectedMarkets: ['de'],
        completedAt: null,
      },
    ]);
  });

  it('never touches a competitor or an existing row', async () => {
    const primary = await seedApp('a');
    const competitor = await seedApp('b', { primaryAppId: primary.id });
    await prisma.appSetup.create({
      data: {
        appId: primary.id,
        workspaceId: DEFAULT_WORKSPACE_ID,
        status: 'in_progress',
        selectedMarkets: ['us', 'de'],
      },
    });

    await prisma.$executeRawUnsafe(backfill);

    await expect(
      prisma.appSetup.findUnique({ where: { appId: competitor.id } }),
    ).resolves.toBeNull();
    await expect(
      prisma.appSetup.findUnique({
        where: { appId: primary.id },
        select: { status: true, selectedMarkets: true },
      }),
    ).resolves.toEqual({
      status: 'in_progress',
      selectedMarkets: ['us', 'de'],
    });
  });

  it('stamps each row with the time its app was imported', async () => {
    const importedAt = new Date('2026-07-01T00:00:00.000Z');
    await prisma.app.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store: Store.APP_STORE,
        storeAppId: 'a',
        country: 'us',
        createdAt: importedAt,
      },
    });

    await prisma.$executeRawUnsafe(backfill);

    await expect(
      prisma.appSetup.findMany({
        select: { createdAt: true, updatedAt: true },
      }),
    ).resolves.toEqual([{ createdAt: importedAt, updatedAt: importedAt }]);
  });

  it('is idempotent', async () => {
    await seedApp('a');
    await seedApp('b');

    await prisma.$executeRawUnsafe(backfill);
    const first = await rows();
    await prisma.$executeRawUnsafe(backfill);

    await expect(rows()).resolves.toEqual(first);
    expect(first).toHaveLength(2);
  });

  it('deletes the row with its app', async () => {
    const app = await seedApp('a');
    await prisma.$executeRawUnsafe(backfill);

    await prisma.app.delete({ where: { id: app.id } });

    await expect(prisma.appSetup.count()).resolves.toBe(0);
  });

  it('deletes the row with its workspace', async () => {
    const workspace = await prisma.workspace.create({
      data: { id: 'ws_setup_gone', name: 'Gone' },
    });
    await prisma.app.create({
      data: {
        workspaceId: workspace.id,
        store: Store.APP_STORE,
        storeAppId: 'a',
        country: 'us',
      },
    });
    await prisma.$executeRawUnsafe(backfill);

    await prisma.workspace.delete({ where: { id: workspace.id } });

    await expect(prisma.appSetup.count()).resolves.toBe(0);
  });

  it('refuses a row that names another workspace than its app', async () => {
    const app = await seedApp('a');
    await prisma.workspace.create({ data: { id: 'ws_other', name: 'Other' } });
    try {
      await expect(
        prisma.appSetup.create({
          data: { appId: app.id, workspaceId: 'ws_other' },
        }),
      ).rejects.toThrow('AppSetup_appId_workspaceId_fkey');
    } finally {
      await prisma.workspace.delete({ where: { id: 'ws_other' } });
    }
  });

  it('never reads the migration history table', () => {
    expect(sql).not.toContain('_prisma_migrations');
  });
});
