import { execSync } from 'child_process';
import { join } from 'path';
import { PrismaClient, Store } from '@prisma/client';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import { migrationSql } from './helpers/migration-sql';
import { testDb } from './helpers/test-db';

const FINANCE = { genres: ['Finance', 'Utilities'] };
const FINANS = { genres: ['Finans', 'Verktøy'] };

describe('the clear category subtitles migration', () => {
  const sql = migrationSql('clear_category_subtitles');
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

  const seedApp = (store: Store = Store.APP_STORE) =>
    prisma.app.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store,
        storeAppId: `${store}-1`,
        country: 'no',
        name: 'Vipps',
      },
    });

  const snapshotOf = (
    appId: string,
    subtitle: string,
    raw: object,
    listing: { country?: string; localization?: string } = {},
  ) =>
    prisma.appSnapshot.create({
      data: {
        appId,
        title: 'Vipps',
        subtitle,
        description: 'Text',
        raw,
        ...listing,
      },
      select: { id: true },
    });

  const subtitles = async (ids: string[]) => {
    const rows = await prisma.appSnapshot.findMany({
      where: { id: { in: ids } },
      select: { id: true, subtitle: true },
    });
    return Object.fromEntries(rows.map((row) => [row.id, row.subtitle]));
  };

  const runMigration = async () => {
    for (const statement of sql.split(';')) {
      if (statement.trim()) await prisma.$executeRawUnsafe(statement);
    }
  };

  it('clears a stored subtitle that is the primary category of its own snapshot', async () => {
    const app = await seedApp();
    const home = await snapshotOf(app.id, 'Finance', FINANCE);
    const localized = await snapshotOf(app.id, 'Finans', FINANS, {
      localization: 'no',
    });
    const real = await snapshotOf(app.id, 'Pay friends in seconds', FINANCE);
    const secondary = await snapshotOf(app.id, 'Utilities', FINANCE);
    const foreign = await snapshotOf(app.id, 'Finans', FINANCE);

    await runMigration();

    await expect(
      subtitles([home.id, localized.id, real.id, secondary.id, foreign.id]),
    ).resolves.toEqual({
      [home.id]: null,
      [localized.id]: null,
      [real.id]: 'Pay friends in seconds',
      [secondary.id]: 'Utilities',
      [foreign.id]: 'Finans',
    });
  });

  it('leaves a google play snapshot and its subtitle changes alone', async () => {
    const play = await seedApp(Store.GOOGLE_PLAY);
    const snapshot = await snapshotOf(play.id, 'Finance', FINANCE);
    await prisma.changeEvent.createMany({
      data: [
        { appId: play.id, field: 'subtitle', before: 'Finance', after: 'Pay' },
        { appId: play.id, field: 'subtitle', before: null, after: null },
      ],
    });

    await runMigration();

    await expect(subtitles([snapshot.id])).resolves.toEqual({
      [snapshot.id]: 'Finance',
    });
    await expect(
      prisma.changeEvent.count({ where: { appId: play.id } }),
    ).resolves.toBe(2);
  });

  it('reads a recorded subtitle change through the category of the same listing', async () => {
    const app = await seedApp();
    await snapshotOf(app.id, 'Finance', FINANCE);
    await snapshotOf(app.id, 'Finans', FINANS, { country: 'se' });
    await prisma.changeEvent.createMany({
      data: [
        { appId: app.id, field: 'subtitle', before: 'Finance', after: 'Pay' },
        { appId: app.id, field: 'subtitle', before: 'Pay', after: 'Finance' },
        { appId: app.id, field: 'subtitle', before: 'Finance', after: null },
        { appId: app.id, field: 'subtitle', before: 'Pay', after: 'Send' },
        { appId: app.id, field: 'title', before: 'Finance', after: 'Vipps' },
        { appId: app.id, field: 'subtitle', before: 'Finans', after: 'Betal' },
        {
          appId: app.id,
          country: 'se',
          field: 'subtitle',
          before: 'Finans',
          after: 'Betal',
        },
      ],
    });

    await runMigration();

    const events = await prisma.changeEvent.findMany({
      select: { country: true, field: true, before: true, after: true },
      orderBy: [
        { country: 'asc' },
        { field: 'asc' },
        { before: 'asc' },
        { after: 'asc' },
      ],
    });
    expect(events).toEqual([
      { country: 'se', field: 'subtitle', before: null, after: 'Betal' },
      { country: null, field: 'subtitle', before: 'Finans', after: 'Betal' },
      { country: null, field: 'subtitle', before: 'Pay', after: 'Send' },
      { country: null, field: 'subtitle', before: 'Pay', after: null },
      { country: null, field: 'subtitle', before: null, after: 'Pay' },
      { country: null, field: 'title', before: 'Finance', after: 'Vipps' },
    ]);
  });
});
