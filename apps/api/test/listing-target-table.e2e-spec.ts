import { execSync } from 'child_process';
import { join } from 'path';
import { PrismaClient, Store } from '@prisma/client';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import { testDb } from './helpers/test-db';

describe('the listing target table (e2e)', () => {
  const OTHER = 'ws_listing_target_other';
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

  const seedTarget = (appId: string, slots: string[], localization = 'en-US') =>
    prisma.listingTarget.create({
      data: {
        appId,
        workspaceId: DEFAULT_WORKSPACE_ID,
        localization,
        slots,
      },
    });

  const scopedRows = (workspaceId: string) =>
    prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT app_enter_workspace(${workspaceId})`;
      return tx.listingTarget.findMany();
    });

  beforeAll(async () => {
    execSync('pnpm prisma migrate deploy', {
      cwd: join(__dirname, '..'),
      env: process.env,
      stdio: 'ignore',
    });
    prisma = testDb();
    for (const id of [DEFAULT_WORKSPACE_ID, OTHER]) {
      await prisma.workspace.upsert({
        where: { id },
        update: {},
        create: { id, name: id },
      });
    }
  });

  beforeEach(() =>
    prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "App", "Keyword" RESTART IDENTITY CASCADE',
    ),
  );

  afterAll(async () => {
    await prisma.workspace.delete({ where: { id: OTHER } });
    await prisma.$disconnect();
  });

  it('stores slots in order with empty strings for empty slots', async () => {
    const app = await seedApp('a');
    await seedTarget(app.id, ['habit tracker', '', 'focus timer']);

    await expect(
      prisma.listingTarget.findUnique({
        where: {
          appId_localization: { appId: app.id, localization: 'en-US' },
        },
        select: { slots: true },
      }),
    ).resolves.toEqual({ slots: ['habit tracker', '', 'focus timer'] });
  });

  it('keys one row per app and localization', async () => {
    const app = await seedApp('a');
    await seedTarget(app.id, ['habit']);
    await seedTarget(app.id, ['habit'], 'en-GB');

    await expect(seedTarget(app.id, ['focus'])).rejects.toThrow(
      'Unique constraint',
    );
  });

  it('is removed with its app', async () => {
    const app = await seedApp('a');
    await seedTarget(app.id, ['habit']);

    await prisma.app.delete({ where: { id: app.id } });

    await expect(prisma.listingTarget.count()).resolves.toBe(0);
  });

  it('is invisible from another workspace', async () => {
    const app = await seedApp('a');
    await seedTarget(app.id, ['habit']);

    await expect(scopedRows(DEFAULT_WORKSPACE_ID)).resolves.toHaveLength(1);
    await expect(scopedRows(OTHER)).resolves.toEqual([]);
  });

  it('answers nothing with no workspace in scope', async () => {
    const app = await seedApp('a');
    await seedTarget(app.id, ['habit']);

    await expect(scopedRows('')).resolves.toEqual([]);
  });
});
