import { UnrecoverableError } from 'bullmq';
import type { PrismaService } from '../prisma/prisma.service';
import type { AscAnalyticsApi, AscInstance } from './asc-analytics-api';
import {
  AscAgreementError,
  AscRateLimitedError,
  AscRejectedKeyError,
  AscSegmentSizeError,
} from './asc-errors';
import { AGREEMENT_MISSING } from './asc-http-errors';
import type {
  OpenedConnection,
  StoreConnectionService,
} from './store-connection.service';
import type { StoreReportApplier } from './store-report-applier';
import type { StoreReportRequester } from './store-report-requester';
import {
  ADMIN_KEY_NEEDED,
  PARTIAL_SYNC,
  StoreReportSyncService,
} from './store-report-sync.service';
import { DiscoveryHeaderError } from './discovery-report';

const instance = (id: string, processingDate: string): AscInstance => ({
  id,
  granularity: 'DAILY',
  processingDate,
});

function build(status: OpenedConnection['status'] = 'active') {
  const api = {
    discoveryReport: jest.fn().mockResolvedValue({ id: 'report' }),
    dailyInstances: jest.fn((reportId: string) =>
      Promise.resolve(
        reportId === 'snapshot-report'
          ? [instance('s1', '2026-09-01'), instance('s2', '2026-09-03')]
          : [instance('o1', '2026-09-02')],
      ),
    ),
  };
  const connection: OpenedConnection = {
    id: 'conn_1',
    status,
    reportAccess: 'admin',
    lastError: null,
    api: api as unknown as AscAnalyticsApi,
  };
  const connections = {
    open: jest.fn().mockResolvedValue(connection),
    markSynced: jest.fn().mockResolvedValue(undefined),
    markRejected: jest.fn().mockResolvedValue(undefined),
  };
  const requester = {
    ensure: jest.fn().mockResolvedValue({
      apps: 1,
      reportAccess: 'admin',
      forbidden: false,
      failed: 0,
    }),
  };
  const applier = {
    apply: jest.fn().mockResolvedValue({ rows: 4, unresolved: [] }),
  };
  const prisma = {
    storeReportRequest: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'req_snapshot',
          appId: 'app_1',
          accessType: 'ONE_TIME_SNAPSHOT',
          remoteId: 'remote-snapshot',
          reportId: 'snapshot-report',
          lastProcessingDate: null,
        },
        {
          id: 'req_ongoing',
          appId: 'app_1',
          accessType: 'ONGOING',
          remoteId: 'remote-ongoing',
          reportId: null,
          lastProcessingDate: new Date('2026-09-01T00:00:00.000Z'),
        },
      ]),
      update: jest.fn().mockResolvedValue({}),
    },
  };
  const service = new StoreReportSyncService(
    prisma as unknown as PrismaService,
    connections as unknown as StoreConnectionService,
    requester as unknown as StoreReportRequester,
    applier as unknown as StoreReportApplier,
  );
  return { service, api, connections, requester, applier, prisma };
}

const appliedIds = (applier: { apply: jest.Mock }) =>
  applier.apply.mock.calls.map(
    ([, item]: [unknown, { instance: AscInstance }]) => item.instance.id,
  );

