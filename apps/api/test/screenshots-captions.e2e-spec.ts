import './helpers/enable-screenshot-ocr';
import { execSync } from 'child_process';
import { join } from 'path';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { AppDetail, ChangeEventItem, ChangeTimeline } from '@asobeast/shared';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import { CaptionChangeRecorder } from '../src/screenshots/caption-change-recorder';
import { OCR_ENGINE } from '../src/screenshots/ocr-engine';
import { ocrRecipe } from '../src/screenshots/ocr-languages';
import { ScreenshotFetchError } from '../src/store-providers/errors';
import { ScreenshotImageSource } from '../src/store-providers/screenshot-image.source';
import { StoreProviderRegistry } from '../src/store-providers/store-provider.registry';
import { ownerAgent, useCookies } from './helpers/session';
import { asWorkspace } from './helpers/tenancy';
import {
  appleKey,
  appleShot,
  APP_STORE_URL,
  FakeScreenshotRegistry,
} from './helpers/screenshot-store';
import {
  greyPassEngine,
  lines,
  readsFinished,
  solidPng,
} from './helpers/screenshot-reading';
import { testDb } from './helpers/test-db';
import { obliterateQueues } from './obliterate-queues';

describe('Caption changes (e2e)', () => {
  jest.setTimeout(30_000);
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let api: Awaited<ReturnType<typeof ownerAgent>>;
  const registry = new FakeScreenshotRegistry();
  const read = jest.fn();
  const engineRead = jest.fn();

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
      .useValue({ read })
      .overrideProvider(OCR_ENGINE)
      .useValue(greyPassEngine(engineRead))
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
    registry.screenshots = [appleShot(1), appleShot(2)];
    read.mockReset().mockResolvedValue(await solidPng());
    engineRead.mockReset();
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "App", "Keyword", "AppGroup", "ScreenshotText" RESTART IDENTITY CASCADE',
    );
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await obliterateQueues(app);
    await app.close();
  });

  const importAndRead = async (): Promise<string> => {
    const imported = await api
      .post('/apps')
      .send({ url: APP_STORE_URL })
      .expect(201);
    const detail = imported.body as AppDetail;
    await readsFinished(app, prisma, detail.latestSnapshot?.id as string);
    return detail.id;
  };

  const refreshAndRead = async (appId: string) => {
    await api.post(`/apps/${appId}/refresh`).expect(200);
    const latest = await prisma.appSnapshot.findFirstOrThrow({
      where: { appId },
      orderBy: { capturedAt: 'desc' },
    });
    await readsFinished(app, prisma, latest.id);
  };

  const events = async (
    appId: string,
    field: string,
  ): Promise<ChangeEventItem[]> => {
    const { events: all } = (
      await api.get(`/apps/${appId}/changes`).expect(200)
    ).body as ChangeTimeline;
    return all.filter((event) => event.field === field);
  };

  it('records one caption change when a replaced screenshot carries a new caption', async () => {
    engineRead
      .mockResolvedValueOnce(lines('Track habits'))
      .mockResolvedValueOnce(lines('Plan your week'));
    const appId = await importAndRead();
    registry.screenshots = [appleShot(1), appleShot(9)];
    engineRead.mockResolvedValueOnce(lines('Plan your day'));

    await refreshAndRead(appId);

    const captions = await events(appId, 'screenshotCaptions');
    expect(captions).toHaveLength(1);
    expect(captions[0]).toMatchObject({
      before: 'Track habits | Plan your week',
      after: 'Track habits | Plan your day',
      detail: {
        kind: 'captions',
        added: ['Plan your day'],
        removed: ['Plan your week'],
      },
    });
    await expect(events(appId, 'screenshotImages')).resolves.toHaveLength(1);
    expect(engineRead).toHaveBeenCalledTimes(3);
  });

  it('records no caption change against captions read with an earlier recipe and one for a later edit', async () => {
    engineRead.mockResolvedValue(lines('Track habits'));
    const appId = await importAndRead();
    const first = await prisma.appSnapshot.findFirstOrThrow({
      where: { appId },
    });
    await prisma.snapshotScreenshot.updateMany({
      where: { snapshotId: first.id },
      data: { recipe: 'ocr1:eng', caption: 'I' },
    });

    await refreshAndRead(appId);

    await expect(events(appId, 'screenshotCaptions')).resolves.toEqual([]);

    registry.screenshots = [appleShot(1), appleShot(9)];
    engineRead.mockResolvedValue(lines('Plan your day'));

    await refreshAndRead(appId);

    const captions = await events(appId, 'screenshotCaptions');
    expect(captions).toHaveLength(1);
    expect(captions[0]).toMatchObject({
      detail: { added: ['Plan your day'], removed: ['Track habits'] },
    });
  });

  it('records no caption change when the new image reads the same up to punctuation', async () => {
    engineRead
      .mockResolvedValueOnce(lines('Track habits'))
      .mockResolvedValueOnce(lines('Plan your week'));
    const appId = await importAndRead();
    registry.screenshots = [appleShot(1), appleShot(9)];
    engineRead.mockResolvedValueOnce(lines('Plan your week!'));

    await refreshAndRead(appId);

    await expect(events(appId, 'screenshotImages')).resolves.toHaveLength(1);
    await expect(events(appId, 'screenshotCaptions')).resolves.toEqual([]);
  });

  it('records no caption change while the earlier snapshot has a screenshot that failed to read', async () => {
    const png = await solidPng();
    read
      .mockResolvedValueOnce(png)
      .mockRejectedValueOnce(
        new ScreenshotFetchError('the image request answered 404', false),
      );
    engineRead
      .mockResolvedValueOnce(lines('Track habits'))
      .mockResolvedValueOnce(lines('Plan your week'))
      .mockResolvedValueOnce(lines('Plan your week'));
    const appId = await importAndRead();

    await refreshAndRead(appId);

    const latest = await prisma.appSnapshot.findFirstOrThrow({
      where: { appId },
      orderBy: { capturedAt: 'desc' },
      include: { screenshots: { orderBy: { position: 'asc' } } },
    });
    expect(latest.screenshots.map((row) => row.status)).toEqual([
      'read',
      'read',
    ]);
    await expect(events(appId, 'screenshotCaptions')).resolves.toEqual([]);
  });

  it('records the change of a later snapshot when the earlier one settles last', async () => {
    const DAY_MS = 24 * 60 * 60 * 1000;
    engineRead
      .mockResolvedValueOnce(lines('Track habits'))
      .mockResolvedValueOnce(lines('Plan your week'));
    const appId = await importAndRead();
    const first = await prisma.appSnapshot.findFirstOrThrow({
      where: { appId },
    });
    await prisma.appSnapshot.update({
      where: { id: first.id },
      data: { capturedAt: new Date(Date.now() - 3 * DAY_MS) },
    });
    const snapshotWith = async (
      daysAgo: number,
      rows: Array<[string, string | null]>,
    ) => {
      const created = await prisma.appSnapshot.create({
        data: {
          appId,
          title: 'Fixture',
          description: 'd',
          raw: {},
          capturedAt: new Date(Date.now() - daysAgo * DAY_MS),
        },
      });
      await prisma.snapshotScreenshot.createMany({
        data: rows.map(([status, caption], index) => ({
          snapshotId: created.id,
          workspaceId: DEFAULT_WORKSPACE_ID,
          position: index + 1,
          url: appleShot(index + 1),
          assetKey: appleKey(index + 1),
          status,
          caption,
          recipe: status === 'read' ? ocrRecipe(['eng']) : null,
        })),
      });
      return created;
    };
    const delayed = await snapshotWith(2, [
      ['read', 'Track habits'],
      ['pending', null],
    ]);
    const latest = await snapshotWith(1, [
      ['read', 'Track habits'],
      ['read', 'Sleep better'],
    ]);
    const recorder = app.get(CaptionChangeRecorder);
    const home = { home: 'us', market: 'us' };

    await asWorkspace(app, () => recorder.record({ ...latest, listing: home }));
    await prisma.snapshotScreenshot.update({
      where: { snapshotId_position: { snapshotId: delayed.id, position: 2 } },
      data: {
        status: 'read',
        caption: 'Plan your day',
        recipe: ocrRecipe(['eng']),
      },
    });
    await asWorkspace(app, () =>
      recorder.record({ ...delayed, listing: home }),
    );
    await asWorkspace(app, () =>
      recorder.record({ ...delayed, listing: home }),
    );

    const captions = await events(appId, 'screenshotCaptions');
    expect(
      captions.map((event) => [event.capturedAt, event.before, event.after]),
    ).toEqual([
      [
        latest.capturedAt.toISOString(),
        'Track habits | Plan your day',
        'Track habits | Sleep better',
      ],
      [
        delayed.capturedAt.toISOString(),
        'Track habits | Plan your week',
        'Track habits | Plan your day',
      ],
    ]);
  });
});
