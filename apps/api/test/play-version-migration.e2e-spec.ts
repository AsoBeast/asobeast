import { execSync } from 'child_process';
import { join } from 'path';
import { PrismaClient, Store } from '@prisma/client';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import { migrationSql } from './helpers/migration-sql';
import { testDb } from './helpers/test-db';

describe('the clear play varies version migration', () => {
  const sql = migrationSql('clear_play_varies_version');
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

  const snapshotOf = (appId: string, version: string) =>
    prisma.appSnapshot.create({
      data: { appId, title: 'App', description: 'Text', version, raw: {} },
      select: { id: true },
    });

  const runMigration = async () => {
    for (const statement of sql.split(';')) {
      if (statement.trim()) await prisma.$executeRawUnsafe(statement);
    }
  };

  it('clears the marker from google play snapshots and keeps real versions', async () => {
    const play = await seedApp(Store.GOOGLE_PLAY);
    const apple = await seedApp(Store.APP_STORE);
    const varies = await snapshotOf(play.id, 'VARY');
    const real = await snapshotOf(play.id, '5.1.0');
    const lookalike = await snapshotOf(play.id, 'VARYING');
    const other = await snapshotOf(apple.id, 'VARY');

    await runMigration();

    const versions = await prisma.appSnapshot.findMany({
      where: { id: { in: [varies.id, real.id, lookalike.id, other.id] } },
      select: { id: true, version: true },
    });
    expect(
      Object.fromEntries(versions.map((row) => [row.id, row.version])),
    ).toEqual({
      [varies.id]: null,
      [real.id]: '5.1.0',
      [lookalike.id]: 'VARYING',
      [other.id]: 'VARY',
    });
  });

  it('clears the marker from stored version changes only', async () => {
    const play = await seedApp(Store.GOOGLE_PLAY);
    await prisma.changeEvent.createMany({
      data: [
        { appId: play.id, field: 'version', before: '5.0.0', after: 'VARY' },
        { appId: play.id, field: 'version', before: 'VARY', after: '5.1.0' },
        { appId: play.id, field: 'title', before: 'VARY', after: 'Other' },
      ],
    });

    await runMigration();

    const events = await prisma.changeEvent.findMany({
      where: { appId: play.id },
      select: { field: true, before: true, after: true },
      orderBy: [{ field: 'asc' }, { before: 'asc' }],
    });
    expect(events).toEqual([
      { field: 'title', before: 'VARY', after: 'Other' },
      { field: 'version', before: '5.0.0', after: null },
      { field: 'version', before: null, after: '5.1.0' },
    ]);
  });
});
