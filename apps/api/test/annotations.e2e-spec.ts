import { execSync } from 'child_process';
import { join } from 'path';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient, Store } from '@prisma/client';
import {
  ApiErrorEnvelope,
  AppAnnotationItem,
  AppAnnotationList,
} from '@asobeast/shared';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { testDb } from './helpers/test-db';
import { ownerAgent, useCookies } from './helpers/session';
import { obliterateQueues, settleBootRegistration } from './obliterate-queues';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';

describe('AnnotationsController (e2e)', () => {
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
    }).compile();

    app = moduleFixture.createNestApplication();
    useCookies(app);
    await app.init();
    await settleBootRegistration(app);

    prisma = testDb();
    await prisma.workspace.upsert({
      where: { id: DEFAULT_WORKSPACE_ID },
      update: {},
      create: { id: DEFAULT_WORKSPACE_ID, name: 'Default' },
    });
    api = await ownerAgent(app);
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "App", "Keyword", "AppAnnotation" RESTART IDENTITY CASCADE',
    );
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await obliterateQueues(app);
    await app.close();
  });

  const createApp = (storeAppId: string, store: Store = Store.APP_STORE) =>
    prisma.app.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store,
        storeAppId,
        country: 'us',
        name: 'Mine',
      },
    });

  it('returns a 404 envelope for an unknown app id', async () => {
    const response = await api
      .post('/apps/missing/annotations')
      .send({ date: '2026-10-08', label: 'Release 5.21.0' })
      .expect(404);

    const body = response.body as ApiErrorEnvelope;
    expect(body.statusCode).toBe(404);
    expect(body.path).toBe('/apps/missing/annotations');
  });

  it('stores an annotation and answers the item', async () => {
    const created = await createApp('111');

    const response = await api
      .post(`/apps/${created.id}/annotations`)
      .send({ date: '2026-10-08', label: '  Release   5.21.0  ' })
      .expect(201);

    const item = response.body as AppAnnotationItem;
    expect(Object.keys(item).sort()).toEqual([
      'appId',
      'createdAt',
      'date',
      'id',
      'label',
      'market',
      'tag',
    ]);
    expect(item).toMatchObject({
      appId: created.id,
      date: '2026-10-08',
      label: 'Release 5.21.0',
      market: null,
      tag: null,
    });

    const rows = await prisma.appAnnotation.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0].date.toISOString()).toBe('2026-10-08T00:00:00.000Z');
  });

  it('normalizes the tag and stores the market when asked', async () => {
    const created = await createApp('111');

    const response = await api
      .post(`/apps/${created.id}/annotations`)
      .send({
        date: '2026-10-08',
        label: 'DE wave',
        market: 'de',
        tag: ' Q4  Wave ',
      })
      .expect(201);

    expect(response.body).toMatchObject({ market: 'de', tag: 'q4 wave' });
  });

  it('refuses a market the store does not list with 400 and writes nothing', async () => {
    const created = await createApp('111', Store.APP_STORE);

    const response = await api
      .post(`/apps/${created.id}/annotations`)
      .send({ date: '2026-10-08', label: 'DE wave', market: 'xx' })
      .expect(400);

    expect((response.body as ApiErrorEnvelope).message).toContain('xx');
    await expect(prisma.appAnnotation.count()).resolves.toBe(0);
  });

  it.each([
    ['2026-02-30', 'a day that never existed'],
    ['2026-13-01', 'a month that does not exist'],
    ['today', 'a date that is not YYYY-MM-DD'],
  ])('refuses %s, %s, with 400', async (date) => {
    const created = await createApp('111');

    await api
      .post(`/apps/${created.id}/annotations`)
      .send({ date, label: 'x' })
      .expect(400);
  });

  it('refuses a blank label and one over the limit with 400', async () => {
    const created = await createApp('111');

    await api
      .post(`/apps/${created.id}/annotations`)
      .send({ date: '2026-10-08', label: '   ' })
      .expect(400);
    await api
      .post(`/apps/${created.id}/annotations`)
      .send({ date: '2026-10-08', label: 'x'.repeat(81) })
      .expect(400);
    await api
      .post(`/apps/${created.id}/annotations`)
      .send({ date: '2026-10-08', label: 'x', tag: '#hash' })
      .expect(400);
  });

  it('lists the annotations of one app, oldest day first', async () => {
    const created = await createApp('111');

    await api
      .post(`/apps/${created.id}/annotations`)
      .send({ date: '2026-10-10', label: 'Second' })
      .expect(201);
    await api
      .post(`/apps/${created.id}/annotations`)
      .send({ date: '2026-10-08', label: 'First' })
      .expect(201);

    const response = await api
      .get(`/apps/${created.id}/annotations`)
      .expect(200);

    const body = response.body as AppAnnotationList;
    expect(body.annotations.map((item) => item.label)).toEqual([
      'First',
      'Second',
    ]);
  });

  it('removes an annotation and answers 404 the second time', async () => {
    const created = await createApp('111');
    const { id } = (
      await api
        .post(`/apps/${created.id}/annotations`)
        .send({ date: '2026-10-08', label: 'Release 5.21.0' })
        .expect(201)
    ).body as AppAnnotationItem;

    await api.delete(`/apps/${created.id}/annotations/${id}`).expect(204);
    await api.delete(`/apps/${created.id}/annotations/${id}`).expect(404);
    await expect(prisma.appAnnotation.count()).resolves.toBe(0);
  });

  it('answers 404 when the annotation belongs to another app of the workspace', async () => {
    const mine = await createApp('111');
    const other = await createApp('222');
    const { id } = (
      await api
        .post(`/apps/${other.id}/annotations`)
        .send({ date: '2026-10-08', label: 'Rival release' })
        .expect(201)
    ).body as AppAnnotationItem;

    await api.delete(`/apps/${mine.id}/annotations/${id}`).expect(404);
  });
});
