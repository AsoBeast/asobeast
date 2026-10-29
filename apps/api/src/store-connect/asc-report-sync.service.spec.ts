import { UnrecoverableError } from 'bullmq';
import type { PrismaService } from '../prisma/prisma.service';
import type { AscAnalyticsApi, AscInstance } from './asc-analytics-api';
import {
  AscAgreementError,
  AscError,
  AscRateLimitedError,
  AscRejectedKeyError,
  AscSegmentSizeError,
  AscUnreachableError,
} from './asc-errors';
import { AGREEMENT_MISSING } from './asc-http-errors';
import type { AscKeywordFieldSync } from './asc-keyword-field-sync.service';
import type {
  OpenedConnection,
  StoreConnectionService,
} from './store-connection.service';
import type { StoreReportApplier } from './store-report-applier';
import type { StoreReportRequester } from './store-report-requester';
import {
  ADMIN_KEY_NEEDED,
  PARTIAL_SYNC,
  AscReportSync,
} from './asc-report-sync.service';
import { DiscoveryHeaderError } from './discovery-report';

const instance = (id: string, processingDate: string): AscInstance => ({
  id,
  granularity: 'DAILY',
  processingDate,
});

function build(status: OpenedConnection['status'] = 'active') {
  const api = {
    discoveryReport: jest.fn((_remoteId: string, variant: string) =>
      Promise.resolve(variant === 'standard' ? { id: 'report' } : null),
    ),
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
    replyAccess: 'unknown',
    lastError: null,
    api: api as unknown as AscAnalyticsApi,
  };
  const connections = {
    openAppStore: jest.fn().mockResolvedValue(connection),
    markSynced: jest.fn().mockResolvedValue(undefined),
    markRejected: jest.fn().mockResolvedValue(undefined),
  };
  const requester = {
    retire: jest.fn().mockResolvedValue(undefined),
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
  const keywordFields = {
    run: jest.fn().mockResolvedValue({ fields: 0, changed: 0 }),
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
          detailedReportId: null,
          detailedLastProcessingDate: null,
        },
        {
          id: 'req_ongoing',
          appId: 'app_1',
          accessType: 'ONGOING',
          remoteId: 'remote-ongoing',
          reportId: null,
          lastProcessingDate: new Date('2026-09-01T00:00:00.000Z'),
          detailedReportId: null,
          detailedLastProcessingDate: null,
        },
      ]),
      update: jest.fn().mockResolvedValue({}),
    },
  };
  const service = new AscReportSync(
    prisma as unknown as PrismaService,
    connections as unknown as StoreConnectionService,
    requester as unknown as StoreReportRequester,
    applier as unknown as StoreReportApplier,
    keywordFields as unknown as AscKeywordFieldSync,
  );
  return {
    service,
    api,
    connections,
    requester,
    applier,
    prisma,
    keywordFields,
  };
}

const appliedIds = (applier: { apply: jest.Mock }) =>
  applier.apply.mock.calls.map(
    ([, item]: [unknown, { instance: AscInstance }]) => item.instance.id,
  );

