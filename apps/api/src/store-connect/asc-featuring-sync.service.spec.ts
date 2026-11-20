import type { PrismaService } from '../prisma/prisma.service';
import type { WorkspaceContext } from '../common/tenancy/workspace-context';
import type { StoreConnectionService } from './store-connection.service';
import { AscListingApi } from './asc-listing-api';
import { AscRateLimitedError } from './asc-errors';
import {
  AscFeaturingSync,
  FEATURING_ROLE_NEEDED,
} from './asc-featuring-sync.service';
import { FIELD_SYNC_UNSERVED_APP } from './asc-keyword-field-sync.service';
import {
  ascFixture,
  failure,
  ok,
  recordedRequester,
} from './asc-transport.fixture';
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
}

interface UpsertCall {
  create: Record<string, unknown>;
  update: Record<string, unknown>;
}

function build(options: RecordOptions = {}) {
  const apps = options.apps ?? [APP];
  const connected = options.connected ?? true;
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
  const prisma = {
    app: { findMany: jest.fn().mockResolvedValue(apps) },
    featuringSync: {
      upsert: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
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
    upsert: prisma.featuringSync.upsert,
    updateMany: prisma.featuringSync.updateMany,
    findMany: prisma.app.findMany,
  };
}

const upsertCalls = (upsert: { mock: { calls: unknown[][] } }): UpsertCall[] =>
  upsert.mock.calls.map(([call]) => call as UpsertCall);

describe('AscFeaturingSync.run', () => {
  it('does nothing without a connection', async () => {
    const { service, requests, upsert } = build({ connected: false });

    await expect(service.run()).resolves.toEqual({
      nominations: 0,
      promoText: 0,
    });
    expect(requests).toHaveLength(0);
    expect(upsert).not.toHaveBeenCalled();
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
    const { service, requests, upsert } = build({
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
    const call = upsertCalls(upsert)[0];
    expect(call.create).toMatchObject({
      workspaceId: WORKSPACE_ID,
      appId: APP.id,
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
    });
    expect(call.create).toHaveProperty('readAt');
  });

  it('takes the newest submitted nomination even when one carries no date', async () => {
    const { service, upsert } = build({
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

    expect(upsertCalls(upsert)[0].update).toMatchObject({
      submittedDate: new Date('2026-10-01T09:30:00.000Z'),
      publishStartDate: new Date('2026-11-15T00:00:00.000Z'),
      publishEndDate: new Date('2026-12-15T00:00:00.000Z'),
    });
  });

  it('counts the nominations of each state and takes the dates of the newest submitted one', async () => {
    const { service, upsert } = build({
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
    expect(upsertCalls(upsert)[0].update).toMatchObject({
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
    const { service, upsert } = build({
      responses: [versions(), localizations(['']), nominations([])],
    });

    await expect(service.run()).resolves.toEqual({
      nominations: 1,
      promoText: 1,
    });
    expect(upsertCalls(upsert)[0].update).toMatchObject({
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
    const { service, upsert } = build({
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
    expect(upsertCalls(upsert)[0].update).toMatchObject({
      roleRefused: true,
      nominationsError: FEATURING_ROLE_NEEDED,
      promoFilled: 1,
      promoTotal: 1,
      promoError: null,
    });
  });

  it('rethrows a rate limit instead of storing a partial read', async () => {
    const { service, upsert } = build({
      responses: [
        versions(),
        localizations(['set']),
        failure(429, 'RATE_LIMIT_EXCEEDED'),
      ],
    });

    await expect(service.run()).rejects.toThrow(AscRateLimitedError);
    expect(upsert).not.toHaveBeenCalled();
  });

  it('records the skip on the stored row of an app that turned invisible', async () => {
    const { service, requests, upsert, updateMany } = build({
      responses: [failure(404, 'NOT_FOUND')],
    });

    await expect(service.run()).resolves.toEqual({
      nominations: 0,
      promoText: 0,
    });
    expect(requests).toHaveLength(1);
    expect(requests[0].path).toContain('/appStoreVersions');
    expect(upsert).not.toHaveBeenCalled();
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
    const { service, upsert, updateMany } = build({
      responses: [failure(404, 'NOT_FOUND')],
    });

    await expect(service.run()).resolves.toEqual({
      nominations: 0,
      promoText: 0,
    });
    expect(upsert).not.toHaveBeenCalled();
    expect(updateMany).toHaveBeenCalled();
  });

  it('reads the nominations of an app with no released version and records the skip', async () => {
    const { service, upsert } = build({
      responses: [
        ok({ data: [], links: {} }),
        nominations([{ state: 'DRAFT' }]),
      ],
    });

    await expect(service.run()).resolves.toEqual({
      nominations: 1,
      promoText: 0,
    });
    expect(upsertCalls(upsert)[0].update).toMatchObject({
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
    const { service, upsert, updateMany } = build({
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
    expect(upsertCalls(upsert)).toHaveLength(1);
    expect(upsertCalls(upsert)[0].create).toMatchObject({
      appId: second.id,
      promoError: null,
    });
  });

  it('reads nothing else of an app whose visibility stayed unknown', async () => {
    const { service, requests, upsert, updateMany } = build({
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
    expect(upsert).not.toHaveBeenCalled();
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
    const { service, upsert } = build({
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
    expect(upsertCalls(upsert)[0].update).toMatchObject({
      submittedNominations: 0,
      promoError: 'INTERNAL_ERROR detail',
      nominationsError: null,
    });
  });
});
