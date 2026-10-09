import { execSync } from 'child_process';
import { join } from 'path';
import { PrismaClient, Store } from '@prisma/client';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import { migrationSql } from './helpers/migration-sql';
import { testDb } from './helpers/test-db';

const GAME = { genres: ['Games', 'Action', 'Casual'] };
const OYUNLAR = { genres: ['Oyunlar', 'Aksiyon', 'Gündelik'] };

describe('the clear every genre subtitle migration', () => {
  const sql = migrationSql('clear_every_genre_subtitle');
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
        country: 'us',
        name: 'Super Hexagon',
      },
    });

  const snapshotOf = (
    appId: string,
    subtitle: string,
    raw: object,
    listing: {
      country?: string;
      localization?: string;
      capturedAt?: Date;
    } = {},
  ) =>
    prisma.appSnapshot.create({
      data: {
        appId,
        title: 'Super Hexagon',
        subtitle,
        description: 'Text',
        raw,
        ...listing,
      },
      select: { id: true },
    });

  const at = (minute: number) => new Date(Date.UTC(2026, 9, 1, 0, minute));

  const recordedEvents = () =>
    prisma.changeEvent.findMany({
      select: { country: true, field: true, before: true, after: true },
      orderBy: [
        { country: 'asc' },
        { field: 'asc' },
        { before: 'asc' },
        { after: 'asc' },
      ],
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

  it('clears a stored subtitle that is any genre of its own snapshot', async () => {
    const app = await seedApp();
    const primary = await snapshotOf(app.id, 'Games', GAME);
    const subgenre = await snapshotOf(app.id, 'Action', GAME);
    const last = await snapshotOf(app.id, 'Casual', GAME);
    const localized = await snapshotOf(app.id, 'Aksiyon', OYUNLAR, {
      localization: 'tr',
    });
    const real = await snapshotOf(app.id, 'Survive the hexagons', GAME);
    const otherCase = await snapshotOf(app.id, 'action', GAME);
    const foreign = await snapshotOf(app.id, 'Aksiyon', GAME);

    await runMigration();

    await expect(
      subtitles([
        primary.id,
        subgenre.id,
        last.id,
        localized.id,
        real.id,
        otherCase.id,
        foreign.id,
      ]),
    ).resolves.toEqual({
      [primary.id]: null,
      [subgenre.id]: null,
      [last.id]: null,
      [localized.id]: null,
      [real.id]: 'Survive the hexagons',
      [otherCase.id]: 'action',
      [foreign.id]: 'Aksiyon',
    });
  });

  it('leaves a google play snapshot and its subtitle changes alone', async () => {
    const play = await seedApp(Store.GOOGLE_PLAY);
    const snapshot = await snapshotOf(play.id, 'Action', GAME);
    await prisma.changeEvent.createMany({
      data: [
        { appId: play.id, field: 'subtitle', before: 'Action', after: 'Pay' },
        { appId: play.id, field: 'subtitle', before: null, after: null },
      ],
    });

    await runMigration();

    await expect(subtitles([snapshot.id])).resolves.toEqual({
      [snapshot.id]: 'Action',
    });
    await expect(
      prisma.changeEvent.count({ where: { appId: play.id } }),
    ).resolves.toBe(2);
  });

  it('clears a recorded subtitle side that is a genre of the snapshot it came from', async () => {
    const app = await seedApp();
    const history: [number, string][] = [
      [0, 'Action'],
      [1, 'Hex'],
      [2, 'Casual'],
      [3, 'Action'],
      [4, 'Aksiyon'],
    ];
    for (const [minute, subtitle] of history) {
      await snapshotOf(app.id, subtitle, GAME, { capturedAt: at(minute) });
    }
    await snapshotOf(app.id, 'Aksiyon', OYUNLAR, {
      country: 'tr',
      capturedAt: at(0),
    });
    await snapshotOf(app.id, 'Hex', OYUNLAR, {
      country: 'tr',
      capturedAt: at(1),
    });
    await prisma.changeEvent.createMany({
      data: [
        { before: 'Action', after: 'Hex', capturedAt: at(1) },
        { before: 'Hex', after: 'Casual', capturedAt: at(2) },
        { before: 'Casual', after: 'Action', capturedAt: at(3) },
        { before: 'Action', after: 'Aksiyon', capturedAt: at(4) },
        { field: 'title', before: 'Action', after: 'Hex', capturedAt: at(1) },
        { country: 'tr', before: 'Aksiyon', after: 'Hex', capturedAt: at(1) },
      ].map((event) => ({ appId: app.id, field: 'subtitle', ...event })),
    });

    await runMigration();

    await expect(recordedEvents()).resolves.toEqual([
      { country: 'tr', field: 'subtitle', before: null, after: 'Hex' },
      { country: null, field: 'subtitle', before: 'Hex', after: null },
      { country: null, field: 'subtitle', before: null, after: 'Aksiyon' },
      { country: null, field: 'subtitle', before: null, after: 'Hex' },
      { country: null, field: 'title', before: 'Action', after: 'Hex' },
    ]);
  });

  it('keeps a recorded subtitle that is a genre only of another snapshot of the listing', async () => {
    const app = await seedApp();
    await snapshotOf(
      app.id,
      'Puzzle',
      { genres: ['Games', 'Strategy'] },
      { capturedAt: at(0) },
    );
    await snapshotOf(
      app.id,
      'Strategy',
      { genres: ['Games', 'Puzzle'] },
      { capturedAt: at(1) },
    );
    await prisma.changeEvent.create({
      data: {
        appId: app.id,
        field: 'subtitle',
        before: 'Puzzle',
        after: 'Strategy',
        capturedAt: at(1),
      },
    });

    await runMigration();

    await expect(recordedEvents()).resolves.toEqual([
      { country: null, field: 'subtitle', before: 'Puzzle', after: 'Strategy' },
    ]);
  });

  it('keeps a recorded subtitle whose source snapshot is no longer stored', async () => {
    const app = await seedApp();
    await snapshotOf(app.id, 'Hex', GAME, { capturedAt: at(1) });
    await prisma.changeEvent.create({
      data: {
        appId: app.id,
        field: 'subtitle',
        before: 'Action',
        after: 'Hex',
        capturedAt: at(1),
      },
    });

    await runMigration();

    await expect(recordedEvents()).resolves.toEqual([
      { country: null, field: 'subtitle', before: 'Action', after: 'Hex' },
    ]);
  });
});
