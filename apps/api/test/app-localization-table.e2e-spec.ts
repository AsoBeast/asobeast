import { execSync } from 'child_process';
import { join } from 'path';
import { PrismaClient, Store } from '@prisma/client';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import { migrationSql } from './helpers/migration-sql';
import { testDb } from './helpers/test-db';

describe('the app localization table (e2e)', () => {
  const sql = migrationSql('add_app_localizations');
  const backfill =
    /INSERT INTO "AppLocalization"[\s\S]*?;/.exec(sql)?.[0] ?? '';
  let prisma: PrismaClient;

  const seedApp = (storeAppId: string) =>
    prisma.app.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store: Store.APP_STORE,
        storeAppId,
        country: 'us',
        name: storeAppId,
      },
    });

  const seedField = (appId: string, localization: string) =>
    prisma.keywordField.create({
      data: {
        appId,
        workspaceId: DEFAULT_WORKSPACE_ID,
        localization,
        phrases: ['habit'],
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

  it('files a manual row for every stored keyword field', async () => {
    const [first, second] = [await seedApp('a'), await seedApp('b')];
    await seedField(first.id, 'en-US');
    await seedField(first.id, 'es-MX');
    await seedField(second.id, 'de');

    await prisma.$executeRawUnsafe(backfill);

    await expect(rows()).resolves.toEqual(
      [
        { appId: first.id, localization: 'en-US' },
        { appId: first.id, localization: 'es-MX' },
        { appId: second.id, localization: 'de' },
      ]
        .map((row) => ({
          ...row,
          workspaceId: DEFAULT_WORKSPACE_ID,
          origin: 'manual',
        }))
        .sort(
          (left, right) =>
            left.appId.localeCompare(right.appId) ||
            left.localization.localeCompare(right.localization),
        ),
    );
  });

  it('leaves a row that already exists as it is', async () => {
    const app = await seedApp('a');
    await seedField(app.id, 'es-MX');
    await prisma.appLocalization.create({
      data: {
        appId: app.id,
        workspaceId: DEFAULT_WORKSPACE_ID,
        localization: 'es-MX',
        origin: 'detected',
      },
    });

    await prisma.$executeRawUnsafe(backfill);

    await expect(rows()).resolves.toEqual([
      {
        appId: app.id,
        workspaceId: DEFAULT_WORKSPACE_ID,
        localization: 'es-MX',
        origin: 'detected',
      },
    ]);
  });

  it('can run twice without changing the table', async () => {
    const app = await seedApp('a');
    await seedField(app.id, 'en-US');
    await seedField(app.id, 'es-MX');

    await prisma.$executeRawUnsafe(backfill);
    await prisma.$executeRawUnsafe(backfill);

    await expect(prisma.appLocalization.count()).resolves.toBe(2);
  });

  it('never reads the migration history table', () => {
    expect(sql).not.toContain('_prisma_migrations');
  });

  it('deletes the rows of an app with the app', async () => {
    const app = await seedApp('a');
    await prisma.appLocalization.create({
      data: {
        appId: app.id,
        workspaceId: DEFAULT_WORKSPACE_ID,
        localization: 'es-MX',
        origin: 'manual',
      },
    });

    await prisma.app.delete({ where: { id: app.id } });

    await expect(prisma.appLocalization.count()).resolves.toBe(0);
  });

  it('refuses a row that names another workspace than its app', async () => {
    const app = await seedApp('a');
    await prisma.workspace.create({ data: { id: 'ws_other', name: 'Other' } });
    try {
      await expect(
        prisma.appLocalization.create({
          data: {
            appId: app.id,
            workspaceId: 'ws_other',
            localization: 'es-MX',
            origin: 'manual',
          },
        }),
      ).rejects.toThrow();
    } finally {
      await prisma.workspace.delete({ where: { id: 'ws_other' } });
    }
  });
});
