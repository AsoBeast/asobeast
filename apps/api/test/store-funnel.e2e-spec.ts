import './helpers/enable-store-connect';
import { Store } from '@prisma/client';
import type { StoreFunnelReport } from '@asobeast/shared';
import request from 'supertest';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import { seedApiToken } from './helpers/api-tokens';
import { ownerAgent } from './helpers/session';
import {
  startStoreConnectApp,
  type StoreConnectHarness,
} from './helpers/store-connect-harness';
import { clearRateLimitCounters, obliterateQueues } from './obliterate-queues';

const OTHER_WORKSPACE = 'ws_store_funnel_other';
const DAY_MS = 86_400_000;

const utcDay = (daysAgo: number): Date => {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) -
      daysAgo * DAY_MS,
  );
};

const dateKey = (date: Date) => date.toISOString().slice(0, 10);

describe('Store funnel (e2e)', () => {
  let harness: StoreConnectHarness;
  let owner: Awaited<ReturnType<typeof ownerAgent>>;
  let appId: string;
  let competitorId: string;
  let foreignAppId: string;

  const connect = async (workspaceId = DEFAULT_WORKSPACE_ID) =>
    harness.prisma.storeConnection.create({
      data: {
        workspaceId,
        store: Store.APP_STORE,
        issuerId: 'issuer',
        keyId: 'KEY1234567',
        keyFingerprint: '0123456789abcdef',
        credentialCiphertext: 'v1.sealed',
      },
    });

  const reportOn = async (
    connectionId: string,
    app: string,
    workspaceId = DEFAULT_WORKSPACE_ID,
  ) =>
    harness.prisma.storeReportRequest.create({
      data: {
        workspaceId,
        connectionId,
        appId: app,
        accessType: 'ONGOING',
        remoteId: 'remote',
      },
    });

  const seedDays = async (app: string, workspaceId = DEFAULT_WORKSPACE_ID) => {
    const rows = [];
    for (let daysAgo = 0; daysAgo < 40; daysAgo += 1) {
      for (const [territory, country, gets] of [
        ['United States', 'us', 10],
        ['Germany', 'de', 2],
      ] as const) {
        rows.push({
          workspaceId,
          appId: app,
          date: utcDay(daysAgo),
          territory,
          country,
          sourceType: 'search',
          pageType: 'productPage',
          impressions: 100,
          uniqueImpressions: 100,
          pageViews: 30,
          uniquePageViews: 30,
          gets,
          uniqueGets: gets,
          processingDate: utcDay(daysAgo),
        });
      }
    }
    await harness.prisma.storeFunnelDay.createMany({ data: rows });
  };

  const funnel = async (path: string) =>
    (await owner.get(path).expect(200)).body as StoreFunnelReport;

  beforeAll(async () => {
    harness = await startStoreConnectApp();
    await harness.prisma.workspace.upsert({
      where: { id: OTHER_WORKSPACE },
      update: {},
      create: { id: OTHER_WORKSPACE, name: 'Other' },
    });
    owner = await ownerAgent(harness.app);
  }, 60_000);

  beforeEach(async () => {
    await harness.prisma.storeConnection.deleteMany({});
    await harness.prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "App", "Keyword" RESTART IDENTITY CASCADE',
    );
    await clearRateLimitCounters(harness.app);
    const app = await harness.prisma.app.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store: Store.APP_STORE,
        storeAppId: '1476097583',
        country: 'us',
        name: 'Focus',
      },
    });
    appId = app.id;
    const competitor = await harness.prisma.app.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store: Store.APP_STORE,
        storeAppId: '999',
        country: 'us',
        name: 'Rival',
        isCompetitor: true,
      },
    });
    competitorId = competitor.id;
    const foreign = await harness.prisma.app.create({
      data: {
        workspaceId: OTHER_WORKSPACE,
        store: Store.APP_STORE,
        storeAppId: '555',
        country: 'us',
        name: 'Foreign',
      },
    });
    foreignAppId = foreign.id;
    await seedDays(appId);
  });

  afterAll(async () => {
    await harness.prisma.storeConnection.deleteMany({});
    await harness.prisma.workspace.deleteMany({
      where: { id: OTHER_WORKSPACE },
    });
    await obliterateQueues(harness.app);
    await harness.app.close();
    await harness.prisma.$disconnect();
  });

  it('answers the daily series and three measured windows for a reporting app', async () => {
    const connection = await connect();
    await reportOn(connection.id, appId);

    const report = await funnel(`/apps/${appId}/funnel`);

    expect(report).toMatchObject({
      appId,
      store: 'APP_STORE',
      country: null,
      connected: true,
      source: 'appStoreConnect',
      days: 90,
      completeThrough: dateKey(utcDay(3)),
    });
    expect(report.points).toHaveLength(90);
    expect(report.points.slice(-3).every((point) => !point.complete)).toBe(
      true,
    );
    expect(report.points.at(-4)?.complete).toBe(true);
    expect(report.points.at(-1)?.total).toMatchObject({
      gets: 12,
      impressions: 200,
    });
    expect(
      report.windows.map((window) => [window.days, window.status]),
    ).toEqual([
      [7, 'measured'],
      [14, 'measured'],
      [28, 'pending'],
    ]);
    expect(report.windows[0].current).toMatchObject({
      gets: 84,
      pageViews: 420,
    });
  });

  it('scopes every number to a market and validates the query', async () => {
    const connection = await connect();
    await reportOn(connection.id, appId);

    const german = await funnel(`/apps/${appId}/funnel?country=de&days=7`);

    expect(german.country).toBe('de');
    expect(german.points).toHaveLength(7);
    expect(german.points.at(-1)?.total.gets).toBe(2);
    await owner.get(`/apps/${appId}/funnel?country=DE`).expect(400);
    await owner.get(`/apps/${appId}/funnel?days=3`).expect(400);
    await owner.get(`/apps/${appId}/funnel?days=366`).expect(400);
  });

  it('answers connected false for a competitor and 404 for an unknown or foreign app', async () => {
    const connection = await connect();
    await reportOn(connection.id, appId);

    const report = await funnel(`/apps/${competitorId}/funnel`);

    expect(report).toMatchObject({ connected: false, points: [], windows: [] });
    await owner.get('/apps/nope/funnel').expect(404);
    await owner.get(`/apps/${foreignAppId}/funnel`).expect(404);
  });

  it('answers connected false without a connection, even when rows exist from an earlier one', async () => {
    const report = await funnel(`/apps/${appId}/funnel`);

    expect(report).toMatchObject({
      connected: false,
      source: null,
      completeThrough: null,
      points: [],
      windows: [],
    });
  });

  it('answers connected false while the connection is rejected or the request unmatched', async () => {
    const connection = await connect();
    const requestRow = await reportOn(connection.id, appId);
    await harness.prisma.storeReportRequest.update({
      where: { id: requestRow.id },
      data: { state: 'unmatched' },
    });
    expect((await funnel(`/apps/${appId}/funnel`)).connected).toBe(false);

    await harness.prisma.storeReportRequest.update({
      where: { id: requestRow.id },
      data: { state: 'requested' },
    });
    await harness.prisma.storeConnection.update({
      where: { id: connection.id },
      data: { status: 'rejected' },
    });
    expect((await funnel(`/apps/${appId}/funnel`)).connected).toBe(false);
  });

  it('lets a read token read it', async () => {
    const connection = await connect();
    await reportOn(connection.id, appId);
    const token = await seedApiToken(harness.prisma, {
      seed: 'funnelreader',
      email: 'funnel-reader@example.com',
      workspaceId: DEFAULT_WORKSPACE_ID,
      role: 'member',
      scope: 'read',
    });

    const response = await request(harness.app.getHttpServer())
      .get(`/apps/${appId}/funnel`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect((response.body as StoreFunnelReport).connected).toBe(true);
  });

  it('answers each product page with its ratio to the default page, default first', async () => {
    const connection = await connect();
    await reportOn(connection.id, appId);
    for (const [pageTitle, pageViews, gets] of [
      ['Summer sale', 400, 8],
      ['Default product page', 1000, 40],
    ] as const) {
      await harness.prisma.storeFunnelPageDay.create({
        data: {
          workspaceId: DEFAULT_WORKSPACE_ID,
          appId,
          date: utcDay(5),
          territory: 'United States',
          country: 'us',
          pageTitle,
          pageViews,
          uniquePageViews: pageViews,
          gets,
          uniqueGets: gets,
          processingDate: utcDay(4),
        },
      });
    }

    const report = await funnel(`/apps/${appId}/funnel`);

    expect(report.pages?.map((page) => [page.title, page.ratio])).toEqual([
      ['Default product page', 1],
      ['Summer sale', 0.5],
    ]);
    expect(
      (await funnel(`/apps/${appId}/funnel?country=de`)).pages,
    ).toBeUndefined();
  });

  it('leaves pages out when the detailed report brought nothing', async () => {
    const connection = await connect();
    await reportOn(connection.id, appId);

    const report = await funnel(`/apps/${appId}/funnel`);

    expect(report).not.toHaveProperty('pages');
  });

  it('answers a play app from its country rows for a market and its traffic rows for all markets', async () => {
    const play = await harness.prisma.app.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store: Store.GOOGLE_PLAY,
        storeAppId: 'com.example.habits',
        country: 'us',
        name: 'Habits',
      },
    });
    const connection = await harness.prisma.storeConnection.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store: Store.GOOGLE_PLAY,
        issuerId: 'reports@focus-123.iam.gserviceaccount.com',
        keyId: 'a1b2c3d4e5f6',
        keyFingerprint: '0123456789abcdef',
        credentialCiphertext: 'v1.sealed',
        reportAccess: 'admin',
        bucket: 'pubsite_prod_rev_1',
      },
    });
    await reportOn(connection.id, play.id);
    const day = utcDay(10);
    const counters = (visitors: number, acquisitions: number) => ({
      impressions: 0,
      uniqueImpressions: 0,
      pageViews: visitors,
      uniquePageViews: visitors,
      gets: acquisitions,
      uniqueGets: acquisitions,
    });
    await harness.prisma.storeFunnelDay.createMany({
      data: [
        {
          territory: 'us',
          country: 'us',
          sourceType: 'all',
          ...counters(800, 40),
        },
        {
          territory: 'de',
          country: 'de',
          sourceType: 'all',
          ...counters(200, 10),
        },
        {
          territory: 'all',
          country: null,
          sourceType: 'search',
          ...counters(600, 30),
        },
        {
          territory: 'all',
          country: null,
          sourceType: 'browse',
          ...counters(400, 20),
        },
      ].map((row) => ({
        ...row,
        workspaceId: DEFAULT_WORKSPACE_ID,
        appId: play.id,
        date: day,
        pageType: 'productPage',
        processingDate: day,
      })),
    });

    const all = await funnel(`/apps/${play.id}/funnel?days=30`);
    const point = (report: StoreFunnelReport) =>
      report.points.find((each) => each.date === dateKey(day));

    expect(all).toMatchObject({ connected: true, source: 'playConsole' });
    expect(point(all)?.total).toEqual({
      impressions: null,
      uniqueImpressions: null,
      pageViews: 1000,
      gets: 50,
      conversion: 0.05,
    });
    expect(point(all)?.search).toMatchObject({ pageViews: 600, gets: 30 });
    const de = await funnel(`/apps/${play.id}/funnel?days=30&country=de`);
    expect(point(de)?.total).toMatchObject({
      impressions: null,
      pageViews: 200,
      gets: 10,
    });
  });
});