describe('StoreReportSyncService', () => {
  it('ends without a connection or with a rejected one', async () => {
    const { service, connections, requester } = build();
    connections.open.mockResolvedValueOnce(null);
    await expect(service.run('APP_STORE')).resolves.toBeNull();

    const rejected = build('rejected');
    await expect(rejected.service.run('APP_STORE')).resolves.toBeNull();
    expect(requester.ensure).not.toHaveBeenCalled();
  });

  it('applies instances in ascending processing date order across the snapshot and the ongoing request', async () => {
    const { service, applier } = build();

    await service.run('APP_STORE');

    expect(appliedIds(applier)).toEqual(['s1', 'o1', 's2']);
  });

  it('finds and remembers the report of a request that has none, and lists instances after the last processing date', async () => {
    const { service, api, prisma } = build();

    await service.run('APP_STORE');

    expect(api.discoveryReport).toHaveBeenCalledWith(
      'remote-ongoing',
      'standard',
    );
    expect(prisma.storeReportRequest.update).toHaveBeenCalledWith({
      where: { id: 'req_ongoing' },
      data: { reportId: 'report' },
    });
    expect(api.dailyInstances).toHaveBeenCalledWith('report', '2026-09-01');
    expect(api.dailyInstances).toHaveBeenCalledWith('snapshot-report', null);
  });

  it('waits while no discovery report exists yet', async () => {
    const { service, api, applier } = build();
    api.discoveryReport.mockResolvedValue(null);

    await service.run('APP_STORE');

    expect(api.dailyInstances).toHaveBeenCalledTimes(1);
    expect(appliedIds(applier)).toEqual(['s1', 's2']);
  });

  it('stops the run after the instance ceiling and leaves the rest for the next run', async () => {
    const { service, applier } = build();
    service.maxInstancesPerRun = 2;

    const summary = await service.run('APP_STORE');

    expect(appliedIds(applier)).toEqual(['s1', 'o1']);
    expect(summary?.instances).toBe(2);
  });

  it('skips the rest of a request after a segment arrives with the wrong size', async () => {
    const { service, applier } = build();
    applier.apply.mockRejectedValueOnce(new AscSegmentSizeError(10, 9));

    const summary = await service.run('APP_STORE');

    expect(appliedIds(applier)).toEqual(['s1', 'o1']);
    expect(summary?.instances).toBe(1);
  });

  it('keeps applying the other requests when one instance cannot be read, and says so', async () => {
    const { service, applier, connections } = build();
    applier.apply.mockRejectedValueOnce(new DiscoveryHeaderError(['Counts']));

    const summary = await service.run('APP_STORE');

    expect(appliedIds(applier)).toEqual(['s1', 'o1']);
    expect(summary).toMatchObject({ instances: 1, failed: 1 });
    expect(connections.markSynced).toHaveBeenCalledWith(
      'APP_STORE',
      'admin',
      PARTIAL_SYNC,
    );
  });

  it('says so when apple failed one of the apps', async () => {
    const { service, requester, connections } = build();
    requester.ensure.mockResolvedValue({
      apps: 2,
      reportAccess: 'admin',
      forbidden: false,
      failed: 1,
    });

    await service.run('APP_STORE');

    expect(connections.markSynced).toHaveBeenCalledWith(
      'APP_STORE',
      'admin',
      PARTIAL_SYNC,
    );
  });

  it('ends the run normally on a rate limit after recording what was applied', async () => {
    const { service, applier, connections } = build();
    applier.apply
      .mockResolvedValueOnce({ rows: 3, unresolved: [] })
      .mockRejectedValueOnce(new AscRateLimitedError('slow', 429, null));

    const summary = await service.run('APP_STORE');

    expect(summary).toMatchObject({ instances: 1, rows: 3, rateLimited: true });
    expect(connections.markSynced).toHaveBeenCalledWith(
      'APP_STORE',
      'admin',
      null,
    );
  });

  it('marks the connection rejected and throws unrecoverable on a rejected key', async () => {
    const { service, requester, connections } = build();
    requester.ensure.mockRejectedValue(
      new AscRejectedKeyError('revoked', 401, 'NOT_AUTHORIZED'),
    );

    await expect(service.run('APP_STORE')).rejects.toBeInstanceOf(
      UnrecoverableError,
    );
    expect(connections.markRejected).toHaveBeenCalledWith(
      'APP_STORE',
      expect.stringContaining('refused this key'),
    );
    expect(connections.markSynced).not.toHaveBeenCalled();
  });

  it('marks the connection rejected with the agreement Apple asks for', async () => {
    const { service, requester, connections } = build();
    requester.ensure.mockRejectedValue(
      new AscAgreementError(
        'agreement',
        403,
        'FORBIDDEN.REQUIRED_AGREEMENTS_MISSING_OR_EXPIRED',
      ),
    );

    await expect(service.run('APP_STORE')).rejects.toBeInstanceOf(
      UnrecoverableError,
    );
    expect(connections.markRejected).toHaveBeenCalledWith(
      'APP_STORE',
      AGREEMENT_MISSING,
    );
  });

  it('marks the connection synced with the access it learned', async () => {
    const { service, requester, connections } = build();
    requester.ensure.mockResolvedValue({
      apps: 1,
      reportAccess: 'readOnly',
      forbidden: true,
    });

    await service.run('APP_STORE');

    expect(connections.markSynced).toHaveBeenCalledWith(
      'APP_STORE',
      'readOnly',
      ADMIN_KEY_NEEDED,
    );
  });

  it('reports every unresolved territory once per run', async () => {
    const { service, applier } = build();
    applier.apply.mockResolvedValue({ rows: 1, unresolved: ['Atlantis'] });

    const summary = await service.run('APP_STORE');

    expect(summary?.unresolved).toEqual(['Atlantis']);
  });

  it('lets any other failure fail the job for a retry', async () => {
    const { service, applier, connections } = build();
    applier.apply.mockRejectedValue(new Error('database down'));

    await expect(service.run('APP_STORE')).rejects.toThrow('database down');
    expect(connections.markSynced).not.toHaveBeenCalled();
  });
});
