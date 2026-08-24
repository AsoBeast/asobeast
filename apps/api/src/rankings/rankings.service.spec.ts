import { ConfigService } from '@nestjs/config';
import { Store } from '@prisma/client';
import { AlertPayload, RANK_DEPTH } from '@asobeast/shared';
import { AlertsDispatcher } from '../alerts/alerts.dispatcher';
import { CollectionEligibility } from '../auth/collection-eligibility.service';
import { Env } from '../config/env';
import { CrossTenantAccess } from '../common/tenancy/cross-tenant-access';
import { WorkspaceContext } from '../common/tenancy/workspace-context';
import { PrismaService } from '../prisma/prisma.service';
import { ImplausibleResultError } from '../store-providers/errors';
import { StoreProviderRegistry } from '../store-providers/store-provider.registry';
import { SearchItem } from '../store-providers/types';
import { RankingAlertsService } from './ranking-alerts.service';
import { RankingsService } from './rankings.service';

interface SerpFixture {
  storeAppId: string;
  title: string;
}

interface SerpRow extends SerpFixture {
  position: number;
}

const FROZEN_NOW = new Date('2026-07-18T09:30:00.000Z');

const utcDayStart = (from: Date, offsetDays = 0): Date =>
  new Date(
    Date.UTC(
      from.getUTCFullYear(),
      from.getUTCMonth(),
      from.getUTCDate() + offsetDays,
    ),
  );

const PREVIOUS_DAY = utcDayStart(FROZEN_NOW, -1);

const serpRows = (fixtures: SerpFixture[] | null | undefined): SerpRow[] =>
  (fixtures ?? []).map((entry, index) => ({ ...entry, position: index + 1 }));

const twoTenants = [
  {
    app: {
      id: 'primary',
      name: 'Mine',
      workspaceId: 'ws_paying',
      storeAppId: 'primary-store',
      competitors: [],
    },
  },
  {
    app: {
      id: 'their-primary',
      name: 'Theirs',
      workspaceId: 'ws_suspended',
      storeAppId: 'competitor-store',
      competitors: [
        {
          id: 'their-competitor',
          workspaceId: 'ws_suspended',
          storeAppId: 'absent-store',
        },
      ],
    },
  },
];

