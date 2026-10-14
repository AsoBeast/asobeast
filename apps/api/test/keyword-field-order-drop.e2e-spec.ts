import { execSync } from 'child_process';
import { createHash } from 'crypto';
import { join } from 'path';
import { KeywordSource, PrismaClient, Store } from '@prisma/client';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import {
  dropHistoricalFieldOrder,
  restoreHistoricalFieldOrder,
} from './helpers/historical-field-order';
import { migrationFolder, migrationSql } from './helpers/migration-sql';
import { testDb } from './helpers/test-db';

const FIRST_APPLIED_CHECKSUM =
  'e9438d50fe5eb969f8b5bfd92a3c8bb1b37ce9140be5e7e419ea80b57b038b55';

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

  const seedTracked = async (
    appId: string,
    text: string,
    {
      store = Store.APP_STORE,
      country = 'us',
      source = KeywordSource.MANUAL,
    } = {},
  ) => {
    const keyword = await prisma.keyword.create({
      data: { text, store, country },
    });
    await prisma.trackedKeyword.create({
      data: { appId, keywordId: keyword.id, source },
    });
    return keyword.id;
  };

  const seedFieldPhrase = async (
    appId: string,
    text: string,
    { store = Store.APP_STORE, country = 'us', order = 0 } = {},
  ) => {
    const keywordId = await seedTracked(appId, text, {
      store,
      country,
      source: KeywordSource.KEYWORD_FIELD,
    });
    await prisma.$executeRaw`UPDATE "TrackedKeyword" SET "fieldOrder" = ${order} WHERE "appId" = ${appId} AND "keywordId" = ${keywordId}`;
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

  it('keeps the drop byte for byte as the databases that applied it recorded it', () => {
    expect(createHash('sha256').update(drop).digest('hex')).toBe(
      FIRST_APPLIED_CHECKSUM,
    );
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

  it('drops the column past keywords that were never in the keyword field', async () => {
    const appId = await seedApp();
    await seedFieldPhrase(appId, 'habit tracker');
    await seedTracked(appId, 'sleep');
    await seedTracked(appId, 'sleep', { country: 'gb' });
    await seedTracked(await seedApp(Store.GOOGLE_PLAY), 'sleep', {
      store: Store.GOOGLE_PLAY,
    });
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
