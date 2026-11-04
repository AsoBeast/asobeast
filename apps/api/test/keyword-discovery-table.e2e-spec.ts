import { execSync } from 'child_process';
import { join } from 'path';
import { Prisma, PrismaClient, Store } from '@prisma/client';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import { migrationSql } from './helpers/migration-sql';
import { testDb } from './helpers/test-db';

const CHECKED_ON = new Date('2026-11-02T00:00:00.000Z');

describe('the keyword discovery table (e2e)', () => {
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

  const seedKeyword = (text: string) =>
    prisma.keyword.create({
      data: { text, store: Store.APP_STORE, country: 'us' },
    });

  const seedDiscovery = (
    appId: string,
    keywordId: string,
    observation: Partial<Prisma.KeywordDiscoveryUncheckedCreateInput> = {},
  ) =>
    prisma.keywordDiscovery.create({
      data: {
        appId,
        workspaceId: DEFAULT_WORKSPACE_ID,
        keywordId,
        source: 'title',
        relevance: 90,
        ...observation,
      },
    });

  const seedPair = async () => {
    const app = await seedApp('a');
    const keyword = await seedKeyword('habit tracker');
    return { app, keyword };
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

  beforeEach(() =>
    prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "App", "Keyword" RESTART IDENTITY CASCADE',
    ),
  );

  afterAll(() => prisma.$disconnect());

  it('is created by its migration with the policy and the default flag', () => {
    const sql = migrationSql('add_keyword_discoveries');

    expect(sql).toContain('CREATE TABLE "KeywordDiscovery"');
    expect(sql).toContain(
      'ADD COLUMN     "autoTrackRanked" BOOLEAN NOT NULL DEFAULT false',
    );
    expect(sql).toContain('ENABLE ROW LEVEL SECURITY');
    expect(sql).toContain(
      'CREATE POLICY tenant_isolation ON "KeywordDiscovery"',
    );
  });

  it('stores an unchecked and a checked discovery of an app', async () => {
    const { app, keyword } = await seedPair();
    const other = await seedKeyword('mood journal');

    await seedDiscovery(app.id, keyword.id);
    await seedDiscovery(app.id, other.id, {
      position: 7,
      depth: 50,
      checkedOn: CHECKED_ON,
    });

    await expect(
      prisma.keywordDiscovery.findMany({
        select: { keywordId: true, position: true, depth: true },
      }),
    ).resolves.toEqual(
      expect.arrayContaining([
        { keywordId: keyword.id, position: null, depth: null },
        { keywordId: other.id, position: 7, depth: 50 },
      ]),
    );
  });

  it('removes the discoveries of a deleted app', async () => {
    const { app, keyword } = await seedPair();
    await seedDiscovery(app.id, keyword.id);

    await prisma.app.delete({ where: { id: app.id } });

    await expect(prisma.keywordDiscovery.count()).resolves.toBe(0);
  });

  it('removes the discoveries of a deleted keyword', async () => {
    const { app, keyword } = await seedPair();
    await seedDiscovery(app.id, keyword.id);

    await prisma.keyword.delete({ where: { id: keyword.id } });

    await expect(prisma.keywordDiscovery.count()).resolves.toBe(0);
  });

  it.each([
    ['a position without a depth', { position: 5 }],
    ['a position below one', { position: 0, depth: 50, checkedOn: CHECKED_ON }],
    [
      'a position past its depth',
      { position: 201, depth: 200, checkedOn: CHECKED_ON },
    ],
    ['a depth without a checked day', { depth: 50 }],
    ['a checked day without a depth', { checkedOn: CHECKED_ON }],
  ])('refuses %s', async (_name, observation) => {
    const { app, keyword } = await seedPair();

    await expect(
      seedDiscovery(app.id, keyword.id, observation),
    ).rejects.toThrow('KeywordDiscovery_observation_check');
  });

  it('refuses a second row for the same app and keyword', async () => {
    const { app, keyword } = await seedPair();
    await seedDiscovery(app.id, keyword.id);

    await expect(seedDiscovery(app.id, keyword.id)).rejects.toThrow(
      'Unique constraint',
    );
  });

  it('leaves auto tracking off for an app', async () => {
    const app = await seedApp('b');

    await expect(
      prisma.app.findUnique({
        where: { id: app.id },
        select: { autoTrackRanked: true },
      }),
    ).resolves.toEqual({ autoTrackRanked: false });
  });
});
