import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import { ownerAgent, useCookies } from './helpers/session';
import { obliterateQueues } from './obliterate-queues';
import { testDb } from './helpers/test-db';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;
  let api: Awaited<ReturnType<typeof ownerAgent>>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    useCookies(app);
    await app.init();
    const prisma = testDb();
    await prisma.workspace.upsert({
      where: { id: DEFAULT_WORKSPACE_ID },
      update: {},
      create: { id: DEFAULT_WORKSPACE_ID, name: 'Default' },
    });
    await prisma.$disconnect();
    api = await ownerAgent(app);
  });

  it('/ (GET)', () => {
    return api.get('/').expect(200).expect('Hello World!');
  });

  afterEach(async () => {
    await obliterateQueues(app);
    await app.close();
  });
});
