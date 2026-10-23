import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { UnrecoverableError } from 'bullmq';
import type { WorkspaceContext } from '../../common/tenancy/workspace-context';
import type { PrismaService } from '../../prisma/prisma.service';
import type { StoreConnectionService } from '../store-connection.service';
import {
  GcsBucketError,
  GcsRateLimitedError,
  GcsRejectedError,
  GcsTokenRefusedError,
  PLAY_REPORT_MAX_BYTES,
  type GcsObject,
} from './gcs-api';
import {
  importedMonths,
  PLAY_PARTIAL_SYNC,
  PlayReportSync,
} from './play-report-sync.service';

const PACKAGE = 'com.example.habits';
const NOW = new Date('2026-10-05T03:00:00.000Z');
const PREFIX = 'stats/store_performance/store_performance_';

const fixture = (name: string): Buffer =>
  readFileSync(join(__dirname, '..', 'fixtures', 'play', name));

const FILES: Record<string, Buffer> = {
  country: fixture(`store_performance_${PACKAGE}_202609_country.csv`),
  traffic_source: fixture(
    `store_performance_${PACKAGE}_202609_traffic_source.csv`,
  ),
};

const object = (
  month: string,
  breakdown: string,
  generation = '1',
): GcsObject => ({
  name: `${PREFIX}${PACKAGE}_${month}_${breakdown}.csv`,
  size: 100,
  md5Hash: null,
  generation,
  updated: '2026-10-03T08:00:00.000Z',
});

function harness(objects: GcsObject[]) {
  const instances = new Map<string, { id: string; appliedAt: Date | null }>();
  const tx = {
    storeReportInstance: {
      upsert: jest.fn(
        ({ create }: { create: { remoteId: string; raw: Buffer } }) => {
          const row = { id: `inst_${instances.size + 1}`, appliedAt: null };
          instances.set(create.remoteId, row);
          return Promise.resolve(row);
        },
      ),
      update: jest.fn(({ where }: { where: { id: string } }) => {
        for (const row of instances.values()) {
          if (row.id === where.id) row.appliedAt = new Date();
        }
        return Promise.resolve({});
      }),
    },
    storeFunnelDay: {
      deleteMany: jest.fn(() => Promise.resolve({ count: 0 })),
    },
    storeFunnelSearchTerm: {
      deleteMany: jest.fn(() => Promise.resolve({ count: 0 })),
      createMany: jest.fn(() => Promise.resolve({ count: 0 })),
    },
    storeReportRequest: {
      updateMany: jest.fn(() => Promise.resolve({ count: 1 })),
    },
    $executeRaw: jest.fn(() => Promise.resolve(1)),
  };
  const prisma = {
    withTransaction: jest.fn((run: (client: typeof tx) => Promise<unknown>) =>
      run(tx),
    ),
    app: {
      findMany: jest.fn(() =>
        Promise.resolve([
          { id: 'app_play', storeAppId: PACKAGE },
          { id: 'app_other', storeAppId: 'com.example.other' },
        ]),
      ),
    },
    storeReportRequest: {
      update: jest.fn(() => Promise.resolve({})),
      upsert: jest.fn(
        ({ where }: { where: { appId_accessType: { appId: string } } }) =>
          Promise.resolve({ id: `req_${where.appId_accessType.appId}` }),
      ),
    },
    storeReportInstance: {
      findUnique: jest.fn(
        ({ where }: { where: { requestId_remoteId: { remoteId: string } } }) =>
          Promise.resolve(
            instances.get(where.requestId_remoteId.remoteId) ?? null,
          ),
      ),
    },
  };
  const api = {
    bucket: 'pubsite_prod_rev_1',
    account: { kind: 'key', email: 'reports@x.iam.gserviceaccount.com' },
    verify: jest.fn(() => Promise.resolve()),
    listStorePerformance: jest.fn((packageName: string) =>
      Promise.resolve(
        objects.filter((each) => each.name.includes(`_${packageName}_`)),
      ),
    ),
    download: jest.fn((name: string) =>
      Promise.resolve(
        FILES[name.endsWith('_country.csv') ? 'country' : 'traffic_source'],
      ),
    ),
  };
  const connections = {
    openPlay: jest.fn(() =>
      Promise.resolve({
        id: 'conn_play',
        status: 'active',
        reportAccess: 'admin',
        lastError: null,
        api,
      }),
    ),
    markSynced: jest.fn(() => Promise.resolve()),
    markRejected: jest.fn(() => Promise.resolve()),
  };
  const workspace = { require: jest.fn(() => 'ws_1') };
  const service = new PlayReportSync(
    prisma as unknown as PrismaService,
    workspace as unknown as WorkspaceContext,
    connections as unknown as StoreConnectionService,
  );
  return { service, prisma, tx, api, connections };
}

const twoMonths = [
  object('202610', 'country'),
  object('202610', 'traffic_source'),
  object('202609', 'country'),
  object('202609', 'traffic_source'),
  object('202608', 'country'),
];

