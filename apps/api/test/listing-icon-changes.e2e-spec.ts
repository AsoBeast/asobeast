import { execSync } from 'child_process';
import { join } from 'path';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import {
  AppDetail,
  ChangeEventItem,
  ChangeTimeline,
  SnapshotDiffResult,
} from '@asobeast/shared';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import { IconImageSource } from '../src/store-providers/icon-image';
import { StoreProviderRegistry } from '../src/store-providers/store-provider.registry';
import { ownerAgent, useCookies } from './helpers/session';
import {
  appleShot,
  APP_STORE_URL,
  FakeScreenshotRegistry,
} from './helpers/screenshot-store';
import { testDb } from './helpers/test-db';
import { obliterateQueues, pauseQueues } from './obliterate-queues';

const ICON_A =
  'https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/a2/c1/af/a2c1af65-9766-a31a-ba3c-b17f45b6c503/AppIcon-0-0-1x_U007emarketing-0-8-0-85-220.png/512x512bb.jpg';
const ICON_B =
  'https://is1-ssl.mzstatic.com/image/thumb/Purple211/v4/4c/94/fc/4c94fc14-695c-d7d4-d8cc-ea2a3d8d8c66/AppIcon-0-0-1x_U007emarketing-0-8-85-220.png/512x512bb.jpg';

describe('Icon change events (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let api: Awaited<ReturnType<typeof ownerAgent>>;
  const registry = new FakeScreenshotRegistry();
  const compare = jest.fn<
    Promise<boolean | null>,
    [string | null, string | null]
  >();

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
      .overrideProvider(IconImageSource)
      .useValue({ compare })
      .compile();
    app = moduleFixture.createNestApplication();
    useCookies(app);
    await app.init();
    await pauseQueues(app);

    prisma = testDb();
    await prisma.workspace.upsert({
      where: { id: DEFAULT_WORKSPACE_ID },
      update: {},
      create: { id: DEFAULT_WORKSPACE_ID, name: 'Default' },
    });
    api = await ownerAgent(app);
  });

  beforeEach(async () => {
    compare.mockReset().mockResolvedValue(null);
    registry.reset();
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "App", "Keyword", "AppGroup" RESTART IDENTITY CASCADE',
    );
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await obliterateQueues(app);
    await app.close();
  });

  const importApp = async () =>
    (
      (await api.post('/apps').send({ url: APP_STORE_URL }).expect(201))
        .body as AppDetail
    ).id;

  const refresh = async (appId: string) =>
    (await api.post(`/apps/${appId}/refresh`).expect(200))
      .body as SnapshotDiffResult;

  const iconEvents = async (appId: string): Promise<ChangeEventItem[]> => {
    const { events } = (await api.get(`/apps/${appId}/changes`).expect(200))
      .body as ChangeTimeline;
    return events.filter((event) => event.field === 'icon');
  };

  it('records no icon event when a new address draws the same picture', async () => {
    registry.icon = ICON_A;
    compare.mockResolvedValue(true);
    const appId = await importApp();
    registry.icon = ICON_B;

    await expect(refresh(appId)).resolves.toMatchObject({ changes: [] });
    await expect(iconEvents(appId)).resolves.toEqual([]);
    expect(compare).toHaveBeenCalledWith(ICON_A, ICON_B);
  });

  it('records the icon event when the pixels differ', async () => {
    registry.icon = ICON_A;
    compare.mockResolvedValue(false);
    const appId = await importApp();
    registry.icon = ICON_B;

    await expect(refresh(appId)).resolves.toMatchObject({
      changes: [{ field: 'icon', before: ICON_A, after: ICON_B }],
    });
    await expect(iconEvents(appId)).resolves.toHaveLength(1);
  });

  it('records the icon event when the pixels could not be compared', async () => {
    registry.icon = ICON_A;
    compare.mockResolvedValue(null);
    const appId = await importApp();
    registry.icon = ICON_B;

    await expect(refresh(appId)).resolves.toMatchObject({
      changes: [{ field: 'icon', before: ICON_A, after: ICON_B }],
    });
    await expect(iconEvents(appId)).resolves.toHaveLength(1);
  });

  it('leaves the screenshots of the refresh to their own events', async () => {
    registry.icon = ICON_A;
    compare.mockResolvedValue(true);
    const appId = await importApp();
    registry.icon = ICON_B;
    registry.screenshots = [appleShot(1), appleShot(9), appleShot(3)];

    const { changes } = await refresh(appId);

    expect(changes).toEqual([
      {
        field: 'screenshotImages',
        before: '3 screenshots',
        after: '3 screenshots, 1 replaced',
      },
    ]);
    await expect(iconEvents(appId)).resolves.toEqual([]);
  });
});
