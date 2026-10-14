import { execSync } from 'child_process';
import { join } from 'path';
import { PrismaClient, Store } from '@prisma/client';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import {
  dropHistoricalFieldOrder,
  restoreHistoricalFieldOrder,
} from './helpers/historical-field-order';
import { migrationFolder, migrationSql } from './helpers/migration-sql';
import { testDb } from './helpers/test-db';

const statementOf = (sql: string, pattern: RegExp): string => {
  const found = pattern.exec(sql);
  if (!found) throw new Error(`no statement matches ${pattern}`);
  return found[0];
};

describe('the tracked keyword field order drop', () => {
  const backfill = statementOf(
    migrationSql('add_keyword_fields'),
    /INSERT INTO "KeywordField"[\s\S]*?;/,
  );
  const guard = migrationSql('guard_tracked_keyword_field_order');
  const drop = migrationSql('drop_tracked_keyword_field_order');
  let prisma: PrismaClient;

  const seedApp = async (store: Store = Store.APP_STORE) =>
    (
      await prisma.app.create({
        data: {
          workspaceId: DEFAULT_WORKSPACE_ID,
          store,
          storeAppId: `drop-${store}`,
          country: 'us',
        },
      })
    ).id;

  const seedFieldPhrase = async (
    appId: string,
    text: string,
    { store = Store.APP_STORE, country = 'us', order = 0 } = {},
  ) => {
    const keyword = await prisma.keyword.create({
      data: { text, store, country },
    });
    await prisma.trackedKeyword.create({
      data: { appId, keywordId: keyword.id, source: 'KEYWORD_FIELD' },
    });
    await prisma.$executeRaw`UPDATE "TrackedKeyword" SET "fieldOrder" = ${order} WHERE "appId" = ${appId} AND "keywordId" = ${keyword.id}`;
  };

  const hasFieldOrder = async () =>
    (
      await prisma.$queryRaw<{ found: boolean }[]>`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'TrackedKeyword' AND column_name = 'fieldOrder'
        ) AS found`
    )[0].found;

  const expectDropRefused = async () => {
    await expect(prisma.$executeRawUnsafe(guard)).rejects.toThrow(
      `set fieldOrder to NULL on those rows, then run prisma migrate resolve --rolled-back ${migrationFolder('guard_tracked_keyword_field_order')}`,
    );
    await expect(hasFieldOrder()).resolves.toBe(true);
  };

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
    await restoreHistoricalFieldOrder(prisma);
  });

  afterAll(async () => {
    await dropHistoricalFieldOrder(prisma);
    await prisma.$disconnect();
  });

  it('drops the column once the backfill carried every field phrase', async () => {
    const appId = await seedApp();
    await seedFieldPhrase(appId, 'habit tracker');
    await seedFieldPhrase(appId, 'sleep', { order: 1 });
    await prisma.$executeRawUnsafe(backfill);

    await prisma.$executeRawUnsafe(guard);
    await prisma.$executeRawUnsafe(drop);

    await expect(hasFieldOrder()).resolves.toBe(false);
  });

  it('passes a database that already dropped the column', async () => {
    await dropHistoricalFieldOrder(prisma);

    await expect(prisma.$executeRawUnsafe(guard)).resolves.toBe(0);
  });

  it('keeps the column when the backfill left out a keyword tracked in another market', async () => {
    await seedFieldPhrase(await seedApp(), 'habit tracker', { country: 'gb' });
    await prisma.$executeRawUnsafe(backfill);

    await expectDropRefused();
  });

  it('keeps the column when the backfill left out a google play app', async () => {
    const store = Store.GOOGLE_PLAY;
    await seedFieldPhrase(await seedApp(store), 'habit tracker', { store });
    await prisma.$executeRawUnsafe(backfill);

    await expectDropRefused();
  });

  it('keeps the column when a phrase left out shares its text with a carried one', async () => {
    const appId = await seedApp();
    await seedFieldPhrase(appId, 'habit tracker');
    await seedFieldPhrase(appId, 'habit tracker', { country: 'gb', order: 1 });
    await prisma.$executeRawUnsafe(backfill);

    await expectDropRefused();
  });
});
