import './helpers/enable-store-connect';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { Store } from '@prisma/client';
import type {
  AppLocalizationsResult,
  StoreConnectionState,
} from '@asobeast/shared';
import { UnrecoverableError } from 'bullmq';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import type { AscRequest } from '../src/store-connect/asc-transport';
import { PrismaService } from '../src/prisma/prisma.service';
import { StoreConnectionService } from '../src/store-connect/store-connection.service';
import { StoreReportApplier } from '../src/store-connect/store-report-applier';
import { pivotDiscoveryReport } from '../src/store-connect/discovery-report';
import { funnelUpserts } from '../src/store-connect/store-funnel-rows';
import {
  ADMIN_KEY_NEEDED,
  PARTIAL_SYNC,
} from '../src/store-connect/asc-report-sync.service';
import { importedMonths } from '../src/store-connect/play/play-report-sync.service';
import { StoreReportSyncService } from '../src/store-connect/store-report-sync.service';
import { PartialSyncRetryError } from '../src/store-connect/store-sync-summary';
import { ownerAgent } from './helpers/session';
import {
  answer,
  bytes,
  CONNECTION_REQUEST,
  gcsAnswer,
  gcsBytes,
  PLAY_CONNECTION_REQUEST,
  refusal,
  startStoreConnectApp,
  type StoreConnectHarness,
} from './helpers/store-connect-harness';
import { migrationSql } from './helpers/migration-sql';
import { asWorkspace } from './helpers/tenancy';
import {
  clearRateLimitCounters,
  obliterateQueues,
  pauseQueues,
} from './obliterate-queues';

const STORE_APP_ID = '1476097583';
const SECOND_STORE_APP_ID = '839333328';
const SECOND_LISTING = new RegExp(
  `/analyticsReports/ongoing-${SECOND_STORE_APP_ID}-standard/instances`,
);
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

