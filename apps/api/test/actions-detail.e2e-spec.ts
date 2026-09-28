import { execSync } from 'child_process';
import { join } from 'path';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { ActionDetail, ActionListResult } from '@asobeast/shared';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import { StoreProviderRegistry } from '../src/store-providers/store-provider.registry';
import {
  ACTION_DAY,
  generateActionsAt,
  seedUncoveredKeyword,
} from './helpers/action-seed';
import { ownerAgent, useCookies } from './helpers/session';
import { testDb } from './helpers/test-db';
import { obliterateQueues } from './obliterate-queues';

describe('action detail (e2e)', () => {
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

  it('serves the list item with its history', async () => {
    await seedUncoveredKeyword(prisma);
    await generateActionsAt(app, ACTION_DAY(0));
    const list = (await api.get('/actions').expect(200))
      .body as ActionListResult;
    const [item] = list.items;
    await api.patch(`/actions/${item.id}`).send({ status: 'DONE' }).expect(200);

    const detail = (await api.get(`/actions/${item.id}`).expect(200))
      .body as ActionDetail;
    const done = (
      (await api.get('/actions?status=DONE').expect(200))
        .body as ActionListResult
    ).items[0];

    const { events, trend, outcome, ...fields } = detail;
    expect(fields).toEqual(done);
    expect(events.map((event) => [event.type, event.actor])).toEqual([
      ['opened', 'system'],
      ['done', 'user'],
    ]);
    expect(trend).toBeNull();
    expect(outcome).toBeNull();
  });

  it('answers 404 for an unknown action', async () => {
    await api.get('/actions/act_missing').expect(404);
  });
});
