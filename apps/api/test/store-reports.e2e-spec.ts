import './helpers/enable-store-connect';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { Store } from '@prisma/client';
import type { StoreConnectionState } from '@asobeast/shared';
import { UnrecoverableError } from 'bullmq';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import type { AscRequest } from '../src/store-connect/asc-transport';
import { PrismaService } from '../src/prisma/prisma.service';
import { StoreConnectionService } from '../src/store-connect/store-connection.service';
import { StoreReportApplier } from '../src/store-connect/store-report-applier';
import {
  ADMIN_KEY_NEEDED,
  StoreReportSyncService,
} from '../src/store-connect/store-report-sync.service';
import { ownerAgent } from './helpers/session';
import {
  answer,
  bytes,
  CONNECTION_REQUEST,
  refusal,
  startStoreConnectApp,
  type StoreConnectHarness,
} from './helpers/store-connect-harness';
import { asWorkspace } from './helpers/tenancy';
import { clearRateLimitCounters, obliterateQueues } from './obliterate-queues';

const STORE_APP_ID = '1476097583';
const OTHER_WORKSPACE = 'ws_store_reports_other';
const FIXTURE = readFileSync(
  join(
    __dirname,
    '..',
    'src',
    'store-connect',
    'fixtures',
    'asc',
    'discovery-standard.tsv',
  ),
);

const report = (requestId: string) => ({
  data: [
    {
      type: 'analyticsReports',
      id: `${requestId}-standard`,
      attributes: {
        name: 'App Store Discovery and Engagement Standard',
        category: 'APP_STORE_ENGAGEMENT',
      },
    },
  ],
});

const instances = (...items: [string, string][]) => ({
  data: items.map(([id, processingDate]) => ({
    type: 'analyticsReportInstances',
    id,
    attributes: { granularity: 'DAILY', processingDate },
  })),
});

const segmentOf = (id: string, payload: Buffer) => ({
  data: [
    {
      type: 'analyticsReportSegments',
      id: `${id}-segment`,
      attributes: {
        checksum: '',
        sizeInBytes: payload.length,
        url: `https://reports.example.test/${id}.csv.gz`,
      },
    },
  ],
});

