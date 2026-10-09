import { execSync } from 'child_process';
import { join } from 'path';
import { PrismaClient, Store } from '@prisma/client';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import { migrationSql } from './helpers/migration-sql';
import { testDb } from './helpers/test-db';

const shot = (n: number) =>
  `https://is1-ssl.mzstatic.com/image/thumb/a/b/${n}/shot.jpg/392x696bb.jpg`;

const DEFAULT_RAW = {
  screenshots: [shot(1), shot(2)],
  releaseNotes: 'Bug fixes',
  genres: ['Education', 'Reference'],
};
const BENGALI_RAW = { ...DEFAULT_RAW, genres: ['শিক্ষা', 'রেফারেন্স'] };

interface Listing {
  localization?: string;
  country?: string;
  title?: string;
  subtitle?: string | null;
  description?: string;
  raw?: object;
}

describe('the delete echoed localizations migration', () => {
  const sql = migrationSql('delete_echoed_localizations');
  const repair = [
    'clear_every_genre_subtitle',
    'untrack_category_keywords',
    'delete_echoed_localizations',
  ].map(migrationSql);
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
        country: 'in',
        name: 'Hindi Dictionary',
      },
    });

  const snapshotOf = (appId: string, listing: Listing = {}) =>
    prisma.appSnapshot.create({
      data: {
        appId,
        title: 'Hindi Dictionary',
        subtitle: 'Hindi-English, smart offline',
        description: 'Offline dictionary',
        raw: DEFAULT_RAW,
        ...listing,
      },
      select: { id: true },
    });

  const echoOf = (localization: string, listing: Listing = {}) => ({
    localization,
    subtitle: null,
    raw: BENGALI_RAW,
    ...listing,
  });

  const localizationsOf = async (appId: string) =>
    (
      await prisma.appSnapshot.findMany({
        where: { appId, localization: { not: null } },
        select: { localization: true },
        distinct: ['localization'],
        orderBy: { localization: 'asc' },
      })
    ).map((row) => row.localization);

  const runMigration = async () => {
    await prisma.$executeRawUnsafe(sql);
  };

  it('deletes a localization that only ever showed its category in place of a subtitle', async () => {
    const app = await seedApp();
    await snapshotOf(app.id);
    const phantom = await snapshotOf(app.id, echoOf('bn'));
    await snapshotOf(
      app.id,
      echoOf('ta', {
        subtitle: 'கல்வி',
        raw: { ...DEFAULT_RAW, genres: ['கல்வி', 'குறிப்பு'] },
      }),
    );
    await prisma.changeEvent.create({
      data: {
        appId: app.id,
        localization: 'bn',
        field: 'title',
        before: 'a',
        after: 'b',
      },
    });
    await prisma.snapshotScreenshot.create({
      data: {
        snapshotId: phantom.id,
        workspaceId: DEFAULT_WORKSPACE_ID,
        position: 0,
        url: shot(1),
        assetKey: 'a',
      },
    });

    await runMigration();

    await expect(localizationsOf(app.id)).resolves.toEqual([]);
    await expect(prisma.changeEvent.count()).resolves.toBe(0);
    await expect(prisma.snapshotScreenshot.count()).resolves.toBe(0);
    await expect(
      prisma.appSnapshot.count({ where: { localization: null } }),
    ).resolves.toBe(1);
  });

  it('keeps a localization with its own subtitle, title, description, screenshots or release notes', async () => {
    const app = await seedApp();
    await snapshotOf(app.id);
    await snapshotOf(app.id, echoOf('hi', { subtitle: 'ऑफ़लाइन शब्दकोश' }));
    await snapshotOf(app.id, echoOf('ta', { title: 'அகராதி' }));
    await snapshotOf(app.id, echoOf('te', { description: 'నిఘంటువు' }));
    await snapshotOf(
      app.id,
      echoOf('ur', { raw: { ...BENGALI_RAW, screenshots: [shot(3)] } }),
    );
    await snapshotOf(
      app.id,
      echoOf('pa', { raw: { ...BENGALI_RAW, releaseNotes: 'Naye' } }),
    );

    await runMigration();

    await expect(localizationsOf(app.id)).resolves.toEqual([
      'hi',
      'pa',
      'ta',
      'te',
      'ur',
    ]);
  });

  it('keeps a localization that was served once and echoes the default now', async () => {
    const app = await seedApp();
    await snapshotOf(app.id);
    await snapshotOf(app.id, echoOf('ta', { title: 'அகராதி' }));
    await snapshotOf(app.id, echoOf('ta'));
    await prisma.changeEvent.create({
      data: {
        appId: app.id,
        localization: 'ta',
        field: 'title',
        before: 'அகராதி',
        after: 'Hindi Dictionary',
      },
    });

    await runMigration();

    await expect(localizationsOf(app.id)).resolves.toEqual(['ta']);
    await expect(
      prisma.appSnapshot.count({ where: { localization: 'ta' } }),
    ).resolves.toBe(2);
    await expect(prisma.changeEvent.count()).resolves.toBe(1);
  });

  it('deletes every snapshot of an echoed localization and nothing of the others', async () => {
    const app = await seedApp();
    await snapshotOf(app.id);
    await snapshotOf(app.id, echoOf('bn'));
    await snapshotOf(app.id, echoOf('bn'));
    await snapshotOf(app.id, echoOf('hi', { subtitle: 'ऑफ़लाइन शब्दकोश' }));

    await runMigration();

    await expect(localizationsOf(app.id)).resolves.toEqual(['hi']);
  });

  it('compares a market localization with the default listing of the same market', async () => {
    const app = await seedApp();
    await snapshotOf(app.id, { country: 'se', title: 'Svenska' });
    await snapshotOf(app.id, echoOf('bn', { country: 'se' }));
    await snapshotOf(app.id, echoOf('ta', { country: 'se', title: 'Svenska' }));

    await runMigration();

    await expect(localizationsOf(app.id)).resolves.toEqual(['bn']);
  });

  it('untracks the category keywords of an echoed localization before it deletes the localization', async () => {
    const app = await seedApp();
    await snapshotOf(app.id);
    await snapshotOf(app.id, echoOf('bn', { subtitle: 'শিক্ষা' }));
    for (const text of ['শিক্ষা', 'offline']) {
      const keyword = await prisma.keyword.create({
        data: { text, store: Store.APP_STORE, country: 'in' },
      });
      await prisma.trackedKeyword.create({
        data: { appId: app.id, keywordId: keyword.id, source: 'SUBTITLE' },
      });
    }

    for (const statement of repair) {
      for (const part of statement.split(';')) {
        if (part.trim()) await prisma.$executeRawUnsafe(part);
      }
    }

    await expect(localizationsOf(app.id)).resolves.toEqual([]);
    await expect(
      prisma.trackedKeyword.findMany({
        select: { keyword: { select: { text: true } } },
      }),
    ).resolves.toEqual([{ keyword: { text: 'offline' } }]);
  });

  it('leaves a google play app alone', async () => {
    const play = await seedApp(Store.GOOGLE_PLAY);
    await snapshotOf(play.id);
    await snapshotOf(play.id, echoOf('bn'));

    await runMigration();

    await expect(localizationsOf(play.id)).resolves.toEqual(['bn']);
  });
});
