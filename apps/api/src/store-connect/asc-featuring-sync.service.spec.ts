import type { PrismaService } from '../prisma/prisma.service';
import type { WorkspaceContext } from '../common/tenancy/workspace-context';
import type { StoreConnectionService } from './store-connection.service';
import { AscListingApi } from './asc-listing-api';
import { AscRateLimitedError } from './asc-errors';
import { AscFeaturingSync } from './asc-featuring-sync.service';
import { FIELD_SYNC_UNSERVED_APP } from './asc-keyword-field-sync.service';
import { failure, ok, recordedRequester } from './asc-transport.fixture';
import type { AscResponse } from './asc-transport';

const APP = { id: 'app_1', storeAppId: '1476097583' };
const WORKSPACE_ID = 'ws_1';

const NOMINATION_PATH = (states: string) =>
  `/v1/nominations?filter[state]=${states}&filter[relatedApps]=${APP.storeAppId}&fields[nominations]=state,submittedDate,publishStartDate,publishEndDate&limit=200`;

const versions = (): AscResponse =>
  ok({
    data: [
      {
        id: 'v1',
        type: 'appStoreVersions',
        attributes: {
          appStoreState: 'READY_FOR_SALE',
          versionString: '5.24.2',
          createdDate: '2026-01-15T10:00:00.000Z',
        },
      },
    ],
    links: {},
  });

const localizations = (promotionalText: string[]): AscResponse =>
  ok({
    data: promotionalText.map((text, index) => ({
      id: `loc-${index}`,
      type: 'appStoreVersionLocalizations',
      attributes: { locale: `l-${index}`, keywords: '', promotionalText: text },
    })),
    links: {},
  });

const nominations = (entries: Record<string, string>[]): AscResponse =>
  ok({
    data: entries.map((attributes, index) => ({
      id: `nom-${index}`,
      type: 'nominations',
      attributes,
    })),
    links: {},
  });

interface RecordOptions {
  connected?: boolean;
  apps?: { id: string; storeAppId: string }[];
  responses?: AscResponse[];
  storedRow?: boolean;
  connectionAlive?: boolean;
}

interface RecordedWrite {
  where?: Record<string, unknown>;
  data?: Record<string, unknown>;
}

function build(options: RecordOptions = {}) {
  const apps = options.apps ?? [APP];
  const connected = options.connected ?? true;
  const storedRow = options.storedRow ?? true;
  const connectionAlive = options.connectionAlive ?? true;
  const { requester, requests } = recordedRequester(
    ...(options.responses ?? []),
  );
  const connections = {
    openAppStoreListing: jest.fn().mockResolvedValue(
      connected
        ? {
            id: 'conn_1',
            status: 'active',
            api: new AscListingApi(requester),
          }
        : null,
    ),
  };
  const create = jest.fn().mockResolvedValue({});
  const storedConnection = jest
    .fn()
    .mockResolvedValue(connectionAlive ? { id: 'conn_1' } : null);
  const transaction = {
    storeConnection: { findFirst: storedConnection },
    featuringSync: { create },
  };
  const prisma = {
    app: { findMany: jest.fn().mockResolvedValue(apps) },
    featuringSync: {
      create,
      updateMany: jest.fn().mockResolvedValue({ count: storedRow ? 1 : 0 }),
    },
    withTransaction: (run: (tx: typeof transaction) => Promise<unknown>) =>
      run(transaction),
  };
  const workspace = { require: jest.fn(() => WORKSPACE_ID) };
  const service = new AscFeaturingSync(
    prisma as unknown as PrismaService,
    connections as unknown as StoreConnectionService,
    workspace as unknown as WorkspaceContext,
  );
  return {
    service,
    requests,
    create,
    storedConnection,
    updateMany: prisma.featuringSync.updateMany,
    findMany: prisma.app.findMany,
  };
}

const writesOf = (mock: { mock: { calls: unknown[][] } }): RecordedWrite[] =>
  mock.mock.calls.map(([call]) => call as RecordedWrite);

const createCallsOf = (mock: { mock: { calls: unknown[][] } }): unknown[] =>
  mock.mock.calls.map(([call]) => call);

