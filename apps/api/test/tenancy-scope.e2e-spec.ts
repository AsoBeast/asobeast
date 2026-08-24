import { execSync } from 'child_process';
import { join } from 'path';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient, Store } from '@prisma/client';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { CrossTenantAccess } from '../src/common/tenancy/cross-tenant-access';
import { WorkspaceContext } from '../src/common/tenancy/workspace-context';
import { PrismaService } from '../src/prisma/prisma.service';
import { testDb } from './helpers/test-db';
import { obliterateQueues } from './obliterate-queues';

const WORKSPACE_A = 'ws_scope_a';
const WORKSPACE_B = 'ws_scope_b';

describe('Workspace-scoped database access (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let workspace: WorkspaceContext;
  let crossTenant: CrossTenantAccess;
  let db: PrismaClient;

  beforeAll(async () => {
    execSync('pnpm prisma migrate deploy', {
      cwd: join(__dirname, '..'),
      env: process.env,
      stdio: 'ignore',
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    workspace = app.get(WorkspaceContext);
    crossTenant = app.get(CrossTenantAccess);
    db = testDb();

    await db.$executeRawUnsafe('TRUNCATE TABLE "App" CASCADE');
    for (const [id, storeAppId] of [
      [WORKSPACE_A, 'scope-a'],
      [WORKSPACE_B, 'scope-b'],
    ]) {
      await db.workspace.upsert({
        where: { id },
        update: {},
        create: { id, name: id },
      });
      await db.app.create({
        data: {
          workspaceId: id,
          store: Store.APP_STORE,
          storeAppId,
          country: 'us',
          name: storeAppId,
        },
      });
    }
  });

  afterAll(async () => {
    await db.$executeRawUnsafe('TRUNCATE TABLE "App" CASCADE');
    await db.workspace.deleteMany({
      where: { id: { in: [WORKSPACE_A, WORKSPACE_B] } },
    });
    await db.$disconnect();
    await obliterateQueues(app);
    await app.close();
  });

  const storeAppIds = () =>
    prisma.app
      .findMany({ select: { storeAppId: true } })
      .then((rows) => rows.map((row) => row.storeAppId).sort());

  it('returns nothing to an unscoped query rather than everything', async () => {
    await expect(storeAppIds()).resolves.toEqual([]);
  });

  it('returns every workspace only through the explicit escape hatch', async () => {
    await expect(
      crossTenant.becauseThisWorkIsNotOwnedByOneWorkspace(
        'the isolation suite checks the hatch itself',
        storeAppIds,
      ),
    ).resolves.toEqual(['scope-a', 'scope-b']);
  });

  it('closes the escape hatch again once its work is done', async () => {
    await crossTenant.becauseThisWorkIsNotOwnedByOneWorkspace(
      'the isolation suite checks the hatch itself',
      storeAppIds,
    );

    await expect(storeAppIds()).resolves.toEqual([]);
  });

  it('returns only the scoped workspace rows to a query with no where clause', async () => {
    await expect(workspace.run(WORKSPACE_A, storeAppIds)).resolves.toEqual([
      'scope-a',
    ]);
    await expect(workspace.run(WORKSPACE_B, storeAppIds)).resolves.toEqual([
      'scope-b',
    ]);
  });

  it('keeps interleaved workspaces apart on a pooled connection', async () => {
    const read = (workspaceId: string, delayMs: number) =>
      workspace.run(workspaceId, async () => {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        return storeAppIds();
      });

    const results = await Promise.all([
      read(WORKSPACE_A, 0),
      read(WORKSPACE_B, 5),
      read(WORKSPACE_A, 10),
      read(WORKSPACE_B, 0),
      read(WORKSPACE_A, 5),
      read(WORKSPACE_B, 10),
    ]);

    expect(results).toEqual([
      ['scope-a'],
      ['scope-b'],
      ['scope-a'],
      ['scope-b'],
      ['scope-a'],
      ['scope-b'],
    ]);
  });

  it('reverts the session role once the scope closes', async () => {
    await workspace.run(WORKSPACE_A, storeAppIds);

    const role = await db.$queryRaw<
      { current_user: string }[]
    >`SELECT current_user`;
    expect(role[0].current_user).not.toBe('asobeast_app');
  });

  it('scopes every statement of an explicit transaction', async () => {
    const seen = await workspace.run(WORKSPACE_A, () =>
      prisma.withTransaction(async (tx) => {
        const first = await tx.app.findMany({ select: { storeAppId: true } });
        await tx.app.count();
        const second = await tx.app.findMany({ select: { storeAppId: true } });
        return [...first, ...second].map((row) => row.storeAppId);
      }),
    );

    expect(seen).toEqual(['scope-a', 'scope-a']);
  });

  it('refuses to write a row into another workspace', async () => {
    await expect(
      workspace.run(WORKSPACE_A, async () => {
        await prisma.app.create({
          data: {
            workspaceId: WORKSPACE_B,
            store: Store.APP_STORE,
            storeAppId: 'smuggled',
            country: 'us',
          },
        });
      }),
    ).rejects.toThrow(/row-level security/);

    await expect(workspace.run(WORKSPACE_B, storeAppIds)).resolves.toEqual([
      'scope-b',
    ]);
  });
});
