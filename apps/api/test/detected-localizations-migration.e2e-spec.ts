import { execSync } from 'child_process';
import { join } from 'path';
import { Prisma, PrismaClient, Store } from '@prisma/client';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import { migrationSql } from './helpers/migration-sql';
import { testDb } from './helpers/test-db';

describe('the record detected app localizations migration (e2e)', () => {
  const sql = migrationSql('record_detected_app_localizations');
  let prisma: PrismaClient;

  const seedApp = (data: Partial<Prisma.AppUncheckedCreateInput> = {}) =>
    prisma.app.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store: Store.APP_STORE,
        storeAppId: `app-${Math.random()}`,
        country: 'pl',
        name: 'Where Am I',
        ...data,
      },
    });

  const snapshotOf = (
    appId: string,
    localization: string | null,
    country: string | null = null,
  ) =>
    prisma.appSnapshot.create({
      data: {
        appId,
        localization,
        country,
        title: 'Title',
        description: 'Text',
        raw: {},
      },
    });

  const rows = () =>
    prisma.appLocalization.findMany({
      orderBy: [{ appId: 'asc' }, { localization: 'asc' }],
      select: {
        appId: true,
        workspaceId: true,
        localization: true,
        origin: true,
      },
    });

  const migrate = () => prisma.$executeRawUnsafe(sql);

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
    prisma.$executeRawUnsafe('TRUNCATE TABLE "App" RESTART IDENTITY CASCADE'),
  );

  afterAll(() => prisma.$disconnect());

  it('E-MIG-01 records a detected row for each localization with a stored native snapshot', async () => {
    const app = await seedApp();
    await snapshotOf(app.id, null);
    await snapshotOf(app.id, 'pl');
    await snapshotOf(app.id, 'de');

    await migrate();

    await expect(rows()).resolves.toEqual(
      ['de', 'pl'].map((localization) => ({
        appId: app.id,
        workspaceId: DEFAULT_WORKSPACE_ID,
        localization,
        origin: 'detected',
      })),
    );
  });

  it('E-MIG-08 files each row under the workspace of its own app', async () => {
    await prisma.workspace.create({
      data: { id: 'ws_migration_other', name: 'Other' },
    });
    try {
      const own = await seedApp();
      const other = await seedApp({ workspaceId: 'ws_migration_other' });
      await snapshotOf(own.id, 'pl');
      await snapshotOf(other.id, 'de');

      await migrate();

      await expect(
        prisma.appLocalization.findMany({
          orderBy: { localization: 'asc' },
          select: { appId: true, workspaceId: true, localization: true },
        }),
      ).resolves.toEqual([
        {
          appId: other.id,
          workspaceId: 'ws_migration_other',
          localization: 'de',
        },
        {
          appId: own.id,
          workspaceId: DEFAULT_WORKSPACE_ID,
          localization: 'pl',
        },
      ]);
    } finally {
      await prisma.workspace.delete({ where: { id: 'ws_migration_other' } });
    }
  });

  it('E-MIG-09 stamps a row with the first capture of its localization', async () => {
    const app = await seedApp();
    for (const capturedAt of ['2026-07-03', '2026-07-01', '2026-07-02']) {
      await prisma.appSnapshot.create({
        data: {
          appId: app.id,
          localization: 'pl',
          title: 'Title',
          description: 'Text',
          raw: {},
          capturedAt: new Date(`${capturedAt}T03:00:00.000Z`),
        },
      });
    }

    await migrate();

    await expect(
      prisma.appLocalization.findMany({ select: { createdAt: true } }),
    ).resolves.toEqual([{ createdAt: new Date('2026-07-01T03:00:00.000Z') }]);
  });

  it('E-MIG-02 records one row for a localization stored many times or in several markets', async () => {
    const app = await seedApp();
    await snapshotOf(app.id, 'pl');
    await snapshotOf(app.id, 'pl');
    await snapshotOf(app.id, 'pl');
    await snapshotOf(app.id, 'pl', 'de');

    await migrate();

    await expect(rows()).resolves.toEqual([
      {
        appId: app.id,
        workspaceId: DEFAULT_WORKSPACE_ID,
        localization: 'pl',
        origin: 'detected',
      },
    ]);
  });

  it('E-MIG-03 records nothing for default listings or a google play app', async () => {
    const appStore = await seedApp();
    await snapshotOf(appStore.id, null);
    await snapshotOf(appStore.id, null, 'de');
    const play = await seedApp({ store: Store.GOOGLE_PLAY });
    await snapshotOf(play.id, 'pl');

    await migrate();

    await expect(rows()).resolves.toEqual([]);
  });

  it('E-MIG-04 records nothing for a competitor', async () => {
    const primary = await seedApp();
    const competitor = await seedApp({
      isCompetitor: true,
      primaryAppId: primary.id,
    });
    await snapshotOf(competitor.id, 'pl');

    await migrate();

    await expect(rows()).resolves.toEqual([]);
  });

  it('E-MIG-05 keeps an existing manual row manual', async () => {
    const app = await seedApp();
    await prisma.appLocalization.create({
      data: {
        appId: app.id,
        workspaceId: DEFAULT_WORKSPACE_ID,
        localization: 'pl',
        origin: 'manual',
      },
    });
    await snapshotOf(app.id, 'pl');

    await migrate();

    await expect(rows()).resolves.toEqual([
      {
        appId: app.id,
        workspaceId: DEFAULT_WORKSPACE_ID,
        localization: 'pl',
        origin: 'manual',
      },
    ]);
  });

  it('E-MIG-06 can run twice', async () => {
    const app = await seedApp();
    await snapshotOf(app.id, 'pl');
    await snapshotOf(app.id, 'de');

    await migrate();
    await migrate();

    await expect(prisma.appLocalization.count()).resolves.toBe(2);
  });

  it('E-MIG-07 does not read the migration history', () => {
    expect(sql).not.toContain('_prisma_migrations');
  });
});
