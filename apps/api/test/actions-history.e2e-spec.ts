import { execSync } from 'child_process';
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import { StoreProviderRegistry } from '../src/store-providers/store-provider.registry';
import { ownerAgent, useCookies } from './helpers/session';
import {
  ACTION_DAY,
  generateActionsAt,
  seedUncoveredKeyword,
} from './helpers/action-seed';
import { testDb } from './helpers/test-db';
import { obliterateQueues } from './obliterate-queues';

const MIGRATIONS = join(__dirname, '..', 'prisma', 'migrations');

const migrationSql = (suffix: string): string => {
  const folder = readdirSync(MIGRATIONS).find((name) =>
    name.endsWith(`_${suffix}`),
  );
  if (!folder) throw new Error(`no ${suffix} migration`);
  return readFileSync(join(MIGRATIONS, folder, 'migration.sql'), 'utf8');
};

describe('action history (e2e)', () => {
  describe('the action event migration', () => {
    const sql = migrationSql('add_action_events');

    it('backfills an opened, a closed and a resolved event', () => {
      expect(sql.match(/INSERT INTO "ActionEvent"/g)).toHaveLength(3);
      expect(sql).toContain("'opened', 'system', 'OPEN'");
      expect(sql).toContain("WHERE i.\"status\" IN ('DONE', 'DISMISSED')");
      expect(sql).toContain("'resolved', 'system', 'RESOLVED'");
    });

    it('protects the table with the tenant isolation policy', () => {
      expect(sql).toContain(
        'GRANT SELECT, INSERT, UPDATE, DELETE ON "ActionEvent" TO asobeast_app;',
      );
      expect(sql).toContain(
        'ALTER TABLE "ActionEvent" FORCE ROW LEVEL SECURITY;',
      );
      expect(sql).toContain('CREATE POLICY tenant_isolation ON "ActionEvent"');
    });

    it('backfills before row level security is enforced', () => {
      expect(sql.lastIndexOf('INSERT INTO "ActionEvent"')).toBeLessThan(
        sql.indexOf('ENABLE ROW LEVEL SECURITY'),
      );
    });
  });

  describe('recorded transitions', () => {
    let app: INestApplication<App>;
    let prisma: PrismaClient;
    let api: Awaited<ReturnType<typeof ownerAgent>>;

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
        .useValue({
          get: () => {
            throw new Error('this suite must never touch a store');
          },
        })
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

    afterAll(async () => {
      await prisma.$disconnect();
      await obliterateQueues(app);
      await app.close();
    });

    const generateOne = async (): Promise<string> => {
      await seedUncoveredKeyword(prisma);
      await generateActionsAt(app, ACTION_DAY(0));
      const [action] = await prisma.actionItem.findMany({
        where: { workspaceId: DEFAULT_WORKSPACE_ID },
        select: { id: true },
      });
      return action.id;
    };

    it('records opened, done, reopened and dismissed in order with actors', async () => {
      const id = await generateOne();
      const owner = await prisma.user.findFirstOrThrow({
        where: { workspaceId: DEFAULT_WORKSPACE_ID, role: 'owner' },
        select: { id: true },
      });

      await api.patch(`/actions/${id}`).send({ status: 'DONE' }).expect(200);
      await api.patch(`/actions/${id}`).send({ status: 'OPEN' }).expect(200);
      await api
        .patch(`/actions/${id}`)
        .send({ status: 'DISMISSED' })
        .expect(200);

      const events = await prisma.actionEvent.findMany({
        where: { actionId: id },
        orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }],
        select: { type: true, actor: true, userId: true },
      });
      expect(events).toEqual([
        { type: 'opened', actor: 'system', userId: null },
        { type: 'done', actor: 'user', userId: owner.id },
        { type: 'reopened', actor: 'user', userId: owner.id },
        { type: 'dismissed', actor: 'user', userId: owner.id },
      ]);
    });
  });
});