describe('Store report sync (e2e)', () => {
  let harness: StoreConnectHarness;
  let owner: Awaited<ReturnType<typeof ownerAgent>>;
  let appId: string;
  const gz = gzipSync(FIXTURE);

  const run = () =>
    asWorkspace(harness.app, () =>
      harness.app.get(StoreReportSyncService).run('APP_STORE'),
    );

  const paths = (method: AscRequest['method']) =>
    harness.asc.requests
      .filter((request) => request.method === method)
      .map((request) => request.absoluteUrl ?? request.path.split('?')[0]);

  const scriptApple = () => {
    const created: { type: string; id: string; attributes: object }[] = [];
    harness.asc
      .on('GET', /\/analyticsReportRequests\?/, () => answer({ data: created }))
      .on(
        'GET',
        /^\/v1\/apps\?filter/,
        answer({
          data: [
            { type: 'apps', id: STORE_APP_ID, attributes: { name: 'Focus' } },
          ],
        }),
      )
      .on('POST', /^\/v1\/analyticsReportRequests$/, (request) => {
        const accessType = (
          request.body as { data: { attributes: { accessType: string } } }
        ).data.attributes.accessType;
        const data = {
          type: 'analyticsReportRequests',
          id: accessType === 'ONGOING' ? 'ongoing' : 'snapshot',
          attributes: { accessType, stoppedDueToInactivity: false },
        };
        created.push(data);
        return answer({ data }, 201);
      })
      .on(
        'GET',
        /\/analyticsReportRequests\/ongoing\/reports/,
        answer(report('ongoing')),
      )
      .on(
        'GET',
        /\/analyticsReportRequests\/snapshot\/reports/,
        answer(report('snapshot')),
      )
      .on(
        'GET',
        /\/analyticsReports\/ongoing-standard\/instances/,
        answer(instances(['i1', '2026-09-12'])),
      )
      .on(
        'GET',
        /\/analyticsReportInstances\/i1\/segments/,
        answer(segmentOf('i1', gz)),
      )
      .on('GET', /i1\.csv\.gz$/, bytes(gz));
  };

  const funnelRows = () =>
    harness.prisma.storeFunnelDay.findMany({
      where: { appId },
      orderBy: [{ date: 'asc' }, { territory: 'asc' }, { pageType: 'asc' }],
    });

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
    harness.asc.reset();
    await harness.prisma.storeConnection.deleteMany({});
    await harness.prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "App", "Keyword" RESTART IDENTITY CASCADE',
    );
    await clearRateLimitCounters(harness.app);
    const app = await harness.prisma.app.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store: Store.APP_STORE,
        storeAppId: STORE_APP_ID,
        country: 'us',
        name: 'Focus',
      },
    });
    appId = app.id;
    await owner
      .put('/store-connections/APP_STORE')
      .send(CONNECTION_REQUEST)
      .expect(200);
    harness.asc.reset();
  });

  afterAll(async () => {
    await harness.prisma.workspace.deleteMany({
      where: { id: OTHER_WORKSPACE },
    });
    await obliterateQueues(harness.app);
    await harness.app.close();
    await harness.prisma.$disconnect();
  });

  it('requests both reports, downloads the new instance and pivots it into funnel rows', async () => {
    scriptApple();

    const summary = await run();

    expect(summary).toMatchObject({
      instances: 1,
      rows: 7,
      rateLimited: false,
    });
    expect(paths('POST')).toEqual([
      '/v1/analyticsReportRequests',
      '/v1/analyticsReportRequests',
    ]);
    expect(paths('GET')).toEqual(
      expect.arrayContaining([
        '/v1/apps',
        `/v1/apps/${STORE_APP_ID}/analyticsReportRequests`,
        '/v1/analyticsReportRequests/ongoing/reports',
        '/v1/analyticsReports/ongoing-standard/instances',
        '/v1/analyticsReportInstances/i1/segments',
        'https://reports.example.test/i1.csv.gz',
      ]),
    );
    const [instance] = await harness.prisma.storeReportInstance.findMany();
    expect(instance.raw).toEqual(gz);
    expect(instance.appliedAt).toBeInstanceOf(Date);
    const rows = await funnelRows();
    expect(rows).toHaveLength(7);
    expect(rows.find((row) => row.territory === 'Germany')?.country).toBe('de');
    expect(rows.every((row) => row.workspaceId === DEFAULT_WORKSPACE_ID)).toBe(
      true,
    );

    const state = (await owner.get('/store-connections').expect(200))
      .body as StoreConnectionState;
    expect(state.connections[0]).toMatchObject({
      reportAccess: 'admin',
      lastError: null,
    });
    expect(state.connections[0].lastSyncedAt).not.toBeNull();
    expect(state.connections[0].apps).toEqual([
      {
        appId,
        name: 'Focus',
        state: 'requested',
        firstDate: '2026-09-10',
        lastDate: '2026-09-11',
      },
    ]);
  });

  it('downloads nothing and changes no row on a run without a new instance', async () => {
    scriptApple();
    await run();
    const before = await funnelRows();
    harness.asc.requests.length = 0;

    const summary = await run();

    expect(summary).toMatchObject({ instances: 0, rows: 0 });
    expect(paths('POST')).toEqual([]);
    expect(paths('GET')).not.toContain(
      'https://reports.example.test/i1.csv.gz',
    );
    await expect(funnelRows()).resolves.toEqual(before);
  });

  it('overwrites the counters of a date with a newer instance, never with an older one', async () => {
    scriptApple();
    await run();
    const corrected = gzipSync(
      Buffer.from(FIXTURE.toString().replace('\t240\t200', '\t300\t260')),
    );
    harness.asc
      .on(
        'GET',
        /\/analyticsReports\/ongoing-standard\/instances/,
        answer(instances(['i1', '2026-09-12'], ['i2', '2026-09-13'])),
      )
      .on(
        'GET',
        /\/analyticsReportInstances\/i2\/segments/,
        answer(segmentOf('i2', corrected)),
      )
      .on('GET', /i2\.csv\.gz$/, bytes(corrected));

    await run();

    const productPage = async () =>
      (await funnelRows()).find(
        (row) =>
          row.territory === 'United States' &&
          row.pageType === 'productPage' &&
          row.date.toISOString().startsWith('2026-09-10'),
      );
    await expect(productPage()).resolves.toMatchObject({
      pageViews: 300,
      uniquePageViews: 260,
    });

    const request = await harness.prisma.storeReportRequest.findFirstOrThrow({
      where: { accessType: 'ONGOING' },
    });
    harness.asc
      .on(
        'GET',
        /\/analyticsReportInstances\/old\/segments/,
        answer(segmentOf('old', gz)),
      )
      .on('GET', /old\.csv\.gz$/, bytes(gz));
    await asWorkspace(harness.app, async () => {
      const connection = await harness.app
        .get(StoreConnectionService)
        .open('APP_STORE');
      await harness.app.get(StoreReportApplier).apply(connection!.api, {
        requestId: request.id,
        appId,
        variant: 'standard',
        instance: {
          id: 'old',
          granularity: 'DAILY',
          processingDate: '2026-09-11',
        },
      });
    });
    await expect(productPage()).resolves.toMatchObject({ pageViews: 300 });
    await expect(
      harness.prisma.storeReportRequest.findUniqueOrThrow({
        where: { id: request.id },
      }),
    ).resolves.toMatchObject({
      lastProcessingDate: new Date('2026-09-13T00:00:00.000Z'),
    });
  });

  it('reports a key that may download but not request reports', async () => {
    scriptApple();
    harness.asc.on(
      'POST',
      /^\/v1\/analyticsReportRequests$/,
      refusal(403, 'FORBIDDEN_ERROR'),
    );

    await run();

    const state = (await owner.get('/store-connections').expect(200))
      .body as StoreConnectionState;
    expect(state.connections[0]).toMatchObject({
      status: 'active',
      reportAccess: 'readOnly',
      lastError: ADMIN_KEY_NEEDED,
    });
    expect(state.connections[0].apps[0].state).toBe('forbidden');
  });

  it('marks the connection rejected when apple refuses the key mid run, and keeps the rows', async () => {
    scriptApple();
    await run();
    harness.asc.on(
      'GET',
      /\/analyticsReports\/ongoing-standard\/instances/,
      refusal(403, 'FORBIDDEN_ERROR'),
    );

    await expect(run()).rejects.toBeInstanceOf(UnrecoverableError);

    const connection = await harness.prisma.storeConnection.findFirstOrThrow();
    expect(connection.status).toBe('rejected');
    await expect(funnelRows()).resolves.toHaveLength(7);
  });

  it('keeps the rows of one workspace out of another', async () => {
    scriptApple();
    await run();

    const scoped = harness.app.get(PrismaService);

    await expect(
      asWorkspace(harness.app, () => scoped.storeFunnelDay.count()),
    ).resolves.toBe(7);
    await expect(
      asWorkspace(
        harness.app,
        () => scoped.storeFunnelDay.count(),
        OTHER_WORKSPACE,
      ),
    ).resolves.toBe(0);
  });

  it('reads the detailed report beside the standard one into product page rows', async () => {
    scriptApple();
    const detailed = gzipSync(
      readFileSync(
        join(
          __dirname,
          '..',
          'src',
          'store-connect',
          'fixtures',
          'asc',
          'discovery-detailed.tsv',
        ),
      ),
    );
    harness.asc
      .on(
        'GET',
        /\/analyticsReportRequests\/ongoing\/reports/,
        answer({
          data: [
            ...report('ongoing').data,
            {
              type: 'analyticsReports',
              id: 'ongoing-detailed',
              attributes: {
                name: 'App Store Discovery and Engagement Detailed',
                category: 'APP_STORE_ENGAGEMENT',
              },
            },
          ],
        }),
      )
      .on(
        'GET',
        /\/analyticsReports\/ongoing-detailed\/instances/,
        answer(instances(['d1', '2026-09-12'])),
      )
      .on(
        'GET',
        /\/analyticsReportInstances\/d1\/segments/,
        answer(segmentOf('d1', detailed)),
      )
      .on('GET', /d1\.csv\.gz$/, bytes(detailed));

    const summary = await run();

    expect(summary).toMatchObject({ instances: 2 });
    const pages = await harness.prisma.storeFunnelPageDay.findMany({
      where: { appId },
      orderBy: { pageTitle: 'asc' },
    });
    expect(
      pages.map((page) => [page.pageTitle, page.uniqueImpressions, page.gets]),
    ).toEqual([
      ['Summer sale', 350, 7],
      ['default product page', 950, 40],
    ]);
    const request = await harness.prisma.storeReportRequest.findFirstOrThrow({
      where: { accessType: 'ONGOING' },
    });
    expect(request).toMatchObject({
      reportId: 'ongoing-standard',
      detailedReportId: 'ongoing-detailed',
      detailedLastProcessingDate: new Date('2026-09-12T00:00:00.000Z'),
    });
    await expect(funnelRows()).resolves.toHaveLength(7);
  });
});