describe('importedMonths', () => {
  it('names the current and the previous month, across a year end', () => {
    expect(importedMonths(new Date('2026-01-10T00:00:00.000Z'))).toEqual([
      { file: '202601', date: '2026-01-01' },
      { file: '202512', date: '2025-12-01' },
    ]);
  });
});

describe('PlayReportSync', () => {
  it('imports the two months of files', async () => {
    const { service, api } = harness(twoMonths);

    const summary = await service.run(NOW);

    expect(api.download.mock.calls.map(([name]) => name).sort()).toEqual(
      twoMonths
        .slice(0, 4)
        .map((each) => each.name)
        .sort(),
    );
    expect(summary).toMatchObject({ apps: 2, instances: 4, unchanged: 0 });
  });

  it('downloads only objects whose generation changed', async () => {
    const { service, api } = harness(twoMonths);
    await service.run(NOW);
    api.download.mockClear();
    api.listStorePerformance.mockResolvedValueOnce([
      ...twoMonths.slice(0, 3),
      object('202609', 'traffic_source', '2'),
    ]);

    const summary = await service.run(NOW);

    expect(api.download.mock.calls.map(([name]) => name)).toEqual([
      object('202609', 'traffic_source').name,
    ]);
    expect(summary).toMatchObject({ instances: 1, unchanged: 3 });
  });

  it('writes country rows and traffic rows under the two sentinels', async () => {
    const { service, tx } = harness([
      object('202609', 'country'),
      object('202609', 'traffic_source'),
    ]);

    await service.run(NOW);

    const statements = tx.$executeRaw.mock.calls.map(
      ([sql]) => (sql as { values: unknown[] }).values,
    );
    const [countryValues, trafficValues] = statements;
    expect(countryValues).toEqual(
      expect.arrayContaining(['us', 'de', 'all', 'productPage']),
    );
    expect(countryValues).not.toContain('search');
    expect(trafficValues).toEqual(
      expect.arrayContaining(['all', null, 'search', 'browse', 'referrer']),
    );
  });

  it("replaces the month's rows of the breakdown a newer file brings", async () => {
    const { service, tx } = harness([
      object('202609', 'country'),
      object('202609', 'traffic_source'),
    ]);

    await service.run(NOW);

    const month = {
      gte: new Date('2026-09-01T00:00:00.000Z'),
      lt: new Date('2026-10-01T00:00:00.000Z'),
    };
    expect(tx.storeFunnelDay.deleteMany).toHaveBeenCalledWith({
      where: {
        appId: 'app_play',
        date: month,
        sourceType: 'all',
        NOT: { territory: 'all' },
      },
    });
    expect(tx.storeFunnelDay.deleteMany).toHaveBeenCalledWith({
      where: { appId: 'app_play', date: month, territory: 'all' },
    });
  });

  it("replaces the month's search terms", async () => {
    const { service, tx } = harness([object('202609', 'traffic_source', '7')]);

    await service.run(NOW);

    expect(tx.storeFunnelSearchTerm.deleteMany).toHaveBeenCalledWith({
      where: {
        appId: 'app_play',
        month: new Date('2026-09-01T00:00:00.000Z'),
      },
    });
    expect(tx.storeFunnelSearchTerm.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          workspaceId: 'ws_1',
          term: 'habit tracker',
          normalized: 'habit tracker',
          visitors: 1020,
          acquisitions: 65,
          generation: '7',
        }),
        expect.objectContaining({
          term: 'Habit  Tracker',
          normalized: 'habit tracker',
          visitors: 10,
          acquisitions: 1,
        }),
      ],
    });
  });

  it('marks an app without files unmatched and the connection synced', async () => {
    const { service, prisma, connections } = harness(twoMonths);

    await service.run(NOW);

    expect(prisma.storeReportRequest.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          appId: 'app_other',
          state: 'unmatched',
        }) as unknown,
      }),
    );
    expect(prisma.storeReportRequest.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          appId: 'app_play',
          state: 'requested',
          remoteId: PACKAGE,
        }) as unknown,
      }),
    );
    expect(connections.markSynced).toHaveBeenCalledWith(
      'GOOGLE_PLAY',
      'admin',
      null,
    );
  });

  it('marks the connection rejected on a refused account or a missing bucket', async () => {
    for (const [error, reason] of [
      [
        new GcsRejectedError('no', 403),
        'Google refused reports@x.iam.gserviceaccount.com access',
      ],
      [
        new GcsTokenRefusedError('no', 400),
        'Google refused the key of reports@x.iam.gserviceaccount.com',
      ],
      [new GcsBucketError('no', 404), 'pubsite_prod_rev_1'],
    ] as const) {
      const { service, api, connections } = harness(twoMonths);
      api.verify.mockRejectedValueOnce(error);

      await expect(service.run(NOW)).rejects.toBeInstanceOf(UnrecoverableError);
      expect(connections.markRejected).toHaveBeenCalledWith(
        'GOOGLE_PLAY',
        expect.stringContaining(reason),
      );
    }
  });

  it('keeps the connection active and reports a rate limit', async () => {
    const { service, api, connections } = harness(twoMonths);
    api.verify.mockRejectedValueOnce(new GcsRateLimitedError('slow', 429));

    await expect(service.run(NOW)).resolves.toMatchObject({
      rateLimited: true,
    });
    expect(connections.markRejected).not.toHaveBeenCalled();
    expect(connections.markSynced).toHaveBeenCalled();
  });

  it('skips a file larger than the ceiling without downloading it, and says so', async () => {
    const { service, api, connections } = harness([
      { ...object('202609', 'country'), size: PLAY_REPORT_MAX_BYTES + 1 },
      object('202609', 'traffic_source'),
    ]);

    const summary = await service.run(NOW);

    expect(api.download.mock.calls.map(([name]) => name)).toEqual([
      object('202609', 'traffic_source').name,
    ]);
    expect(summary).toMatchObject({ instances: 1, failed: 1 });
    expect(connections.markSynced).toHaveBeenCalledWith(
      'GOOGLE_PLAY',
      'admin',
      PLAY_PARTIAL_SYNC,
    );
  });

  it('keeps importing the other files when one cannot be read, and says so', async () => {
    const { service, api, connections } = harness([
      object('202609', 'country'),
      object('202609', 'traffic_source'),
    ]);
    api.download.mockImplementation((name: string) =>
      Promise.resolve(
        name.endsWith('_country.csv')
          ? Buffer.from('Day,Visitors\n2026-09-01,4\n')
          : FILES.traffic_source,
      ),
    );

    const summary = await service.run(NOW);

    expect(summary).toMatchObject({ instances: 1, failed: 1 });
    expect(connections.markRejected).not.toHaveBeenCalled();
    expect(connections.markSynced).toHaveBeenCalledWith(
      'GOOGLE_PLAY',
      'admin',
      PLAY_PARTIAL_SYNC,
    );
  });

  it('marks one app forbidden when google refuses its file, and keeps the connection', async () => {
    const { service, api, prisma, connections } = harness([
      object('202609', 'country'),
      object('202609', 'traffic_source'),
    ]);
    api.download.mockRejectedValue(new GcsRejectedError('no', 403));

    await expect(service.run(NOW)).resolves.not.toBeNull();

    expect(prisma.storeReportRequest.update).toHaveBeenCalledWith({
      where: { id: 'req_app_play' },
      data: { state: 'forbidden' },
    });
    expect(api.download).toHaveBeenCalledTimes(1);
    expect(connections.markRejected).not.toHaveBeenCalled();
  });

  it('marks an app forbidden when google refuses to list its files', async () => {
    const { service, api, prisma, connections } = harness(twoMonths);
    api.listStorePerformance.mockImplementation((packageName: string) =>
      packageName === PACKAGE
        ? Promise.reject(new GcsRejectedError('no', 403))
        : Promise.resolve([]),
    );

    await service.run(NOW);

    expect(prisma.storeReportRequest.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          appId: 'app_play',
          state: 'forbidden',
        }) as unknown,
      }),
    );
    expect(connections.markRejected).not.toHaveBeenCalled();
  });

  it.each(['listing', 'download'] as const)(
    'rejects the connection when google refuses the token during a %s',
    async (step) => {
      const { service, api, prisma, connections } = harness(twoMonths);
      const refused = new GcsTokenRefusedError('no', 400, 'invalid_grant');
      if (step === 'listing') {
        api.listStorePerformance.mockRejectedValue(refused);
      } else {
        api.download.mockRejectedValue(refused);
      }

      await expect(service.run(NOW)).rejects.toBeInstanceOf(UnrecoverableError);

      expect(connections.markRejected).toHaveBeenCalledWith(
        'GOOGLE_PLAY',
        expect.stringContaining('Google refused the key of'),
      );
      expect(prisma.storeReportRequest.update).not.toHaveBeenCalledWith(
        expect.objectContaining({ data: { state: 'forbidden' } }),
      );
    },
  );

  it('skips a file that vanished between listing and download', async () => {
    const { service, api, connections } = harness([
      object('202609', 'country'),
    ]);
    api.download.mockRejectedValue(new GcsBucketError('gone', 404));

    await expect(service.run(NOW)).resolves.toMatchObject({ instances: 0 });
    expect(connections.markRejected).not.toHaveBeenCalled();
  });

  it('does nothing without an active connection', async () => {
    const { service, connections, api } = harness(twoMonths);
    connections.openPlay.mockResolvedValueOnce(null as never);

    await expect(service.run(NOW)).resolves.toBeNull();
    expect(api.listStorePerformance).not.toHaveBeenCalled();
  });
});
