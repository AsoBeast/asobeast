import { execSync } from 'child_process';
import { join } from 'path';
import { Prisma, PrismaClient, Store } from '@prisma/client';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import {
  omitStar,
  starCountsOf,
} from '../src/store-providers/star-counts.fixture';
import { migrationSql } from './helpers/migration-sql';
import { testDb } from './helpers/test-db';

describe('the snapshot star counts migration', () => {
  const sql = migrationSql('add_snapshot_rating_histogram');
  const backfill = sql.slice(sql.indexOf('UPDATE'));
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

  const seedApp = (store: Store) =>
    prisma.app.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store,
        storeAppId: `${store}-1`,
        country: 'us',
        name: store,
      },
    });

  const snapshotOf = (
    appId: string,
    raw: Prisma.InputJsonValue,
    listing: { country?: string; localization?: string } = {},
  ) =>
    prisma.appSnapshot.create({
      data: { appId, title: 'App', description: 'Text', raw, ...listing },
      select: { id: true },
    });

  const runBackfill = async () => {
    for (const statement of backfill.split(';')) {
      if (statement.trim()) await prisma.$executeRawUnsafe(statement);
    }
  };

  const stored = async (id: string) => {
    const rows = await prisma.$queryRaw<
      { missing: boolean; counts: unknown }[]
    >`SELECT "ratingHistogram" IS NULL AS missing, "ratingHistogram" AS counts FROM "AppSnapshot" WHERE id = ${id}`;
    return rows[0];
  };

  const backfilled = async (
    raw: Prisma.InputJsonValue,
    store: Store = Store.GOOGLE_PLAY,
    listing: { country?: string; localization?: string } = {},
  ) => {
    const app = await seedApp(store);
    const { id } = await snapshotOf(app.id, raw, listing);
    await runBackfill();
    return stored(id);
  };

  it('fills a google play home row with a valid histogram', async () => {
    const row = await backfilled({ histogram: starCountsOf(1000) });

    expect(row.missing).toBe(false);
    expect(row.counts).toEqual(starCountsOf(1000));
  });

  it('fills a bucket stored as digits', async () => {
    const row = await backfilled({
      histogram: { ...starCountsOf(100), '2': '20' },
    });

    expect(row.counts).toMatchObject({ '2': 20 });
  });

  it.each([
    ['a missing bucket', { histogram: omitStar(starCountsOf(100), '5') }],
    ['a text bucket', { histogram: { ...starCountsOf(100), '3': 'many' } }],
    ['a fraction', { histogram: { ...starCountsOf(100), '3': 3.7 } }],
    ['a negative number', { histogram: { ...starCountsOf(100), '3': -1 } }],
    [
      'an oversized number',
      { histogram: { ...starCountsOf(100), '3': '12345678901234567890' } },
    ],
    ['an array', { histogram: [1, 2, 3, 4, 5] }],
    ['a payload without a histogram', {}],
  ])('leaves %s at NULL', async (_, raw) => {
    expect((await backfilled(raw)).missing).toBe(true);
  });

  it('leaves an app store row at NULL', async () => {
    const row = await backfilled(
      { histogram: starCountsOf(1000) },
      Store.APP_STORE,
    );

    expect(row.missing).toBe(true);
  });

  it.each([
    ['a market row', { country: 'de' }],
    ['a localized row', { localization: 'de-DE' }],
  ])('leaves %s at NULL', async (_, listing) => {
    const row = await backfilled(
      { histogram: starCountsOf(1000) },
      Store.GOOGLE_PLAY,
      listing,
    );

    expect(row.missing).toBe(true);
  });

  it('fills only the home rows of an app that has several snapshots', async () => {
    const app = await seedApp(Store.GOOGLE_PLAY);
    const raw = { histogram: starCountsOf(1000) };
    const home = await snapshotOf(app.id, raw);
    const market = await snapshotOf(app.id, raw, { country: 'de' });

    await runBackfill();

    expect((await stored(home.id)).missing).toBe(false);
    expect((await stored(market.id)).missing).toBe(true);
  });
});