const HELD_PAST_DEFAULT_TIMEOUT_MS = 5_500;
const WAIT_ATTEMPTS = 250;
const WAIT_INTERVAL_MS = 20;

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

  const run = (finalAttempt = true) =>
    asWorkspace(harness.app, () =>
      harness.app.get(StoreReportSyncService).run('APP_STORE', finalAttempt),
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

  const scriptTwoApps = () => {
    const created: { type: string; id: string; attributes: object }[] = [];
    const storeAppOf = (path: string) => /\/apps\/(\d+)\//.exec(path)?.[1];
    const segmentPath = /\/analyticsReportInstances\/([^/]+)\/segments/;
    harness.asc
      .on('GET', /\/apps\/\d+\/analyticsReportRequests\?/, (request) =>
        answer({
          data: created.filter((each) =>
            each.id.endsWith(`-${storeAppOf(request.path)}`),
          ),
        }),
      )
      .on(
        'GET',
        /^\/v1\/apps\?filter/,
        answer({
          data: [
            { type: 'apps', id: STORE_APP_ID, attributes: { name: 'Focus' } },
            {
              type: 'apps',
              id: SECOND_STORE_APP_ID,
              attributes: { name: 'Drift' },
            },
          ],
        }),
      )
      .on('POST', /^\/v1\/analyticsReportRequests$/, (request) => {
        const { data } = request.body as {
          data: {
            attributes: { accessType: string };
            relationships: { app: { data: { id: string } } };
          };
        };
        const { accessType } = data.attributes;
        const kind = accessType === 'ONGOING' ? 'ongoing' : 'snapshot';
        const placed = {
          type: 'analyticsReportRequests',
          id: `${kind}-${data.relationships.app.data.id}`,
          attributes: { accessType, stoppedDueToInactivity: false },
        };
        created.push(placed);
        return answer({ data: placed }, 201);
      })
      .on('GET', /\/analyticsReportRequests\/[^/]+\/reports/, (request) =>
        answer(
          report(
            /analyticsReportRequests\/([^/]+)\//.exec(request.path)?.[1] ?? '',
          ),
        ),
      )
      .on(
        'GET',
        /\/analyticsReports\/ongoing-\d+-standard\/instances/,
        (request) =>
          answer(
            instances([
              `i-${/ongoing-(\d+)-standard/.exec(request.path)?.[1]}`,
              '2026-09-12',
            ]),
          ),
      )
      .on('GET', segmentPath, (request) => {
        const id = segmentPath.exec(request.path)?.[1] ?? '';
        return answer(segmentOf(id, gz));
      })
      .on('GET', /i-\d+\.csv\.gz$/, bytes(gz));
  };

  const createSecondApp = () =>
    harness.prisma.app.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store: Store.APP_STORE,
        storeAppId: SECOND_STORE_APP_ID,
        country: 'us',
        name: 'Drift',
      },
    });

  const failSecondListing = () =>
    harness.asc.on(
      'GET',
      SECOND_LISTING,
      answer({ errors: [{ code: 'UNEXPECTED_ERROR', detail: 'down' }] }, 500),
    );

  const funnelRows = () =>
    harness.prisma.storeFunnelDay.findMany({
      where: { appId },
      orderBy: [{ date: 'asc' }, { territory: 'asc' }, { pageType: 'asc' }],
    });

  beforeAll(async () => {
    harness = await startStoreConnectApp();
    await pauseQueues(harness.app);
    await harness.prisma.workspace.upsert({
      where: { id: OTHER_WORKSPACE },
      update: {},
      create: { id: OTHER_WORKSPACE, name: 'Other' },
    });
    owner = await ownerAgent(harness.app);
  }, 60_000);

  beforeEach(async () => {
    harness.asc.reset();
    harness.gcs.reset();
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
    await harness.prisma.storeConnection.deleteMany({});
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

  it('imports the keyword fields of a following app and hands dropped localizations back', async () => {
    await harness.prisma.keywordFieldSync.create({
      data: { appId, workspaceId: DEFAULT_WORKSPACE_ID },
    });
    await harness.prisma.appLocalization.create({
      data: {
        appId,
        workspaceId: DEFAULT_WORKSPACE_ID,
        localization: 'de',
        origin: 'manual',
      },
    });
    await harness.prisma.keywordField.create({
      data: {
        appId,
        workspaceId: DEFAULT_WORKSPACE_ID,
        localization: 'de',
        phrases: ['fokus'],
      },
    });
    harness.asc
      .on('GET', /\/analyticsReportRequests\?/, () => answer({ data: [] }))
      .on('GET', /\/appStoreVersions\?/, () =>
        answer({
          data: [
            {
              type: 'appStoreVersions',
              id: 'v1',
              attributes: {
                versionString: '2.1',
                createdDate: '2026-10-01T00:00:00.000Z',
              },
            },
          ],
        }),
      )
      .on('GET', /\/appStoreVersionLocalizations\?/, () =>
        answer({
          data: [
            {
              type: 'appStoreVersionLocalizations',
              id: 'l1',
              attributes: { locale: 'en-US', keywords: 'focus,timer' },
            },
          ],
        }),
      );

    const summary = await run();

    expect(summary).toMatchObject({ fields: 1, fieldsChanged: 2 });
    const field = await harness.prisma.keywordField.findFirstOrThrow({
      where: { localization: 'en-US' },
    });
    expect(field.phrases).toEqual(['focus', 'timer']);
    const [sync] = await harness.prisma.keywordFieldSync.findMany();
    expect(sync).toMatchObject({ version: '2.1', lastError: null });
    await expect(
      harness.prisma.keywordField.count({ where: { localization: 'de' } }),
    ).resolves.toBe(0);
    await expect(
      harness.prisma.appLocalization.count({ where: { localization: 'de' } }),
    ).resolves.toBe(0);
    const read = await owner.get(`/apps/${appId}/localizations`).expect(200);
    expect((read.body as AppLocalizationsResult).storeImport).toBe('following');
    expect((read.body as AppLocalizationsResult).storeManaged).toBe(true);
  });

  describe('an answer apple sends that cannot be read', () => {
    const UNREADABLE =
      'App Store Connect answered with something AsoBeast could not read';

    const localization = (locale: string, keywords: string) => ({
      type: 'appStoreVersionLocalizations',
      id: `l-${locale}`,
      attributes: { locale, keywords },
    });

    const importFields = async () => {
      await harness.prisma.keywordFieldSync.create({
        data: { appId, workspaceId: DEFAULT_WORKSPACE_ID },
      });
      harness.asc
        .on('GET', /\/analyticsReportRequests\?/, () => answer({ data: [] }))
        .on('GET', /\/appStoreVersions\?/, () =>
          answer({
            data: [
              {
                type: 'appStoreVersions',
                id: 'v1',
                attributes: {
                  versionString: '2.0.0',
                  createdDate: '2026-10-01T00:00:00.000Z',
                },
              },
            ],
          }),
        )
        .on('GET', /\/appStoreVersionLocalizations\?/, () =>
          answer({
            data: [
              localization('en-US', 'camera,raw photo'),
              localization('de-DE', 'kamera'),
            ],
          }),
        );
      await run();
      return storedImport();
    };

    const storedImport = async () => ({
      fields: await harness.prisma.keywordField.findMany({
        where: { appId },
        select: { localization: true, phrases: true },
        orderBy: { localization: 'asc' },
      }),
      localizations: await harness.prisma.appLocalization.findMany({
        where: { appId },
        select: { localization: true, origin: true },
        orderBy: { localization: 'asc' },
      }),
      keywords: await harness.prisma.trackedKeyword.findMany({
        where: { appId },
        select: { active: true, keyword: { select: { text: true } } },
        orderBy: { keyword: { text: 'asc' } },
      }),
      sync: await harness.prisma.keywordFieldSync.findFirstOrThrow({
        where: { appId },
        select: { version: true, syncedAt: true, lastError: true },
      }),
    });

    it('keeps the imported fields when the localizations cannot be read', async () => {
      const before = await importFields();
      expect(before.fields).toHaveLength(2);
      expect(before.keywords.map(({ active }) => active)).not.toContain(false);

      harness.asc.on('GET', /\/appStoreVersionLocalizations\?/, answer(null));
      const summary = await run();

      expect(summary).toMatchObject({ fieldsChanged: 0 });
      const after = await storedImport();
      expect(after.fields).toEqual(before.fields);
      expect(after.localizations).toEqual(before.localizations);
      expect(after.keywords).toEqual(before.keywords);
      expect(after.sync).toEqual({ ...before.sync, lastError: UNREADABLE });
    });

    it('says the versions could not be read instead of naming no live version', async () => {
      const before = await importFields();

      harness.asc.on('GET', /\/appStoreVersions\?/, answer(null));
      await run();

      const after = await storedImport();
      expect(after.fields).toEqual(before.fields);
      expect(after.sync).toEqual({ ...before.sync, lastError: UNREADABLE });
    });

    it('keeps an ongoing report request when the request listing cannot be read', async () => {
      scriptApple();
      await run();
      const requested = await harness.prisma.storeReportRequest.findMany({
        select: { accessType: true, state: true, remoteId: true },
        orderBy: { accessType: 'asc' },
      });
      expect(requested.length).toBeGreaterThan(0);

      const posted = paths('POST').length;
      harness.asc.on('GET', /\/analyticsReportRequests\?/, answer(null));
      await expect(run(false)).rejects.toBeInstanceOf(PartialSyncRetryError);

      expect(paths('POST')).toHaveLength(posted);

      await expect(
        harness.prisma.storeReportRequest.findMany({
          select: { accessType: true, state: true, remoteId: true },
          orderBy: { accessType: 'asc' },
        }),
      ).resolves.toEqual(requested);
    });
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
        .openAppStore();
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

  const waitForFunnelUpsertBlockedBy = async (holder: number) => {
    for (let attempt = 0; attempt < WAIT_ATTEMPTS; attempt += 1) {
      const [{ waiting }] = await harness.prisma.$queryRaw<
        { waiting: bigint }[]
      >`
        SELECT COUNT(*) AS waiting
        FROM pg_stat_activity
        WHERE datname = current_database()
          AND ${holder}::int = ANY(pg_blocking_pids(pid))
          AND query LIKE '%INSERT INTO "StoreFunnelDay"%'
      `;
      if (waiting > 0n) return;
      await new Promise((resolve) => setTimeout(resolve, WAIT_INTERVAL_MS));
    }
    throw new Error('The funnel upsert never waited on the held row');
  };

  it('applies a report whose transaction outlasts the default five seconds', async () => {
    scriptApple();
    const rows = await pivotDiscoveryReport(gz, '2026-09-12');
    const [held] = funnelUpserts(DEFAULT_WORKSPACE_ID, appId, rows.slice(0, 1));

    const { summary } = await harness.prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw(held);
        const [{ holder }] = await tx.$queryRaw<{ holder: number }[]>`
          SELECT pg_backend_pid() AS holder
        `;
        const pending = run();
        pending.catch(() => undefined);
        await waitForFunnelUpsertBlockedBy(holder);
        await new Promise((resolve) =>
          setTimeout(resolve, HELD_PAST_DEFAULT_TIMEOUT_MS),
        );
        return { summary: pending };
      },
      { timeout: 30_000 },
    );

    await expect(summary).resolves.toMatchObject({
      instances: 1,
      rows: rows.length,
    });
    await expect(
      harness.prisma.storeFunnelDay.count({ where: { appId } }),
    ).resolves.toBe(rows.length);
    await expect(
      harness.prisma.storeReportRequest.findFirstOrThrow({
        where: { accessType: 'ONGOING' },
      }),
    ).resolves.toMatchObject({
      lastProcessingDate: new Date('2026-09-12T00:00:00.000Z'),
    });
  }, 60_000);

  it('downloads the other apps when apple fails the standard listing of one app, and says so', async () => {
    const second = await createSecondApp();
    scriptTwoApps();
    failSecondListing();

    const summary = await run();

    expect(summary).toMatchObject({
      instances: 1,
      failed: 1,
      rateLimited: false,
    });
    await expect(funnelRows()).resolves.toHaveLength(7);
    await expect(
      harness.prisma.storeFunnelDay.count({ where: { appId: second.id } }),
    ).resolves.toBe(0);
    const state = (await owner.get('/store-connections').expect(200))
      .body as StoreConnectionState;
    expect(state.connections[0].lastError).toBe(PARTIAL_SYNC);
    expect(state.connections[0].lastSyncedAt).not.toBeNull();
  });

  it('tries a passing apple error again before it warns about it', async () => {
    const second = await createSecondApp();
    scriptTwoApps();
    failSecondListing();

    await expect(run(false)).rejects.toBeInstanceOf(PartialSyncRetryError);
    await expect(funnelRows()).resolves.toHaveLength(7);
    const retrying = (await owner.get('/store-connections').expect(200))
      .body as StoreConnectionState;
    expect(retrying.connections[0].lastError).toBeNull();

    harness.asc.on(
      'GET',
      SECOND_LISTING,
      answer(instances([`i-${SECOND_STORE_APP_ID}`, '2026-09-12'])),
    );
    await expect(run()).resolves.toMatchObject({ instances: 1, failed: 0 });

    await expect(
      harness.prisma.storeFunnelDay.count({ where: { appId: second.id } }),
    ).resolves.toBe(7);
    const settled = (await owner.get('/store-connections').expect(200))
      .body as StoreConnectionState;
    expect(settled.connections[0].lastError).toBeNull();
  });

  it('places a request again after apple deleted it, and keeps syncing meanwhile', async () => {
    scriptApple();
    await run();
    harness.asc
      .on('GET', /\/analyticsReportRequests\?/, answer({ data: [] }))
      .on(
        'GET',
        /\/analyticsReports\/snapshot-standard\/instances/,
        answer(
          {
            errors: [
              {
                code: 'NOT_FOUND',
                detail:
                  "There is no resource of type 'analyticsReports' with id 'snapshot-standard'",
              },
            ],
          },
          404,
        ),
      );
    const snapshotRow = () =>
      harness.prisma.storeReportRequest.findFirstOrThrow({
        where: { appId, accessType: 'ONE_TIME_SNAPSHOT' },
      });

    const deleted = await run();

    expect(deleted).toMatchObject({ failed: 1, rateLimited: false });
    await expect(snapshotRow()).resolves.toMatchObject({
      state: 'stopped',
      remoteId: null,
      reportId: null,
    });

    harness.asc.on('POST', /^\/v1\/analyticsReportRequests$/, (request) => {
      const { accessType } = (
        request.body as { data: { attributes: { accessType: string } } }
      ).data.attributes;
      return answer(
        {
          data: {
            type: 'analyticsReportRequests',
            id: `${accessType}-again`,
            attributes: { accessType, stoppedDueToInactivity: false },
          },
        },
        201,
      );
    });
    harness.asc.requests.length = 0;
    await expect(run()).resolves.not.toBeNull();

    expect(paths('POST')).toContain('/v1/analyticsReportRequests');
    await expect(snapshotRow()).resolves.toMatchObject({
      state: 'requested',
      remoteId: 'ONE_TIME_SNAPSHOT-again',
    });
    const connection = await harness.prisma.storeConnection.findFirstOrThrow();
    expect(connection.status).toBe('active');
    await expect(funnelRows()).resolves.toHaveLength(7);
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
      pages.map((page) => [page.pageTitle, page.pageViews, page.gets]),
    ).toEqual([
      ['Default product page', 312, 40],
      ['Summer sale', 100, 7],
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

  it('imports the monthly play files into funnel rows and search terms, once per generation', async () => {
    const PACKAGE = 'com.example.habits';
    const [current, previous] = importedMonths(new Date());
    const play = await harness.prisma.app.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store: Store.GOOGLE_PLAY,
        storeAppId: PACKAGE,
        country: 'us',
        name: 'Habits',
      },
    });
    await owner
      .put('/store-connections/GOOGLE_PLAY')
      .send(PLAY_CONNECTION_REQUEST)
      .expect(200);
    const playFile = (breakdown: string): Buffer => {
      const text = readFileSync(
        join(
          __dirname,
          '..',
          'src',
          'store-connect',
          'fixtures',
          'play',
          `store_performance_${PACKAGE}_202609_${breakdown}.csv`,
        ),
      )
        .subarray(2)
        .toString('utf16le')
        .replaceAll('2026-09-', `${previous.date.slice(0, 8)}`);
      return Buffer.concat([
        Buffer.from([0xff, 0xfe]),
        Buffer.from(text, 'utf16le'),
      ]);
    };
    const name = (month: string, breakdown: string) =>
      `stats/store_performance/store_performance_${PACKAGE}_${month}_${breakdown}.csv`;
    const objects = [
      name(previous.file, 'country'),
      name(previous.file, 'traffic_source'),
      name(current.file, 'country'),
      name('201901', 'country'),
    ].map((object) => ({
      name: object,
      size: '100',
      generation: '1',
      updated: new Date().toISOString(),
    }));
    harness.gcs.reset();
    harness.gcs
      .on('GET', /\/o\?prefix=/, gcsAnswer({ items: objects }))
      .on('GET', /_country\.csv\?alt=media$/, gcsBytes(playFile('country')))
      .on(
        'GET',
        /_traffic_source\.csv\?alt=media$/,
        gcsBytes(playFile('traffic_source')),
      );
    const runPlay = () =>
      asWorkspace(harness.app, () =>
        harness.app.get(StoreReportSyncService).run('GOOGLE_PLAY'),
      );

    await expect(runPlay()).resolves.toMatchObject({
      apps: 1,
      instances: 3,
      unchanged: 0,
    });

    const downloads = harness.gcs.requests
      .filter((each) => each.url.endsWith('?alt=media'))
      .map((each) => decodeURIComponent(each.url.split('/o/')[1]));
    expect(downloads).not.toContain(`${name('201901', 'country')}?alt=media`);
    expect(downloads).toHaveLength(3);
    const rows = await harness.prisma.storeFunnelDay.findMany({
      where: { appId: play.id },
    });
    const byMarket = rows.filter((row) => row.sourceType === 'all');
    const byTraffic = rows.filter((row) => row.territory === 'all');
    expect(new Set(byMarket.map((row) => row.country))).toEqual(
      new Set(['us', 'de']),
    );
    expect(byTraffic.every((row) => row.country === null)).toBe(true);
    expect(new Set(byTraffic.map((row) => row.sourceType))).toEqual(
      new Set(['search', 'browse', 'referrer']),
    );
    expect(
      byMarket.find((row) => row.country === 'de' && row.gets === 1200)
        ?.pageViews,
    ).toBe(3400);
    const terms = await harness.prisma.storeFunnelSearchTerm.findMany({
      where: { appId: play.id },
      orderBy: { term: 'asc' },
    });
    expect(terms.map((term) => [term.term, term.normalized])).toEqual([
      ['Habit  Tracker', 'habit tracker'],
      ['habit tracker', 'habit tracker'],
    ]);
    const instance = await harness.prisma.storeReportInstance.findFirstOrThrow({
      where: { appId: play.id, remoteId: { contains: 'traffic_source' } },
    });
    expect(instance.raw.subarray(0, 2)).toEqual(Buffer.from([0xff, 0xfe]));
    expect(instance.granularity).toBe('MONTHLY');
    const state = (await owner.get('/store-connections').expect(200))
      .body as StoreConnectionState;
    expect(
      state.connections.find((each) => each.store === 'GOOGLE_PLAY')?.apps,
    ).toEqual([
      expect.objectContaining({ appId: play.id, state: 'requested' }),
    ]);

    harness.gcs.requests.length = 0;
    await expect(runPlay()).resolves.toMatchObject({
      instances: 0,
      unchanged: 3,
    });
    expect(
      harness.gcs.requests.filter((each) => each.url.endsWith('?alt=media')),
    ).toEqual([]);
  });

  it('drops the placeholder google writes for visits without a search term from the stored terms', async () => {
    const play = await harness.prisma.app.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store: Store.GOOGLE_PLAY,
        storeAppId: 'com.example.habits',
        country: 'us',
        name: 'Habits',
      },
    });
    const term = (text: string) => ({
      workspaceId: DEFAULT_WORKSPACE_ID,
      appId: play.id,
      month: new Date('2026-09-01T00:00:00.000Z'),
      term: text,
      normalized: text.toLowerCase(),
      visitors: 212,
      acquisitions: 22,
      generation: '1791833155685486',
    });
    await harness.prisma.storeFunnelSearchTerm.createMany({
      data: [term('No search terms specified'), term('geoguess')],
    });

    await harness.prisma.$executeRawUnsafe(
      migrationSql('drop_play_placeholder_search_terms'),
    );

    const terms = await harness.prisma.storeFunnelSearchTerm.findMany({
      where: { appId: play.id },
    });
    expect(terms.map((each) => each.term)).toEqual(['geoguess']);
  });
});
