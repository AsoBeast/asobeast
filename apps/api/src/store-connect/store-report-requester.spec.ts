import { Logger } from '@nestjs/common';
import type { WorkspaceContext } from '../common/tenancy/workspace-context';
import type { PrismaService } from '../prisma/prisma.service';
import type { AscAnalyticsApi } from './asc-analytics-api';
import { AscError, AscForbiddenError, AscUnreachableError } from './asc-errors';
import type { OpenedConnection } from './store-connection.service';
import { StoreReportRequester } from './store-report-requester';

const APPS = [
  { id: 'app_1', storeAppId: '111' },
  { id: 'app_2', storeAppId: '222' },
];

function build(
  requested: { appId: string; accessType: string; remoteId?: string }[] = [],
) {
  const upsert = jest.fn().mockResolvedValue({});
  const prisma = {
    app: { findMany: jest.fn().mockResolvedValue(APPS) },
    storeReportRequest: {
      findMany: jest.fn().mockResolvedValue(requested),
      update: jest.fn().mockResolvedValue({}),
      upsert,
    },
  };
  const api = {
    appsById: jest.fn().mockResolvedValue([{ id: '111', name: 'Focus' }]),
    reportRequests: jest.fn().mockResolvedValue([]),
    createReportRequest: jest.fn((_appId: string, accessType: string) =>
      Promise.resolve({
        id: `remote-${accessType}`,
        accessType,
        stoppedDueToInactivity: false,
      }),
    ),
  };
  const connection: OpenedConnection = {
    id: 'conn_1',
    status: 'active',
    reportAccess: 'unknown',
    replyAccess: 'unknown',
    lastError: null,
    api: api as unknown as AscAnalyticsApi,
  };
  const requester = new StoreReportRequester(
    prisma as unknown as PrismaService,
    { require: () => 'ws_1' } as unknown as WorkspaceContext,
  );
  return { requester, prisma, api, connection, upsert };
}

const placed = (upsert: jest.Mock) =>
  upsert.mock.calls.map(
    ([args]: [
      {
        where: { appId_accessType: { appId: string; accessType: string } };
        update: { state: string; remoteId: string | null };
      },
    ]) => ({
      ...args.where.appId_accessType,
      state: args.update.state,
      remoteId: args.update.remoteId,
    }),
  );

