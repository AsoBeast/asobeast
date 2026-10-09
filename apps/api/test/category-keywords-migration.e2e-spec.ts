import { execSync } from 'child_process';
import { join } from 'path';
import { KeywordSource, PrismaClient, Store } from '@prisma/client';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import { migrationSql } from './helpers/migration-sql';
import { testDb } from './helpers/test-db';

const HINDI_DICTIONARY = { genres: ['Education', 'Reference'] };
const BENGALI = { genres: ['শিক্ষা', 'রেফারেন্স'] };
const HEALTH = { genres: ['Health & Fitness', 'Lifestyle'] };

describe('the untrack category keywords migration', () => {
  const sql = migrationSql('untrack_category_keywords');
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

  const seedApp = (store: Store = Store.APP_STORE, storeAppId = '1') =>
    prisma.app.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store,
        storeAppId: `${store}-${storeAppId}`,
        country: 'in',
        name: 'Hindi Dictionary',
      },
    });

  const snapshotOf = (
    appId: string,
    raw: object,
    listing: {
      title?: string;
      subtitle?: string | null;
      localization?: string;
    } = {},
  ) =>
    prisma.appSnapshot.create({
      data: {
        appId,
        title: 'Hindi Dictionary',
        subtitle: null,
        description: 'Text',
        raw,
        ...listing,
      },
    });

  const track = async (
    appId: string,
    text: string,
    options: {
      source?: KeywordSource;
      tags?: string[];
      note?: string;
    } = {},
  ) => {
    const keyword = await prisma.keyword.upsert({
      where: {
        text_store_country: { text, store: Store.APP_STORE, country: 'in' },
      },
      update: {},
      create: { text, store: Store.APP_STORE, country: 'in' },
    });
    await prisma.trackedKeyword.create({
      data: { appId, keywordId: keyword.id, source: 'SUBTITLE', ...options },
    });
  };

  const trackedTexts = async (appId: string) =>
    (
      await prisma.trackedKeyword.findMany({
        where: { appId },
        select: { keyword: { select: { text: true } } },
      })
    )
      .map((row) => row.keyword.text)
      .sort();

  const runMigration = async () => {
    await prisma.$executeRawUnsafe(sql);
  };

  it('untracks the auto tracked category of every localization, whole or word by word', async () => {
    const app = await seedApp();
    await snapshotOf(app.id, HINDI_DICTIONARY);
    await snapshotOf(app.id, BENGALI, { localization: 'bn' });
    await snapshotOf(app.id, HEALTH);
    for (const text of [
      'education',
      'reference',
      'শিক্ষা',
      'health',
      'fitness',
    ]) {
      await track(app.id, text);
    }
    await track(app.id, 'offline');

    await runMigration();

    await expect(trackedTexts(app.id)).resolves.toEqual(['offline']);
  });

  it('keeps a keyword the developer also wrote in the title or the subtitle', async () => {
    const app = await seedApp();
    await snapshotOf(app.id, HINDI_DICTIONARY, {
      title: 'Reference Library',
      subtitle: 'Education for every desk',
    });
    await track(app.id, 'reference');
    await track(app.id, 'education');

    await runMigration();

    await expect(trackedTexts(app.id)).resolves.toEqual([
      'education',
      'reference',
    ]);
  });

  it('keeps a keyword with tags or a note and a keyword of another source', async () => {
    const app = await seedApp();
    await snapshotOf(app.id, { genres: ['Education', 'Reference', 'Books'] });
    await track(app.id, 'education', { tags: ['core'] });
    await track(app.id, 'reference', { note: 'watch' });
    await track(app.id, 'books', { source: 'TITLE' });
    await track(app.id, 'dictionary', { source: 'MANUAL' });

    await runMigration();

    await expect(trackedTexts(app.id)).resolves.toEqual([
      'books',
      'dictionary',
      'education',
      'reference',
    ]);
  });

  it('untracks only the app whose own listing names the category', async () => {
    const hindi = await seedApp();
    const other = await seedApp(Store.APP_STORE, '2');
    await snapshotOf(hindi.id, HINDI_DICTIONARY);
    await snapshotOf(other.id, HEALTH);
    await track(hindi.id, 'education');
    await track(other.id, 'education');

    await runMigration();

    await expect(trackedTexts(hindi.id)).resolves.toEqual([]);
    await expect(trackedTexts(other.id)).resolves.toEqual(['education']);
  });

  it('leaves a google play app alone', async () => {
    const play = await seedApp(Store.GOOGLE_PLAY);
    await snapshotOf(play.id, HINDI_DICTIONARY);
    await track(play.id, 'education');

    await runMigration();

    await expect(trackedTexts(play.id)).resolves.toEqual(['education']);
  });

  it('keeps the rankings and the keyword itself', async () => {
    const app = await seedApp();
    await snapshotOf(app.id, HINDI_DICTIONARY);
    await track(app.id, 'education');
    const keyword = await prisma.keyword.findFirstOrThrow();
    await prisma.keywordRanking.create({
      data: {
        appId: app.id,
        workspaceId: DEFAULT_WORKSPACE_ID,
        keywordId: keyword.id,
        date: new Date('2026-10-01'),
        position: 12,
      },
    });

    await runMigration();

    await expect(prisma.keyword.count()).resolves.toBe(1);
    await expect(prisma.keywordRanking.count()).resolves.toBe(1);
  });
});