describe('AscFeaturingSync.run', () => {
  it('does nothing without a connection', async () => {
    const { service, requests, updateMany } = build({ connected: false });

    await expect(service.run()).resolves.toEqual({
      nominations: 0,
      promoText: 0,
    });
    expect(requests).toHaveLength(0);
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('reads only the primary app store apps of the workspace', async () => {
    const { service, findMany } = build();

    await service.run();

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { store: 'APP_STORE', isCompetitor: false },
        orderBy: { createdAt: 'asc' },
      }),
    );
  });

  it('stores the nomination summary and the promotional text counts of one app', async () => {
    const { service, requests, updateMany } = build({
      responses: [
        versions(),
        localizations(['two weeks of focus', '']),
        nominations([
          {
            state: 'SUBMITTED',
            submittedDate: '2026-10-01T09:30:00.000Z',
            publishStartDate: '2026-11-15T00:00:00.000Z',
            publishEndDate: '2026-12-15T00:00:00.000Z',
          },
        ]),
      ],
    });

    await expect(service.run()).resolves.toEqual({
      nominations: 1,
      promoText: 2,
    });
    expect(requests.map(({ path }) => path)).toEqual([
      expect.stringContaining('/v1/apps/1476097583/appStoreVersions'),
      expect.stringContaining('/appStoreVersionLocalizations'),
      NOMINATION_PATH('DRAFT,SUBMITTED'),
    ]);
    expect(requests[2].method).toBe('GET');
    expect(writesOf(updateMany)[0]).toMatchObject({
      where: { appId: APP.id },
      data: {
        draftNominations: 0,
        submittedNominations: 1,
        submittedDate: new Date('2026-10-01T09:30:00.000Z'),
        publishStartDate: new Date('2026-11-15T00:00:00.000Z'),
        publishEndDate: new Date('2026-12-15T00:00:00.000Z'),
        promoFilled: 1,
        promoTotal: 2,
        roleRefused: false,
        nominationsError: null,
        promoError: null,
      },
    });
    expect(writesOf(updateMany)[0].data).toHaveProperty('readAt');
  });

  it('creates the first row while the connection still exists', async () => {
    const { service, create, storedConnection } = build({
      storedRow: false,
      responses: [
        versions(),
        localizations(['two weeks of focus', '']),
        nominations([]),
      ],
    });

    await expect(service.run()).resolves.toEqual({
      nominations: 1,
      promoText: 2,
    });
    expect(storedConnection).toHaveBeenCalledWith({
      where: { id: 'conn_1', status: 'active' },
      select: { id: true },
    });
    expect(createCallsOf(create)[0]).toMatchObject({
      data: {
        workspaceId: WORKSPACE_ID,
        appId: APP.id,
        draftNominations: 0,
        submittedNominations: 0,
        promoFilled: 1,
        promoTotal: 2,
        roleRefused: false,
        nominationsError: null,
        promoError: null,
      },
    });
  });

  it('creates no row after the connection went away', async () => {
    const { service, create, storedConnection } = build({
      storedRow: false,
      connectionAlive: false,
      responses: [
        versions(),
        localizations(['two weeks of focus', '']),
        nominations([]),
      ],
    });

    await expect(service.run()).resolves.toEqual({
      nominations: 1,
      promoText: 2,
    });
    expect(storedConnection).toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it('takes the newest submitted nomination even when one carries no date', async () => {
    const { service, updateMany } = build({
      responses: [
        versions(),
        localizations(['text']),
        nominations([
          { state: 'SUBMITTED' },
          {
            state: 'SUBMITTED',
            submittedDate: '2026-10-01T09:30:00.000Z',
            publishStartDate: '2026-11-15T00:00:00.000Z',
            publishEndDate: '2026-12-15T00:00:00.000Z',
          },
        ]),
      ],
    });

    await service.run();

    expect(writesOf(updateMany)[0].data).toMatchObject({
      submittedDate: new Date('2026-10-01T09:30:00.000Z'),
      publishStartDate: new Date('2026-11-15T00:00:00.000Z'),
      publishEndDate: new Date('2026-12-15T00:00:00.000Z'),
    });
  });

  it('stores the window that can still run when the newer nomination has ended', async () => {
    const { service, updateMany } = build({
      responses: [
        versions(),
        localizations(['text']),
        nominations([
          {
            state: 'SUBMITTED',
            submittedDate: '2026-11-10T09:30:00.000Z',
            publishStartDate: '2026-11-01T00:00:00.000Z',
            publishEndDate: '2026-11-05T00:00:00.000Z',
          },
          {
            state: 'SUBMITTED',
            submittedDate: '2026-10-10T09:30:00.000Z',
            publishStartDate: '2026-11-15T00:00:00.000Z',
            publishEndDate: '2999-01-01T00:00:00.000Z',
          },
        ]),
      ],
    });

    await service.run();

    expect(writesOf(updateMany)[0].data).toMatchObject({
      submittedNominations: 2,
      submittedDate: new Date('2026-10-10T09:30:00.000Z'),
      publishStartDate: new Date('2026-11-15T00:00:00.000Z'),
      publishEndDate: new Date('2999-01-01T00:00:00.000Z'),
    });
  });

  it('stores the same window whatever order Apple lists the nominations in', async () => {
    const { service, updateMany } = build({
      responses: [
        versions(),
        localizations(['text']),
        nominations([
          {
            state: 'SUBMITTED',
            submittedDate: '2026-10-10T09:30:00.000Z',
            publishStartDate: '2026-11-15T00:00:00.000Z',
            publishEndDate: '2999-01-01T00:00:00.000Z',
          },
          {
            state: 'SUBMITTED',
            submittedDate: '2026-11-10T09:30:00.000Z',
            publishStartDate: '2026-11-01T00:00:00.000Z',
            publishEndDate: '2026-11-05T00:00:00.000Z',
          },
        ]),
      ],
    });

    await service.run();

    expect(writesOf(updateMany)[0].data).toMatchObject({
      submittedDate: new Date('2026-10-10T09:30:00.000Z'),
      publishStartDate: new Date('2026-11-15T00:00:00.000Z'),
      publishEndDate: new Date('2999-01-01T00:00:00.000Z'),
    });
  });

  it('counts the nominations of each state and takes the dates of the newest submitted one', async () => {
    const { service, updateMany } = build({
      responses: [
        versions(),
        localizations(['text', 'text', '', '']),
        nominations([
          { state: 'DRAFT' },
          { state: 'DRAFT' },
          {
            state: 'SUBMITTED',
            submittedDate: '2026-10-01T09:30:00.000Z',
            publishStartDate: '2026-11-15T00:00:00.000Z',
            publishEndDate: '2026-12-15T00:00:00.000Z',
          },
          {
            state: 'SUBMITTED',
            submittedDate: '2026-09-01T09:30:00.000Z',
            publishStartDate: '2026-10-15T00:00:00.000Z',
            publishEndDate: '2026-11-15T00:00:00.000Z',
          },
        ]),
      ],
    });

    await expect(service.run()).resolves.toEqual({
      nominations: 1,
      promoText: 4,
    });
    expect(writesOf(updateMany)[0].data).toMatchObject({
      draftNominations: 2,
      submittedNominations: 2,
      submittedDate: new Date('2026-10-01T09:30:00.000Z'),
      publishStartDate: new Date('2026-11-15T00:00:00.000Z'),
      publishEndDate: new Date('2026-12-15T00:00:00.000Z'),
      promoFilled: 2,
      promoTotal: 4,
    });
  });

  it('answers zero counts for an app with no nominations', async () => {
    const { service, updateMany } = build({
      responses: [versions(), localizations(['']), nominations([])],
    });

    await expect(service.run()).resolves.toEqual({
      nominations: 1,
      promoText: 1,
    });
    expect(writesOf(updateMany)[0].data).toMatchObject({
      draftNominations: 0,
      submittedNominations: 0,
      submittedDate: null,
      promoFilled: 0,
      promoTotal: 1,
      nominationsError: null,
      promoError: null,
    });
  });

  it('stores a role refusal instead of throwing and keeps the promotional text', async () => {
    const { service, updateMany } = build({
      responses: [
        versions(),
        localizations(['set']),
        failure(403, 'NOT_AUTHORIZED'),
      ],
    });

    await expect(service.run()).resolves.toEqual({
      nominations: 0,
      promoText: 1,
    });
    expect(writesOf(updateMany)[0].data).toMatchObject({
      roleRefused: true,
      nominationsError: 'NOT_AUTHORIZED detail',
      promoFilled: 1,
      promoTotal: 1,
      promoError: null,
    });
  });

  it('rethrows a rate limit of the version read without storing', async () => {
    const { service, updateMany, create } = build({
      responses: [failure(429, 'RATE_LIMIT_EXCEEDED')],
    });

    await expect(service.run()).rejects.toThrow(AscRateLimitedError);
    expect(updateMany).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it('stores the promotional text before rethrowing a rate limit of the nominations', async () => {
    const { service, updateMany } = build({
      responses: [
        versions(),
        localizations(['set']),
        failure(429, 'RATE_LIMIT_EXCEEDED'),
      ],
    });

    await expect(service.run()).rejects.toThrow(AscRateLimitedError);
    expect(writesOf(updateMany)[0].data).toMatchObject({
      promoFilled: 1,
      promoTotal: 1,
      promoError: null,
      nominationsError: 'RATE_LIMIT_EXCEEDED detail',
    });
  });

  it('records the skip on the stored row of an app that turned invisible', async () => {
    const { service, requests, updateMany, create } = build({
      responses: [failure(404, 'NOT_FOUND')],
    });

    await expect(service.run()).resolves.toEqual({
      nominations: 0,
      promoText: 0,
    });
    expect(requests).toHaveLength(1);
    expect(requests[0].path).toContain('/appStoreVersions');
    expect(create).not.toHaveBeenCalled();
    expect(updateMany).toHaveBeenCalledWith({
      where: { appId: APP.id },
      data: {
        roleRefused: false,
        nominationsError: FIELD_SYNC_UNSERVED_APP,
        promoError: FIELD_SYNC_UNSERVED_APP,
      },
    });
  });

  it('creates no row for an app the key never saw', async () => {
    const { service, updateMany, create } = build({
      storedRow: false,
      responses: [failure(404, 'NOT_FOUND')],
    });

    await expect(service.run()).resolves.toEqual({
      nominations: 0,
      promoText: 0,
    });
    expect(updateMany).toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it('reads the nominations of an app with no released version and records the skip', async () => {
    const { service, updateMany } = build({
      responses: [
        ok({ data: [], links: {} }),
        nominations([{ state: 'DRAFT' }]),
      ],
    });

    await expect(service.run()).resolves.toEqual({
      nominations: 1,
      promoText: 0,
    });
    expect(writesOf(updateMany)[0].data).toMatchObject({
      draftNominations: 1,
      promoError:
        'App Store Connect has no released iOS version for this app yet',
      nominationsError: null,
    });
  });

  it('records a failed version read on both rows and keeps going with the next', async () => {
    const second = { id: 'app_2', storeAppId: '2345678901' };
    const unreadable =
      'App Store Connect answered with something AsoBeast could not read';
    const { service, updateMany, create } = build({
      apps: [APP, second],
      responses: [
        ok(null),
        versions(),
        localizations(['set']),
        nominations([]),
      ],
    });

    await expect(service.run()).resolves.toEqual({
      nominations: 1,
      promoText: 1,
    });
    expect(updateMany).toHaveBeenCalledWith({
      where: { appId: APP.id },
      data: {
        roleRefused: false,
        nominationsError: unreadable,
        promoError: unreadable,
      },
    });
    expect(create).not.toHaveBeenCalled();
    expect(writesOf(updateMany)[1].data).toMatchObject({
      draftNominations: 0,
      submittedNominations: 0,
      promoFilled: 1,
      promoTotal: 1,
      promoError: null,
    });
  });

  it('reads nothing else of an app whose visibility stayed unknown', async () => {
    const { service, requests, updateMany, create } = build({
      responses: [
        failure(500, 'INTERNAL_ERROR'),
        failure(500, 'INTERNAL_ERROR'),
      ],
    });

    await expect(service.run()).resolves.toEqual({
      nominations: 0,
      promoText: 0,
    });
    expect(requests.map(({ path }) => path)).toEqual([
      expect.stringContaining('/appStoreVersions'),
      expect.stringContaining('/appStoreVersions'),
    ]);
    expect(create).not.toHaveBeenCalled();
    expect(updateMany).toHaveBeenCalledWith({
      where: { appId: APP.id },
      data: {
        roleRefused: false,
        nominationsError: 'INTERNAL_ERROR detail',
        promoError: 'INTERNAL_ERROR detail',
      },
    });
  });

  it('leaves the promotional text of an app whose localizations fail and reads its nominations', async () => {
    const { service, updateMany } = build({
      responses: [
        versions(),
        failure(500, 'INTERNAL_ERROR'),
        failure(500, 'INTERNAL_ERROR'),
        nominations([]),
      ],
    });

    await expect(service.run()).resolves.toEqual({
      nominations: 1,
      promoText: 0,
    });
    expect(writesOf(updateMany)[0].data).toMatchObject({
      submittedNominations: 0,
      promoError: 'INTERNAL_ERROR detail',
      nominationsError: null,
    });
  });
});