describe('StoreReportRequester', () => {
  it('creates a snapshot and an ongoing request for an app without one and records admin access', async () => {
    const { requester, connection, upsert, api } = build();

    const outcome = await requester.ensure(connection, 'APP_STORE');

    expect(api.createReportRequest).toHaveBeenCalledWith(
      '111',
      'ONE_TIME_SNAPSHOT',
    );
    expect(api.createReportRequest).toHaveBeenCalledWith('111', 'ONGOING');
    expect(outcome).toEqual({
      apps: 2,
      reportAccess: 'admin',
      forbidden: false,
      failed: 0,
    });
    expect(placed(upsert)).toEqual([
      {
        appId: 'app_1',
        accessType: 'ONE_TIME_SNAPSHOT',
        state: 'requested',
        remoteId: 'remote-ONE_TIME_SNAPSHOT',
      },
      {
        appId: 'app_1',
        accessType: 'ONGOING',
        state: 'requested',
        remoteId: 'remote-ONGOING',
      },
      {
        appId: 'app_2',
        accessType: 'ONE_TIME_SNAPSHOT',
        state: 'unmatched',
        remoteId: null,
      },
      {
        appId: 'app_2',
        accessType: 'ONGOING',
        state: 'unmatched',
        remoteId: null,
      },
    ]);
  });

  it('adopts an existing request instead of creating one', async () => {
    const { requester, connection, upsert, api } = build();
    api.reportRequests.mockResolvedValue([
      {
        id: 'existing-ongoing',
        accessType: 'ONGOING',
        stoppedDueToInactivity: false,
      },
      {
        id: 'existing-snapshot',
        accessType: 'ONE_TIME_SNAPSHOT',
        stoppedDueToInactivity: false,
      },
    ]);

    const outcome = await requester.ensure(connection, 'APP_STORE');

    expect(api.createReportRequest).not.toHaveBeenCalled();
    expect(outcome.reportAccess).toBe('unknown');
    expect(
      placed(upsert)
        .slice(0, 2)
        .map((row) => row.remoteId),
    ).toEqual(['existing-snapshot', 'existing-ongoing']);
  });

  it('records read only access on a forbidden creation and keeps what it adopted', async () => {
    const { requester, connection, upsert, api } = build();
    api.reportRequests.mockResolvedValue([
      {
        id: 'existing-ongoing',
        accessType: 'ONGOING',
        stoppedDueToInactivity: false,
      },
    ]);
    api.createReportRequest.mockRejectedValue(
      new AscForbiddenError('no', 403, 'FORBIDDEN_ERROR'),
    );

    const outcome = await requester.ensure(connection, 'APP_STORE');

    expect(outcome).toEqual({
      apps: 2,
      reportAccess: 'readOnly',
      forbidden: true,
      failed: 0,
    });
    expect(placed(upsert).slice(0, 2)).toEqual([
      {
        appId: 'app_1',
        accessType: 'ONE_TIME_SNAPSHOT',
        state: 'forbidden',
        remoteId: null,
      },
      {
        appId: 'app_1',
        accessType: 'ONGOING',
        state: 'requested',
        remoteId: 'existing-ongoing',
      },
    ]);
  });

  it('marks a request stopped when apple stopped it and the key cannot create another', async () => {
    const { requester, connection, upsert, api } = build();
    api.reportRequests.mockResolvedValue([
      { id: 'old', accessType: 'ONGOING', stoppedDueToInactivity: true },
      {
        id: 'snap',
        accessType: 'ONE_TIME_SNAPSHOT',
        stoppedDueToInactivity: false,
      },
    ]);
    api.createReportRequest.mockRejectedValue(
      new AscForbiddenError('no', 403, 'FORBIDDEN_ERROR'),
    );

    await requester.ensure(connection, 'APP_STORE');

    expect(placed(upsert)[1]).toMatchObject({
      accessType: 'ONGOING',
      state: 'stopped',
    });
  });

  it('marks an app unmatched when apple answers 404 for its request list', async () => {
    const { requester, connection, upsert, api } = build();
    api.reportRequests.mockRejectedValue(
      new AscError('missing', 404, 'NOT_FOUND'),
    );

    await requester.ensure(connection, 'APP_STORE');

    expect(
      placed(upsert)
        .slice(0, 2)
        .map((row) => row.state),
    ).toEqual(['unmatched', 'unmatched']);
  });

  it('leaves apps whose requests are in place alone', async () => {
    const { requester, connection, upsert, api } = build([
      { appId: 'app_1', accessType: 'ONGOING', remoteId: 'remote-ongoing' },
      { appId: 'app_1', accessType: 'ONE_TIME_SNAPSHOT' },
      { appId: 'app_2', accessType: 'ONGOING', remoteId: 'remote-2' },
      { appId: 'app_2', accessType: 'ONE_TIME_SNAPSHOT' },
    ]);
    api.reportRequests.mockResolvedValue([
      {
        id: 'remote-ongoing',
        accessType: 'ONGOING',
        stoppedDueToInactivity: false,
      },
    ]);

    const outcome = await requester.ensure(connection, 'APP_STORE');

    expect(outcome.apps).toBe(0);
    expect(api.reportRequests).toHaveBeenCalledTimes(1);
    expect(upsert).not.toHaveBeenCalled();
  });

  it('places the ongoing request again when apple stopped it', async () => {
    const { requester, connection, upsert, api } = build([
      { appId: 'app_1', accessType: 'ONGOING', remoteId: 'remote-ongoing' },
      { appId: 'app_1', accessType: 'ONE_TIME_SNAPSHOT' },
    ]);
    api.reportRequests.mockResolvedValue([
      {
        id: 'remote-ongoing',
        accessType: 'ONGOING',
        stoppedDueToInactivity: true,
      },
    ]);

    await requester.ensure(connection, 'APP_STORE');

    expect(api.createReportRequest).toHaveBeenCalledWith('111', 'ONGOING');
    expect(placed(upsert)).toContainEqual({
      appId: 'app_1',
      accessType: 'ONGOING',
      state: 'requested',
      remoteId: 'remote-ONGOING',
    });
  });

  it('forgets the report and the cutoff of both lanes when it places a request again', async () => {
    const { requester, connection, upsert, api } = build([
      { appId: 'app_1', accessType: 'ONGOING', remoteId: 'remote-ongoing' },
      { appId: 'app_1', accessType: 'ONE_TIME_SNAPSHOT' },
    ]);
    api.reportRequests.mockResolvedValue([
      {
        id: 'remote-ongoing',
        accessType: 'ONGOING',
        stoppedDueToInactivity: true,
      },
    ]);

    await requester.ensure(connection, 'APP_STORE');

    const ongoing = upsert.mock.calls
      .map(
        ([args]: [{ where: unknown; update: Record<string, unknown> }]) => args,
      )
      .find(
        (args) =>
          JSON.stringify(args.where) ===
          JSON.stringify({
            appId_accessType: { appId: 'app_1', accessType: 'ONGOING' },
          }),
      );
    expect(ongoing?.update).toMatchObject({
      remoteId: 'remote-ONGOING',
      reportId: null,
      lastProcessingDate: null,
      detailedReportId: null,
      detailedLastProcessingDate: null,
    });
  });

  it('keeps placing the other apps when apple fails one', async () => {
    const { requester, connection, upsert, api } = build();
    api.appsById.mockResolvedValue([
      { id: '111', name: 'Focus' },
      { id: '222', name: 'Habits' },
    ]);
    api.reportRequests.mockImplementation((storeAppId: string) =>
      storeAppId === '111'
        ? Promise.reject(new AscError('busy', 409, 'STATE_ERROR'))
        : Promise.resolve([]),
    );

    const outcome = await requester.ensure(connection, 'APP_STORE');

    expect(outcome.failed).toBe(1);
    expect(placed(upsert).map((row) => row.appId)).toEqual(['app_2', 'app_2']);
  });

  it('keeps placing the other apps when apple does not answer for one, and names it', async () => {
    const warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    const { requester, connection, upsert, api } = build();
    api.appsById.mockResolvedValue([
      { id: '111', name: 'Focus' },
      { id: '222', name: 'Habits' },
    ]);
    api.reportRequests.mockImplementation((storeAppId: string) =>
      storeAppId === '111'
        ? Promise.reject(
            new AscUnreachableError('The operation was aborted due to timeout'),
          )
        : Promise.resolve([]),
    );

    const outcome = await requester.ensure(connection, 'APP_STORE');

    expect(outcome.failed).toBe(1);
    expect(placed(upsert).map((row) => row.appId)).toEqual(['app_2', 'app_2']);
    expect(warn).toHaveBeenCalledWith(
      expect.stringMatching(/app_1 .*aborted due to timeout/),
    );
    warn.mockRestore();
  });

  it('asks nothing without primary apps', async () => {
    const { requester, connection, prisma, api } = build();
    prisma.app.findMany.mockResolvedValue([]);

    await requester.ensure(connection, 'APP_STORE');

    expect(api.appsById).not.toHaveBeenCalled();
  });
  it('retires a request so the next run places it again', async () => {
    const { requester, prisma } = build();

    await requester.retire('req_1');

    expect(prisma.storeReportRequest.update).toHaveBeenCalledWith({
      where: { id: 'req_1' },
      data: {
        state: 'stopped',
        remoteId: null,
        reportId: null,
        lastProcessingDate: null,
        detailedReportId: null,
        detailedLastProcessingDate: null,
      },
    });
  });

  it('records a request apple refuses as a duplicate as stopped and still places the other one', async () => {
    const { requester, connection, upsert, api } = build();
    api.createReportRequest.mockImplementation(
      (_appId: string, accessType: string) =>
        accessType === 'ONE_TIME_SNAPSHOT'
          ? Promise.reject(
              new AscError(
                'You already have such an entity',
                409,
                'STATE_ERROR',
              ),
            )
          : Promise.resolve({
              id: 'remote-ONGOING',
              accessType,
              stoppedDueToInactivity: false,
            }),
    );

    const outcome = await requester.ensure(connection, 'APP_STORE');

    expect(outcome).toMatchObject({ failed: 0, forbidden: false });
    expect(placed(upsert).filter((row) => row.appId === 'app_1')).toEqual([
      {
        appId: 'app_1',
        accessType: 'ONE_TIME_SNAPSHOT',
        state: 'stopped',
        remoteId: null,
      },
      {
        appId: 'app_1',
        accessType: 'ONGOING',
        state: 'requested',
        remoteId: 'remote-ONGOING',
      },
    ]);
  });

  it('places again a request retired after apple lost it, adopting a listed one first', async () => {
    const { requester, connection, upsert, api } = build([
      { appId: 'app_1', accessType: 'ONGOING', remoteId: 'live-ongoing' },
    ]);
    api.reportRequests.mockResolvedValue([
      {
        id: 'live-ongoing',
        accessType: 'ONGOING',
        stoppedDueToInactivity: false,
      },
      {
        id: 'listed-snapshot',
        accessType: 'ONE_TIME_SNAPSHOT',
        stoppedDueToInactivity: false,
      },
    ]);

    await requester.ensure(connection, 'APP_STORE');

    expect(api.createReportRequest).not.toHaveBeenCalledWith(
      '111',
      'ONE_TIME_SNAPSHOT',
    );
    expect(placed(upsert)).toContainEqual({
      appId: 'app_1',
      accessType: 'ONE_TIME_SNAPSHOT',
      state: 'requested',
      remoteId: 'listed-snapshot',
    });
  });
});
