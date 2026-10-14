import { execSync } from 'child_process';
import { join } from 'path';
import { PrismaClient, Store } from '@prisma/client';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import {
  dropHistoricalFieldOrder,
  restoreHistoricalFieldOrder,
} from './helpers/historical-field-order';
import { migrationSql } from './helpers/migration-sql';
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
  const drop = migrationSql('drop_tracked_keyword_field_order');
  let prisma: PrismaClient;

  const fieldPhrase = async (
    text: string,
    { store = Store.APP_STORE, country = 'us' } = {},
  ) => {
    const app = await prisma.app.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store,
        storeAppId: `drop-${store}-${country}`,
        country: 'us',
      },
    });
    const keyword = await prisma.keyword.create({
      data: { text, store, country },
    });
    await prisma.trackedKeyword.create({
      data: { appId: app.id, keywordId: keyword.id, source: 'KEYWORD_FIELD' },
    });
    await prisma.$executeRaw`UPDATE "TrackedKeyword" SET "fieldOrder" = 0 WHERE "appId" = ${app.id}`;
  };

  const hasFieldOrder = async () =>
    (
      await prisma.$queryRaw<{ found: boolean }[]>`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'TrackedKeyword' AND column_name = 'fieldOrder'
        ) AS found`
    )[0].found;

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
    await fieldPhrase('habit tracker');
    await prisma.$executeRawUnsafe(backfill);

    await prisma.$executeRawUnsafe(drop);

    await expect(hasFieldOrder()).resolves.toBe(false);
  });

  it.each([
    ['a keyword tracked in another market', { country: 'gb' }],
    ['a google play app', { store: Store.GOOGLE_PLAY }],
  ])('keeps the column when the backfill left out %s', async (_, origin) => {
    await fieldPhrase('habit tracker', origin);
    await prisma.$executeRawUnsafe(backfill);

    await expect(prisma.$executeRawUnsafe(drop)).rejects.toThrow(
      /no KeywordField row carries/,
    );
    await expect(hasFieldOrder()).resolves.toBe(true);
  });
});
