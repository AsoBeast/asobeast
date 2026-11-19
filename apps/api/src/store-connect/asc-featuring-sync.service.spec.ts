import type { PrismaService } from '../prisma/prisma.service';
import type { WorkspaceContext } from '../common/tenancy/workspace-context';
import type { StoreConnectionService } from './store-connection.service';
import { AscListingApi } from './asc-listing-api';
import { AscRateLimitedError } from './asc-errors';
import {
  AscFeaturingSync,
  FEATURING_ROLE_NEEDED,
} from './asc-featuring-sync.service';
import {
  ascFixture,
  failure,
  ok,
  recordedRequester,
} from './asc-transport.fixture';
import type { AscResponse } from './asc-transport';

const APP = { id: 'app_1', storeAppId: '1476097583' };
const WORKSPACE_ID = 'ws_1';

const NOMINATION_PATH = (state: string) =>
  `/v1/nominations?filter[state]=${state}&filter[relatedApps]=${APP.storeAppId}&fields[nominations]=state,submittedDate,publishStartDate,publishEndDate&limit=200`;

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

const nominations = (
  state: string,
  entries: Record<string, string>[],
): AscResponse =>
  ok({
    data: entries.map((attributes, index) => ({
      id: `nom-${index}`,
      type: 'nominations',
      attributes: { state, ...attributes },
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
    featuringSync: { upsert: jest.fn().mockResolvedValue({}) },
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
        nominations('DRAFT', []),
        ok(ascFixture('nominations')),
        nominations('ARCHIVED', []),
      ],
    });

    await expect(service.run()).resolves.toEqual({
      nominations: 1,
      promoText: 2,
    });
    expect(requests.map(({ path }) => path)).toEqual([
      expect.stringContaining('/v1/apps/1476097583/appStoreVersions'),
      expect.stringContaining('/appStoreVersionLocalizations'),
      NOMINATION_PATH('DRAFT'),
      NOMINATION_PATH('SUBMITTED'),
      NOMINATION_PATH('ARCHIVED'),
    ]);
    expect(requests[2].method).toBe('GET');
    const call = upsertCalls(upsert)[0];
    expect(call.create).toMatchObject({
      workspaceId: WORKSPACE_ID,
      appId: APP.id,
      draftNominations: 0,
      submittedNominations: 1,
      archivedNominations: 0,
      submittedDate: new Date('2026-10-01T09:30:00.000Z'),
      publishStartDate: new Date('2026-11-15T00:00:00.000Z'),
      publishEndDate: new Date('2026-12-15T00:00:00.000Z'),
      promoFilled: 1,
      promoTotal: 2,
      roleRefused: false,
      nominationsError: null,
      promoError: null,
      syncedAt: expect.any(Date) as Date,
    });
    expect(call.create).toHaveProperty('readAt');
  });

  it('counts every state and takes the dates of the newest submitted nomination', async () => {
    const { service, upsert } = build({
      responses: [
        versions(),
        localizations(['text', 'text', '', '']),
        nominations('DRAFT', [{ state: 'DRAFT' }, { state: 'DRAFT' }]),
        nominations('SUBMITTED', [
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
        nominations('ARCHIVED', [{ state: 'ARCHIVED' }]),
      ],
    });

    await expect(service.run()).resolves.toEqual({
      nominations: 1,
      promoText: 4,
    });
    expect(upsertCalls(upsert)[0].update).toMatchObject({
      draftNominations: 2,
      submittedNominations: 2,
      archivedNominations: 1,
      submittedDate: new Date('2026-10-01T09:30:00.000Z'),
      publishStartDate: new Date('2026-11-15T00:00:00.000Z'),
      publishEndDate: new Date('2026-12-15T00:00:00.000Z'),
      promoFilled: 2,
      promoTotal: 4,
      syncedAt: expect.any(Date) as Date,
    });
  });

  it('answers zero counts and a synced row for an app with no nominations', async () => {
    const { service, upsert } = build({
      responses: [
        versions(),
        localizations(['']),
        nominations('DRAFT', []),
        nominations('SUBMITTED', []),
        nominations('ARCHIVED', []),
      ],
    });

    await expect(service.run()).resolves.toEqual({
      nominations: 1,
      promoText: 1,
    });
    expect(upsertCalls(upsert)[0].update).toMatchObject({
      draftNominations: 0,
      submittedNominations: 0,
      archivedNominations: 0,
      submittedDate: null,
      promoFilled: 0,
      promoTotal: 1,
      nominationsError: null,
      promoError: null,
      syncedAt: expect.any(Date) as Date,
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
    expect(upsertCalls(upsert)[0].update).not.toHaveProperty('syncedAt');
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

  it('stores no row for an app the key cannot see, without reading nominations', async () => {
    const { service, requests, upsert } = build({
      responses: [
        failure(404, 'NOT_FOUND'),
        nominations('DRAFT', []),
        nominations('SUBMITTED', []),
        nominations('ARCHIVED', []),
      ],
    });

    await expect(service.run()).resolves.toEqual({
      nominations: 0,
      promoText: 0,
    });
    expect(requests).toHaveLength(1);
    expect(requests[0].path).toContain('/appStoreVersions');
    expect(upsert).not.toHaveBeenCalled();
  });

  it('reads the nominations of an app with no released version and records the skip', async () => {
    const { service, upsert } = build({
      responses: [
        ok({ data: [], links: {} }),
        nominations('DRAFT', []),
        nominations('SUBMITTED', []),
        nominations('ARCHIVED', [{ state: 'ARCHIVED' }]),
      ],
    });

    await expect(service.run()).resolves.toEqual({
      nominations: 1,
      promoText: 0,
    });
    expect(upsertCalls(upsert)[0].update).toMatchObject({
      archivedNominations: 1,
      promoError:
        'App Store Connect has no released iOS version for this app yet',
      nominationsError: null,
    });
    expect(upsertCalls(upsert)[0].update).not.toHaveProperty('syncedAt');
  });

  it('records a skipped read of one app and keeps going with the next', async () => {
    const second = { id: 'app_2', storeAppId: '2345678901' };
    const unreadable =
      'App Store Connect answered with something AsoBeast could not read';
    const { service, upsert } = build({
      apps: [APP, second],
      responses: [
        ok(null),
        nominations('DRAFT', []),
        nominations('SUBMITTED', []),
        nominations('ARCHIVED', []),
        versions(),
        localizations(['set']),
        nominations('DRAFT', []),
        nominations('SUBMITTED', []),
        nominations('ARCHIVED', [{ state: 'ARCHIVED' }]),
      ],
    });

    await expect(service.run()).resolves.toEqual({
      nominations: 2,
      promoText: 1,
    });
    expect(upsertCalls(upsert)[0].create).toMatchObject({
      appId: APP.id,
      promoError: unreadable,
      nominationsError: null,
    });
    expect(upsertCalls(upsert)[1].create).toMatchObject({
      appId: second.id,
      promoError: null,
      syncedAt: expect.any(Date) as Date,
    });
  });

  it('leaves the promotional text of an app whose localizations fail and reads its nominations', async () => {
    const { service, upsert } = build({
      responses: [
        versions(),
        failure(500, 'INTERNAL_ERROR'),
        failure(500, 'INTERNAL_ERROR'),
        nominations('DRAFT', []),
        nominations('SUBMITTED', []),
        nominations('ARCHIVED', []),
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