describe('AscReportSync', () => {
  it('ends without a connection or with a rejected one', async () => {
    const { service, connections, requester } = build();
    connections.openAppStore.mockResolvedValueOnce(null);
    await expect(service.run()).resolves.toBeNull();

    const rejected = build('rejected');
    await expect(rejected.service.run()).resolves.toBeNull();
    expect(requester.ensure).not.toHaveBeenCalled();
  });

  it('applies instances in ascending processing date order across the snapshot and the ongoing request', async () => {
    const { service, applier } = build();

    await service.run();

    expect(appliedIds(applier)).toEqual(['s1', 'o1', 's2']);
  });

  it('finds and remembers the report of a request that has none, and lists instances after the last processing date', async () => {
    const { service, api, prisma } = build();

    await service.run();

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
    api.discoveryReport.mockImplementation(() => Promise.resolve(null));

    await service.run();

    expect(api.dailyInstances).toHaveBeenCalledTimes(1);
    expect(appliedIds(applier)).toEqual(['s1', 's2']);
  });

  it('stops the run after the instance ceiling and leaves the rest for the next run', async () => {
    const { service, applier } = build();
    service.maxInstancesPerRun = 2;

    const summary = await service.run();

    expect(appliedIds(applier)).toEqual(['s1', 'o1']);
    expect(summary?.instances).toBe(2);
  });

  it('skips the rest of a request after a segment arrives with the wrong size', async () => {
    const { service, applier } = build();
    applier.apply.mockRejectedValueOnce(new AscSegmentSizeError(10, 9));

    const summary = await service.run();

    expect(appliedIds(applier)).toEqual(['s1', 'o1']);
    expect(summary?.instances).toBe(1);
  });

  it('keeps applying the other requests when one instance cannot be read, and says so', async () => {
    const { service, applier, connections } = build();
    applier.apply.mockRejectedValueOnce(new DiscoveryHeaderError(['Counts']));

    const summary = await service.run();

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

    await service.run();

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

    const summary = await service.run();

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

    await expect(service.run()).rejects.toBeInstanceOf(UnrecoverableError);
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

    await expect(service.run()).rejects.toBeInstanceOf(UnrecoverableError);
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

    await service.run();

    expect(connections.markSynced).toHaveBeenCalledWith(
      'APP_STORE',
      'readOnly',
      ADMIN_KEY_NEEDED,
    );
  });

  it('reports every unresolved territory once per run', async () => {
    const { service, applier } = build();
    applier.apply.mockResolvedValue({ rows: 1, unresolved: ['Atlantis'] });

    const summary = await service.run();

    expect(summary?.unresolved).toEqual(['Atlantis']);
  });

  it('lets any other failure fail the job for a retry', async () => {
    const { service, applier, connections } = build();
    applier.apply.mockRejectedValue(new Error('database down'));

    await expect(service.run()).rejects.toThrow('database down');
    expect(connections.markSynced).not.toHaveBeenCalled();
  });

  it('asks for the detailed report beside the standard one and applies its instances as page rows', async () => {
    const { service, api, applier, prisma } = build();
    api.discoveryReport.mockImplementation(
      (_remoteId: string, variant: string) =>
        Promise.resolve({
          id: variant === 'detailed' ? 'detailed-report' : 'report',
        }),
    );
    api.dailyInstances.mockImplementation((reportId: string) =>
      Promise.resolve(
        reportId === 'detailed-report' ? [instance('d1', '2026-09-04')] : [],
      ),
    );

    await service.run();

    expect(api.discoveryReport).toHaveBeenCalledWith(
      'remote-ongoing',
      'detailed',
    );
    expect(prisma.storeReportRequest.update).toHaveBeenCalledWith({
      where: { id: 'req_ongoing' },
      data: { detailedReportId: 'detailed-report' },
    });
    const variants = applier.apply.mock.calls.map(
      ([, item]: [unknown, { variant: string }]) => item.variant,
    );
    expect(variants).toEqual(['detailed', 'detailed']);
  });

  it('ignores a detailed report the key may not read', async () => {
    const { service, api, applier, connections } = build();
    api.discoveryReport.mockImplementation(
      (_remoteId: string, variant: string) =>
        variant === 'detailed'
          ? Promise.reject(
              new AscRejectedKeyError('no', 403, 'FORBIDDEN_ERROR'),
            )
          : Promise.resolve({ id: 'report' }),
    );

    await expect(service.run()).resolves.not.toBeNull();

    expect(applier.apply).toHaveBeenCalled();
    expect(connections.markRejected).not.toHaveBeenCalled();
  });

  it('keeps the standard lane when listing the detailed report fails', async () => {
    const { service, api, applier, connections } = build();
    api.discoveryReport.mockImplementation(
      (_remoteId: string, variant: string) =>
        variant === 'detailed'
          ? Promise.reject(new AscError('gone', 500, 'UNEXPECTED_ERROR'))
          : Promise.resolve({ id: 'report' }),
    );

    await expect(service.run()).resolves.not.toBeNull();

    expect(applier.apply).toHaveBeenCalled();
    expect(connections.markRejected).not.toHaveBeenCalled();
  });

  it('keeps syncing the other requests when apple fails one standard listing, and says so', async () => {
    const { service, api, applier, connections } = build();
    api.dailyInstances.mockImplementation((reportId: string) =>
      reportId === 'snapshot-report'
        ? Promise.reject(new AscError('down', 500, 'UNEXPECTED_ERROR'))
        : Promise.resolve([instance('o1', '2026-09-02')]),
    );

    const summary = await service.run();

    expect(appliedIds(applier)).toEqual(['o1']);
    expect(summary).toMatchObject({ instances: 1, failed: 1 });
    expect(connections.markSynced).toHaveBeenCalledWith(
      'APP_STORE',
      'admin',
      PARTIAL_SYNC,
    );
  });

  it('keeps syncing the other requests when apple cannot be reached for one standard listing', async () => {
    const { service, api, applier } = build();
    api.dailyInstances.mockImplementation((reportId: string) =>
      reportId === 'snapshot-report'
        ? Promise.reject(new AscUnreachableError('timeout'))
        : Promise.resolve([instance('o1', '2026-09-02')]),
    );

    await expect(service.run()).resolves.toMatchObject({ failed: 1 });
    expect(appliedIds(applier)).toEqual(['o1']);
  });

  it('keeps syncing the other requests when finding the report of one request fails', async () => {
    const { service, api, applier } = build();
    api.discoveryReport.mockImplementation(
      (remoteId: string, variant: string) =>
        remoteId === 'remote-ongoing' && variant === 'standard'
          ? Promise.reject(new AscError('down', 503, null))
          : Promise.resolve(null),
    );

    const summary = await service.run();

    expect(appliedIds(applier)).toEqual(['s1', 's2']);
    expect(summary?.failed).toBe(1);
  });

  it('retires a request whose report apple no longer has and keeps syncing the others', async () => {
    const { service, api, applier, requester, connections } = build();
    api.dailyInstances.mockImplementation((reportId: string) =>
      reportId === 'snapshot-report'
        ? Promise.reject(
            new AscError(
              "There is no resource of type 'analyticsReports' with id 'snapshot-report'",
              404,
              'NOT_FOUND',
            ),
          )
        : Promise.resolve([instance('o1', '2026-09-02')]),
    );

    const summary = await service.run();

    expect(requester.retire).toHaveBeenCalledWith('req_snapshot');
    expect(appliedIds(applier)).toEqual(['o1']);
    expect(summary?.failed).toBe(1);
    expect(connections.markSynced).toHaveBeenCalledWith(
      'APP_STORE',
      'admin',
      PARTIAL_SYNC,
    );
  });

  it('retires a request apple no longer has when finding its report answers 404', async () => {
    const { service, api, requester } = build();
    api.discoveryReport.mockImplementation((remoteId: string) =>
      remoteId === 'remote-ongoing'
        ? Promise.reject(new AscError('gone', 404, 'NOT_FOUND'))
        : Promise.resolve(null),
    );

    await service.run();

    expect(requester.retire).toHaveBeenCalledWith('req_ongoing');
    expect(api.discoveryReport).not.toHaveBeenCalledWith(
      'remote-ongoing',
      'detailed',
    );
  });

  it('keeps a request apple only failed to list', async () => {
    const { service, api, requester } = build();
    api.dailyInstances.mockRejectedValue(new AscError('down', 500, null));

    await service.run();

    expect(requester.retire).not.toHaveBeenCalled();
  });

  it('still rejects the key when apple refuses a standard listing', async () => {
    const { service, api, connections } = build();
    api.dailyInstances.mockRejectedValue(
      new AscRejectedKeyError('no', 403, 'FORBIDDEN_ERROR'),
    );

    await expect(service.run()).rejects.toBeInstanceOf(UnrecoverableError);
    expect(connections.markRejected).toHaveBeenCalled();
  });

  it('still ends the run normally when a standard listing is rate limited', async () => {
    const { service, api, connections } = build();
    api.dailyInstances.mockRejectedValue(
      new AscRateLimitedError('slow', 429, null),
    );

    await expect(service.run()).resolves.toMatchObject({ rateLimited: true });
    expect(connections.markSynced).toHaveBeenCalledWith(
      'APP_STORE',
      'admin',
      null,
    );
  });

  it('never rejects the key over a detailed instance and keeps applying the standard ones', async () => {
    const { service, api, applier, connections } = build();
    api.discoveryReport.mockImplementation(
      (_remoteId: string, variant: string) =>
        Promise.resolve({
          id: variant === 'detailed' ? 'detailed-report' : 'report',
        }),
    );
    api.dailyInstances.mockImplementation((reportId: string) =>
      Promise.resolve(
        reportId === 'detailed-report'
          ? [instance('d1', '2026-09-01')]
          : [instance('o1', '2026-09-02'), instance('o2', '2026-09-03')],
      ),
    );
    applier.apply.mockImplementation(
      (_api: unknown, item: { variant: string }) =>
        item.variant === 'detailed'
          ? Promise.reject(
              new AscRejectedKeyError('no', 403, 'FORBIDDEN_ERROR'),
            )
          : Promise.resolve({ rows: 1, unresolved: [] }),
    );

    await service.run();

    expect(connections.markRejected).not.toHaveBeenCalled();
    expect(
      applier.apply.mock.calls
        .map(
          ([, item]: [unknown, { instance: AscInstance }]) => item.instance.id,
        )
        .filter((id: string) => id.startsWith('o')),
    ).toEqual(['o1', 'o1', 'o2', 'o2']);
  });
});