describe('RankingsService.checkKeyword', () => {
  beforeAll(() => {
    jest
      .useFakeTimers({
        doNotFake: ['nextTick', 'queueMicrotask', 'setImmediate'],
      })
      .setSystemTime(FROZEN_NOW);
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  const buildSearchResults = (): SearchItem[] => {
    const items: SearchItem[] = [];
    for (let i = 1; i <= 40; i += 1) {
      items.push({ storeAppId: `other-${i}`, title: `Other ${i}` });
    }
    items[6] = { storeAppId: 'primary-store', title: 'Primary' };
    items[30] = { storeAppId: 'competitor-store', title: 'Competitor A' };
    return items;
  };

  const setup = (options?: {
    tracked?: unknown[];
    previous?: { position: number | null; depth?: number } | null;
    existingToday?: { position: number | null } | null;
    threshold?: number;
    country?: string;
    previousSerp?: SerpFixture[] | null;
    sameDaySerp?: SerpFixture[] | null;
    knownApps?: { id: string; storeAppId: string; isCompetitor: boolean }[];
    searchResults?: SearchItem[];
    collectableWorkspaces?: string[] | null;
  }) => {
    const search = jest
      .fn()
      .mockResolvedValue(options?.searchResults ?? buildSearchResults());
    const upsert = jest
      .fn<
        Promise<void>,
        [
          {
            create: {
              appId: string;
              position: number | null;
              depth: number;
            };
          },
        ]
      >()
      .mockResolvedValue(undefined);
    const rankingFindUnique = jest
      .fn()
      .mockResolvedValue(options?.existingToday ?? null);
    const rankingFindFirst = jest
      .fn()
      .mockResolvedValue(options?.previous ?? null);
    const dispatch = jest.fn<Promise<void>, [AlertPayload]>();
    const deleteMany = jest
      .fn<{ op: string }, [{ where: { keywordId: string; date: Date } }]>()
      .mockReturnValue({ op: 'delete' });
    const createMany = jest
      .fn<
        { op: string },
        [
          {
            data: Array<{
              keywordId: string;
              position: number;
              storeAppId: string;
            }>;
          },
        ]
      >()
      .mockReturnValue({ op: 'create' });
    const withTransaction = jest.fn(
      (callback: (tx: unknown) => Promise<unknown>) =>
        callback({ serpEntry: { deleteMany, createMany } }),
    );
    const tracked = options?.tracked ?? [
      {
        app: {
          id: 'primary',
          workspaceId: 'ws_default',
          storeAppId: 'primary-store',
          competitors: [
            {
              id: 'competitorA',
              workspaceId: 'ws_default',
              storeAppId: 'competitor-store',
            },
            {
              id: 'competitorB',
              workspaceId: 'ws_default',
              storeAppId: 'absent-store',
            },
          ],
        },
      },
    ];
    const trackedFindMany = jest.fn().mockResolvedValue(tracked);
    const prisma = {
      keyword: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'kw1',
          text: 'habit tracker',
          store: Store.APP_STORE,
          country: options?.country ?? 'us',
        }),
      },
      trackedKeyword: {
        findMany: trackedFindMany,
      },
      keywordRanking: {
        upsert,
        findUnique: rankingFindUnique,
        findFirst: rankingFindFirst,
      },
      serpEntry: {
        deleteMany,
        createMany,
        findFirst: jest
          .fn()
          .mockResolvedValue(
            options?.previousSerp ? { date: PREVIOUS_DAY } : null,
          ),
        findMany: jest
          .fn<Promise<SerpRow[]>, [{ where: { date: Date } }]>()
          .mockImplementation(({ where }) =>
            Promise.resolve(
              serpRows(
                where.date.getTime() === PREVIOUS_DAY.getTime()
                  ? options?.previousSerp
                  : options?.sameDaySerp,
              ),
            ),
          ),
      },
      app: {
        findMany: jest.fn().mockResolvedValue(options?.knownApps ?? []),
      },
      withTransaction,
    };
    const registry = { get: () => ({ search }) };
    const config = {
      get: () => options?.threshold ?? 5,
    } as unknown as ConfigService<Env, true>;
    const alerts = { dispatch } as unknown as AlertsDispatcher;
    const rankingAlerts = new RankingAlertsService(
      prisma as unknown as PrismaService,
      config,
      alerts,
    );
    const workspace = new WorkspaceContext();
    const forKeyword = jest
      .fn<Promise<Set<string>>, [Iterable<string>, string]>()
      .mockImplementation((workspaceIds) =>
        Promise.resolve(
          new Set(
            options?.collectableWorkspaces === undefined
              ? [...workspaceIds]
              : (options.collectableWorkspaces ?? []),
          ),
        ),
      );
    const service = new RankingsService(
      prisma as unknown as PrismaService,
      registry as unknown as StoreProviderRegistry,
      rankingAlerts,
      workspace,
      new CrossTenantAccess(workspace),
      { forKeyword } as unknown as CollectionEligibility,
    );
    return {
      service,
      workspace,
      forKeyword,
      search,
      upsert,
      deleteMany,
      createMany,
      withTransaction,
      dispatch,
      trackedFindMany,
    };
  };

  it('records positions for the primary and its competitors from one search', async () => {
    const { service, search, upsert } = setup();

    await service.checkKeyword('kw1');

    expect(search).toHaveBeenCalledTimes(1);
    expect(search).toHaveBeenCalledWith('habit tracker', 'us', RANK_DEPTH);

    const positions = new Map(
      upsert.mock.calls.map(([args]) => [
        args.create.appId,
        args.create.position,
      ]),
    );
    expect(positions.get('primary')).toBe(7);
    expect(positions.get('competitorA')).toBe(31);
    expect(positions.get('competitorB')).toBeNull();
    expect(upsert).toHaveBeenCalledTimes(3);
  });

  it('writes nothing for a workspace the shared search may not collect for', async () => {
    const { service, search, upsert, dispatch } = setup({
      tracked: twoTenants,
      collectableWorkspaces: ['ws_paying'],
      previous: { position: 40 },
    });

    await service.checkKeyword('kw1');

    expect(search).toHaveBeenCalledTimes(1);
    const written = upsert.mock.calls.map(([args]) => args.create.appId);
    expect(written).toEqual(['primary']);
    expect(dispatch).toHaveBeenCalledTimes(1);
  });

  it('asks about every workspace the phrase is tracked by', async () => {
    const { service, forKeyword } = setup({ tracked: twoTenants });

    await service.checkKeyword('kw1');

    const [workspaceIds, keywordId] = forKeyword.mock.calls[0];
    expect(new Set(workspaceIds)).toEqual(
      new Set(['ws_paying', 'ws_suspended']),
    );
    expect(keywordId).toBe('kw1');
  });

  it('skips the search entirely when no workspace may be collected for', async () => {
    const { service, search, upsert } = setup({
      tracked: twoTenants,
      collectableWorkspaces: [],
    });

    await service.checkKeyword('kw1');

    expect(search).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
  });

  it('captures a keyword in its own storefront without filtering apps by home country', async () => {
    const { service, search, trackedFindMany } = setup({ country: 'de' });

    await service.checkKeyword('kw1');

    expect(search).toHaveBeenCalledWith('habit tracker', 'de', RANK_DEPTH);
    const calls = trackedFindMany.mock.calls as Array<
      [{ where: { app: Record<string, unknown> } }]
    >;
    expect(calls[0][0].where.app).toEqual({ store: Store.APP_STORE });
    expect(calls[0][0].where.app).not.toHaveProperty('country');
  });

  it('persists the top ten entries with 1-based positions', async () => {
    const { service, createMany, deleteMany, withTransaction } = setup();

    await service.checkKeyword('kw1');

    expect(withTransaction).toHaveBeenCalledTimes(1);
    expect(deleteMany.mock.calls[0][0].where.keywordId).toBe('kw1');
    expect(deleteMany.mock.calls[0][0].where.date).toBeInstanceOf(Date);
    const entries = createMany.mock.calls[0][0].data;
    expect(entries).toHaveLength(10);
    expect(entries[0].position).toBe(1);
    expect(entries[9].position).toBe(10);
    expect(entries[6].storeAppId).toBe('primary-store');
    expect(entries.every((entry) => entry.keywordId === 'kw1')).toBe(true);
  });

  it('stores position 200 and the captured depth for a complete result set', async () => {
    const searchResults = Array.from({ length: RANK_DEPTH }, (_, index) => ({
      storeAppId: index === RANK_DEPTH - 1 ? 'primary-store' : `other-${index}`,
      title: `Result ${index + 1}`,
    }));
    const { service, upsert } = setup({ searchResults });

    await service.checkKeyword('kw1');

    const writes = new Map(
      upsert.mock.calls.map(([args]) => [args.create.appId, args.create]),
    );
    expect(writes.get('primary')?.position).toBe(RANK_DEPTH);
    expect(writes.get('primary')?.depth).toBe(RANK_DEPTH);
    expect(writes.get('competitorB')?.position).toBeNull();
    expect(writes.get('competitorB')?.depth).toBe(RANK_DEPTH);
  });

  it('replaces rather than duplicates when re-run on the same day', async () => {
    const { service, deleteMany, createMany } = setup();

    await service.checkKeyword('kw1');
    await service.checkKeyword('kw1');

    expect(deleteMany).toHaveBeenCalledTimes(2);
    expect(createMany).toHaveBeenCalledTimes(2);
  });

  it('writes no entries when nothing tracks the keyword', async () => {
    const { service, search, deleteMany, createMany } = setup({ tracked: [] });

    await service.checkKeyword('kw1');

    expect(search).not.toHaveBeenCalled();
    expect(deleteMany).not.toHaveBeenCalled();
    expect(createMany).not.toHaveBeenCalled();
  });

  const primaryOnly = [
    {
      app: {
        id: 'primary',
        workspaceId: 'ws_default',
        storeAppId: 'primary-store',
        competitors: [],
      },
    },
  ];

  it('fires a rank.dropped alert for a drop at or beyond the threshold', async () => {
    const { service, dispatch } = setup({ previous: { position: 1 } });

    await service.checkKeyword('kw1');

    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch.mock.calls[0][0]).toMatchObject({
      event: 'rank.dropped',
      app: { id: 'primary' },
      from: 1,
      to: 7,
      threshold: 5,
    });
  });

  it('does not fire for a move smaller than the threshold', async () => {
    const { service, dispatch } = setup({ previous: { position: 4 } });

    await service.checkKeyword('kw1');

    expect(dispatch).not.toHaveBeenCalled();
  });

  it('fires a rank.dropped alert when the app falls out of view', async () => {
    const { service, dispatch } = setup({
      tracked: [
        {
          app: {
            id: 'primary',
            workspaceId: 'ws_default',
            storeAppId: 'absent-store',
            competitors: [],
          },
        },
      ],
      previous: { position: 3, depth: 100 },
    });

    await service.checkKeyword('kw1');

    expect(dispatch.mock.calls[0][0]).toMatchObject({
      event: 'rank.dropped',
      from: 3,
      to: null,
      fromDepth: 100,
      toDepth: RANK_DEPTH,
    });
  });

  it('fires a rank.improved alert for a rise at or beyond the threshold', async () => {
    const { service, dispatch } = setup({
      tracked: primaryOnly,
      previous: { position: 20 },
    });

    await service.checkKeyword('kw1');

    expect(dispatch.mock.calls[0][0]).toMatchObject({
      event: 'rank.improved',
      from: 20,
      to: 7,
    });
  });

  it('fires a rank.improved alert when the app enters the ranking', async () => {
    const { service, dispatch } = setup({
      tracked: primaryOnly,
      previous: { position: null },
    });

    await service.checkKeyword('kw1');

    expect(dispatch.mock.calls[0][0]).toMatchObject({
      event: 'rank.improved',
      from: null,
      to: 7,
    });
  });

  it('never fires for competitor rows', async () => {
    const { service, dispatch } = setup({ previous: { position: 1 } });

    await service.checkKeyword('kw1');

    for (const [payload] of dispatch.mock.calls) {
      expect(payload).toHaveProperty('app.id', 'primary');
    }
  });

  it('does not double-fire when re-run with the same position on the same day', async () => {
    const { service, dispatch } = setup({
      tracked: primaryOnly,
      previous: { position: 1 },
      existingToday: { position: 7 },
    });

    await service.checkKeyword('kw1');

    expect(dispatch).not.toHaveBeenCalled();
  });

  it('does not fire without a prior ranking', async () => {
    const { service, dispatch } = setup({
      tracked: primaryOnly,
      previous: null,
    });

    await service.checkKeyword('kw1');

    expect(dispatch).not.toHaveBeenCalled();
  });

  const previousTopTen = (...tail: string[]) =>
    [
      'other-1',
      'other-2',
      'other-3',
      'other-4',
      'other-5',
      'other-6',
      'primary-store',
      'other-8',
      ...tail,
    ].map((storeAppId) => ({ storeAppId, title: storeAppId }));

  it('does not fire a serp.entrant alert without a previous snapshot', async () => {
    const { service, dispatch } = setup({
      tracked: primaryOnly,
      previous: null,
      previousSerp: null,
    });

    await service.checkKeyword('kw1');

    expect(dispatch).not.toHaveBeenCalled();
  });

  it('fires one serp.entrant payload listing every new arrival', async () => {
    const { service, dispatch } = setup({
      tracked: primaryOnly,
      previous: null,
      previousSerp: previousTopTen('stale-a', 'stale-b'),
      knownApps: [
        { id: 'competitorA', storeAppId: 'other-9', isCompetitor: true },
      ],
    });

    await service.checkKeyword('kw1');

    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch.mock.calls[0][0]).toMatchObject({
      event: 'serp.entrant',
      keyword: { id: 'kw1', text: 'habit tracker' },
      entrants: [
        {
          position: 9,
          storeAppId: 'other-9',
          appId: 'competitorA',
          isCompetitor: true,
        },
        {
          position: 10,
          storeAppId: 'other-10',
          appId: null,
          isCompetitor: false,
        },
      ],
    });
  });

  it('does not re-fire serp.entrant when re-run on the same day', async () => {
    const { service, dispatch } = setup({
      tracked: primaryOnly,
      previous: null,
      previousSerp: previousTopTen('stale-a', 'stale-b'),
      sameDaySerp: previousTopTen('other-9', 'other-10'),
    });

    await service.checkKeyword('kw1');

    expect(dispatch).not.toHaveBeenCalled();
  });

  it('fires only the arrivals since the same-day snapshot on a re-run', async () => {
    const { service, dispatch } = setup({
      tracked: primaryOnly,
      previous: null,
      previousSerp: previousTopTen('stale-a', 'stale-b'),
      sameDaySerp: previousTopTen('other-9', 'gone-today'),
    });

    await service.checkKeyword('kw1');

    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch.mock.calls[0][0]).toMatchObject({
      event: 'serp.entrant',
      entrants: [{ position: 10, storeAppId: 'other-10' }],
    });
  });

  it('does not fire a serp.entrant alert when the top ten is unchanged', async () => {
    const { service, dispatch } = setup({
      tracked: primaryOnly,
      previous: null,
      previousSerp: previousTopTen('other-9', 'other-10'),
    });

    await service.checkKeyword('kw1');

    expect(dispatch).not.toHaveBeenCalled();
  });

  it('serves every workspace tracking the phrase from one search', async () => {
    const { service, workspace, search, upsert } = setup({
      tracked: [
        {
          app: {
            id: 'a-primary',
            workspaceId: 'ws_a',
            storeAppId: 'primary-store',
            competitors: [],
          },
        },
        {
          app: {
            id: 'b-primary',
            workspaceId: 'ws_b',
            storeAppId: 'competitor-store',
            competitors: [],
          },
        },
      ],
    });
    const scopes: (string | undefined)[] = [];
    upsert.mockImplementation(() => {
      scopes.push(workspace.current);
      return Promise.resolve();
    });

    await service.checkKeyword('kw1');

    expect(search).toHaveBeenCalledTimes(1);
    expect(scopes).toEqual(['ws_a', 'ws_b']);
    expect(
      upsert.mock.calls.map(
        ([args]) =>
          (args as unknown as { create: Record<string, unknown> }).create,
      ),
    ).toEqual([
      expect.objectContaining({ appId: 'a-primary', workspaceId: 'ws_a' }),
      expect.objectContaining({ appId: 'b-primary', workspaceId: 'ws_b' }),
    ]);
  });

  it('refuses to record a not-ranking history from a search that suddenly returned nothing', async () => {
    const { service, upsert, withTransaction } = setup({
      searchResults: [],
      previousSerp: [{ storeAppId: 'primary-store', title: 'Primary' }],
    });

    await expect(service.checkKeyword('kw1')).rejects.toThrow(
      ImplausibleResultError,
    );

    expect(upsert).not.toHaveBeenCalled();
    expect(withTransaction).not.toHaveBeenCalled();
  });

  it('accepts an empty result for a phrase that has never ranked anything', async () => {
    const { service, upsert } = setup({
      searchResults: [],
      previousSerp: null,
    });

    await service.checkKeyword('kw1');

    expect(upsert).toHaveBeenCalled();
  });
});
