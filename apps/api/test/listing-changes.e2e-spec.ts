import { execSync } from 'child_process';
import { join } from 'path';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient, Store } from '@prisma/client';
import { ChangeTimeline } from '@asobeast/shared';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { addDays, utcToday } from '../src/analytics/analytics.support';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import { obliterateQueues, settleBootRegistration } from './obliterate-queues';
import { testDb } from './helpers/test-db';
import { ownerAgent, useCookies } from './helpers/session';

const HOME_DAY = addDays(utcToday(), -3);
const MARKET_DAY = addDays(utcToday(), -2);

describe('change timeline per market (e2e)', () => {
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
      'TRUNCATE TABLE "App", "Keyword" RESTART IDENTITY CASCADE',
    );
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await obliterateQueues(app);
    await app.close();
  });

  const seed = async () => {
    const mine = await prisma.app.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store: Store.APP_STORE,
        storeAppId: '111',
        country: 'us',
        name: 'Mine',
      },
    });
    const rival = await prisma.app.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store: Store.APP_STORE,
        storeAppId: '222',
        country: 'us',
        name: 'Rival',
        isCompetitor: true,
        primaryAppId: mine.id,
      },
    });
    const event = (appId: string, country: string | null, after: string) => ({
      appId,
      country,
      field: 'title',
      before: 'Before',
      after,
      capturedAt: country === null ? HOME_DAY : MARKET_DAY,
    });
    await prisma.changeEvent.createMany({
      data: [
        event(mine.id, null, 'mine home'),
        event(mine.id, 'de', 'mine de'),
        event(rival.id, null, 'rival home'),
        event(rival.id, 'de', 'rival de'),
      ],
    });
    return mine;
  };

  const timeline = async (path: string) =>
    ((await api.get(path).expect(200)).body as ChangeTimeline).events;

  it('lists the events of a market with their market', async () => {
    const mine = await seed();

    const events = await timeline(`/apps/${mine.id}/changes?country=de`);

    expect(events.map((event) => event.after).sort()).toEqual([
      'mine de',
      'rival de',
    ]);
    expect(events.every((event) => event.country === 'de')).toBe(true);
  });

  it('lists the home events when no market is named', async () => {
    const mine = await seed();

    const events = await timeline(`/apps/${mine.id}/changes`);

    expect(events.map((event) => event.after).sort()).toEqual([
      'mine home',
      'rival home',
    ]);
    expect(events.every((event) => event.country === 'us')).toBe(true);
  });

  it('reads the home storefront named by code as the home listing', async () => {
    const mine = await seed();

    const named = await timeline(`/apps/${mine.id}/changes?country=us`);
    const omitted = await timeline(`/apps/${mine.id}/changes`);

    expect(named).toEqual(omitted);
  });

  it('keeps recent changes on the home listing', async () => {
    await seed();

    const events = await timeline('/changes/recent');

    expect(events.map((event) => event.after).sort()).toEqual([
      'mine home',
      'rival home',
    ]);
  });

  it('answers 400 for a code that is not a storefront', async () => {
    const mine = await seed();

    await api.get(`/apps/${mine.id}/changes?country=zz`).expect(400);
  });

  it("includes a competitor's market events", async () => {
    const mine = await seed();

    const events = await timeline(`/apps/${mine.id}/changes?country=de`);

    const rival = events.find((event) => event.isCompetitor);
    expect(rival?.appName).toBe('Rival');
    expect(rival?.after).toBe('rival de');
  });
});
