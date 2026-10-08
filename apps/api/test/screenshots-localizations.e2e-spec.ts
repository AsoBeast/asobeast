import './helpers/enable-screenshot-ocr';
import { execSync } from 'child_process';
import { join } from 'path';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { AppDetail } from '@asobeast/shared';
import sharp from 'sharp';
import { App } from 'supertest/types';
import { AlertsDispatcher } from '../src/alerts/alerts.dispatcher';
import { AppModule } from '../src/app.module';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import { OCR_ENGINE } from '../src/screenshots/ocr-engine';
import { ScreenshotImageSource } from '../src/store-providers/screenshot-image.source';
import { StoreProviderRegistry } from '../src/store-providers/store-provider.registry';
import {
  ENGLISH,
  Listing,
  LocalizedRegistry,
  PL_APP_URL,
  POLISH,
} from './helpers/localized-store';
import { lines, readsFinished } from './helpers/screenshot-reading';
import { ownerAgent, useCookies } from './helpers/session';
import { testDb } from './helpers/test-db';
import { obliterateQueues } from './obliterate-queues';

const BASE_HEIGHT = 1000;

const CAPTIONS: Record<number, string> = {
  1: 'Track habits',
  2: 'Plan your week',
  3: 'Śledź nawyki',
  4: 'Planuj tydzień',
  5: 'Odkrywaj świat',
  6: 'Volg je gewoontes',
};

const shotNumber = (url: string): number =>
  Number(/\/b\/(\d+)\/shot\.jpg/.exec(url)?.[1]);

const imageOf = (url: string) =>
  sharp({
    create: {
      width: 1080,
      height: BASE_HEIGHT + shotNumber(url),
      channels: 3,
      background: '#ffffff',
    },
  })
    .png()
    .toBuffer();

const shot = (n: number) =>
  `https://is1-ssl.mzstatic.com/image/thumb/a/b/${n}/shot.jpg/392x696bb.jpg`;

const DUTCH: Listing = {
  title: 'Waar ben ik? Kaartquiz',
  subtitle: 'Wereld aardrijkskunde',
  description: 'Ontdek de wereld',
  screenshots: [shot(6)],
};

describe('Screenshots of localized listings (e2e)', () => {
  jest.setTimeout(30_000);
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let api: Awaited<ReturnType<typeof ownerAgent>>;
  const registry = new LocalizedRegistry();
  const engineRead = jest.fn(async (image: Buffer) => {
    const { height = 0 } = await sharp(image).metadata();
    return lines(CAPTIONS[height - BASE_HEIGHT] ?? 'Unknown');
  });

  beforeAll(async () => {
    execSync('pnpm prisma migrate deploy', {
      cwd: join(__dirname, '..'),
      env: process.env,
      stdio: 'ignore',
    });
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(StoreProviderRegistry)
      .useValue(registry)
      .overrideProvider(ScreenshotImageSource)
      .useValue({ read: imageOf })
      .overrideProvider(OCR_ENGINE)
      .useValue({ name: 'fake-engine', read: engineRead })
      .compile();
    app = moduleFixture.createNestApplication();
    useCookies(app);
    await app.init();

    prisma = testDb();
    await prisma.workspace.upsert({
      where: { id: DEFAULT_WORKSPACE_ID },
      update: {},
      create: { id: DEFAULT_WORKSPACE_ID, name: 'Default' },
    });
    api = await ownerAgent(app);
  });

  beforeEach(async () => {
    registry.reset();
    engineRead.mockClear();
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "App", "Keyword", "AppGroup", "ScreenshotText" RESTART IDENTITY CASCADE',
    );
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await obliterateQueues(app);
    await app.close();
  });

  const everyReadFinished = async (appId: string) => {
    const snapshots = await prisma.appSnapshot.findMany({
      where: { appId },
      select: { id: true },
    });
    for (const { id } of snapshots) await readsFinished(app, prisma, id);
  };

  const importAndRead = async (url: string) => {
    const { id } = (await api.post('/apps').send({ url }).expect(201))
      .body as AppDetail;
    await everyReadFinished(id);
    return id;
  };

  const refreshAndRead = async (appId: string) => {
    await api.post(`/apps/${appId}/refresh`).expect(200);
    await everyReadFinished(appId);
  };

  const captionEvents = (appId: string) =>
    prisma.changeEvent.findMany({
      where: { appId, field: 'screenshotCaptions' },
      select: { country: true, localization: true, before: true, after: true },
    });

  it('reads a localized listing with the language of its localization', async () => {
    registry.listings.set('be:nl', DUTCH);

    const appId = await importAndRead(
      'https://apps.apple.com/be/app/fixture/id6657987209',
    );

    const rows = await prisma.snapshotScreenshot.findMany({
      where: { snapshot: { appId } },
      select: { recipe: true, caption: true, snapshot: true },
    });
    const dutch = rows.filter((row) => row.snapshot.localization === 'nl');
    const english = rows.filter((row) => row.snapshot.localization === null);
    expect(dutch.map((row) => [row.recipe, row.caption])).toEqual([
      ['ocr1:eng', 'Volg je gewoontes'],
    ]);
    expect(new Set(english.map((row) => row.recipe))).toEqual(
      new Set(['ocr1:eng+fra']),
    );
    expect(ENGLISH.screenshots).toHaveLength(english.length);
  });

  it('never compares the captions of a localized listing with the default listing', async () => {
    registry.listings.set('pl:pl', POLISH);
    const appId = await importAndRead(PL_APP_URL);

    await refreshAndRead(appId);
    await refreshAndRead(appId);

    await expect(captionEvents(appId)).resolves.toEqual([]);
  });

  it('records a caption change of a localized listing in that localization without an alert', async () => {
    registry.listings.set('pl:pl', POLISH);
    const appId = await importAndRead(PL_APP_URL);
    await refreshAndRead(appId);
    registry.listings.set('pl:pl', {
      ...POLISH,
      screenshots: [shot(3), shot(5)],
    });
    const dispatch = jest.spyOn(app.get(AlertsDispatcher), 'dispatch');

    await refreshAndRead(appId);

    await expect(captionEvents(appId)).resolves.toEqual([
      {
        country: null,
        localization: 'pl',
        before: 'Śledź nawyki | Planuj tydzień',
        after: 'Śledź nawyki | Odkrywaj świat',
      },
    ]);
    expect(JSON.stringify(dispatch.mock.calls)).not.toContain('Odkrywaj');
    dispatch.mockRestore();
  });
});
