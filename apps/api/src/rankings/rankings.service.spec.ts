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
import {
  EMPTY_ANSWER_RETRIES,
  IMPLAUSIBLE_LOOKBACK_DAYS,
} from '../store-providers/result-plausibility';
import { StoreProviderRegistry } from '../store-providers/store-provider.registry';
import { SearchItem } from '../store-providers/types';
import { EarlierRankings } from './earlier-rankings';
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

const earlierChecks = (options?: {
  earlier?: { position: number | null; depth?: number }[];
}) =>
  jest
    .fn<
      Promise<{ position: number | null; depth: number }[]>,
      [string, string, Date]
    >()
    .mockResolvedValue(
      (options?.earlier ?? []).map((row) => ({ depth: RANK_DEPTH, ...row })),
    );

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
    earlier?: { position: number | null; depth?: number }[];
    existingToday?: { position: number | null } | null;
    threshold?: number;
    country?: string;
    previousSerp?: SerpFixture[] | null;
    sameDaySerp?: SerpFixture[] | null;
    knownApps?: { id: string; storeAppId: string; isCompetitor: boolean }[];
    searchResults?: SearchItem[];
    collectableWorkspaces?: string[] | null;
    rankedEarlier?: { date: Date } | null;
    competitorsPrevious?: { appId: string; position: number | null }[];
    existingByApp?: Record<string, { position: number | null }>;
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
      .fn<
        Promise<{ position: number | null } | null>,
        [{ where: { appId_keywordId_date: { appId: string } } }]
      >()
      .mockImplementation(({ where }) =>
        Promise.resolve(
          options?.existingByApp?.[where.appId_keywordId_date.appId] ??
            options?.existingToday ??
            null,
        ),
      );
    const previousRow = options?.previous
      ? { date: PREVIOUS_DAY, depth: RANK_DEPTH, ...options.previous }
      : null;
    const rankingFindFirst = jest
      .fn<Promise<unknown>, [{ where: { position?: unknown } }]>()
      .mockImplementation(({ where }) =>
        Promise.resolve(
          where.position === undefined
            ? previousRow
            : (options?.rankedEarlier ?? null),
        ),
      );
    const rankingFindMany = jest
      .fn<Promise<{ appId: string; position: number | null }[]>, [unknown]>()
      .mockResolvedValue(options?.competitorsPrevious ?? []);
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
    const serpFindFirst = jest
      .fn()
      .mockResolvedValue(options?.previousSerp ? { date: PREVIOUS_DAY } : null);
    const keywordFindUnique = jest.fn().mockResolvedValue({
      id: 'kw1',
      text: 'habit tracker',
      store: Store.APP_STORE,
      country: options?.country ?? 'us',
    });
    const prisma = {
      keyword: {
        findUnique: keywordFindUnique,
      },
      trackedKeyword: {
        findMany: trackedFindMany,
      },
      keywordRanking: {
        upsert,
        findUnique: rankingFindUnique,
        findFirst: rankingFindFirst,
        findMany: rankingFindMany,
      },
      serpEntry: {
        deleteMany,
        createMany,
        findFirst: serpFindFirst,
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
    const earlierBefore = earlierChecks(options);
    const rankingAlerts = new RankingAlertsService(
      prisma as unknown as PrismaService,
      config,
      alerts,
      { before: earlierBefore } as unknown as EarlierRankings,
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
      keywordFindUnique,
      serpFindFirst,
      rankingFindFirst,
      rankingFindMany,
      earlierBefore,
    };
  };

  const dispatched = (dispatch: jest.Mock<Promise<void>, [AlertPayload]>) =>
    dispatch.mock.calls.map(([payload]) => payload);

  const placed = (placements: Record<string, number>): SearchItem[] =>
    Array.from({ length: 40 }, (_, index) => {
      const hit = Object.keys(placements).find(
        (storeAppId) => placements[storeAppId] === index + 1,
      );
      const storeAppId = hit ?? `other-${index + 1}`;
      return { storeAppId, title: storeAppId };
    });

  const withRival = [
    {
      app: {
        id: 'primary',
        name: 'Mine',
        workspaceId: 'ws_default',
        storeAppId: 'primary-store',
        competitors: [
          {
            id: 'competitorA',
            name: 'Rival A',
            workspaceId: 'ws_default',
            storeAppId: 'competitor-store',
          },
        ],
      },
    },
  ];

  const rivalAhead = {
    tracked: withRival,
    searchResults: placed({ 'primary-store': 6, 'competitor-store': 4 }),
    previous: { position: 5 },
    competitorsPrevious: [{ appId: 'competitorA', position: 9 }],
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
    expect(dispatched(dispatch)).toEqual([
      expect.objectContaining({
        event: 'rank.improved',
        app: { id: 'primary', name: 'Mine' },
      }),
      expect.objectContaining({
        event: 'rank.milestone',
        app: { id: 'primary', name: 'Mine' },
      }),
    ]);
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

  it('persists the icon each serp entry was found with', async () => {
    const icon = 'https://is1-ssl.mzstatic.com/image/thumb/a/512x512bb.jpg';
    const { service, createMany } = setup({
      searchResults: [
        { storeAppId: 'with-icon', title: 'With icon', iconUrl: icon },
        { storeAppId: 'without-icon', title: 'Without icon' },
      ],
    });

    await service.checkKeyword('kw1');

    expect(createMany.mock.calls[0][0].data).toEqual([
      expect.objectContaining({ storeAppId: 'with-icon', iconUrl: icon }),
      expect.objectContaining({ storeAppId: 'without-icon', iconUrl: null }),
    ]);
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

    expect(dispatched(dispatch).map((payload) => payload.event)).toEqual([
      'rank.dropped',
      'rank.milestone',
    ]);
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

  describe('a search that suddenly returns nothing', () => {
    const settled = async (work: Promise<void>): Promise<unknown> => {
      const outcome = work.then(
        () => undefined,
        (error: unknown) => error,
      );
      await jest.runAllTimersAsync();
      return outcome;
    };

    it('reads no ranking history before a search that answers with results', async () => {
      const { service, search, serpFindFirst } = setup({
        previousSerp: [{ storeAppId: 'primary-store', title: 'Primary' }],
      });

      await service.checkKeyword('kw1');

      const searched = search.mock.invocationCallOrder[0];
      expect(
        serpFindFirst.mock.invocationCallOrder.filter(
          (order) => order < searched,
        ),
      ).toEqual([]);
    });

    it('asks the app store again and records the answer that has results', async () => {
      const { service, search, upsert } = setup({
        previousSerp: [{ storeAppId: 'primary-store', title: 'Primary' }],
      });
      search.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

      expect(await settled(service.checkKeyword('kw1'))).toBeUndefined();

      expect(search).toHaveBeenCalledTimes(3);
      expect(
        upsert.mock.calls.map(([{ create }]) => [
          create.appId,
          create.position,
        ]),
      ).toContainEqual(['primary', 7]);
    });

    it('leaves an app store search that stays empty to the queue to retry', async () => {
      const { service, search, upsert, withTransaction } = setup({
        searchResults: [],
        previousSerp: [{ storeAppId: 'primary-store', title: 'Primary' }],
      });

      expect(await settled(service.checkKeyword('kw1'))).toMatchObject({
        constructor: ImplausibleResultError,
        retryable: true,
        message:
          'APP_STORE returned an implausible result: "habit tracker" returned no results in us but ranked apps on 2026-07-17',
      });

      expect(search).toHaveBeenCalledTimes(1 + EMPTY_ANSWER_RETRIES.APP_STORE);
      expect(upsert).not.toHaveBeenCalled();
      expect(withTransaction).not.toHaveBeenCalled();
    });

    it('settles an app store search still empty on the last attempt without writing anything', async () => {
      const { service, search, upsert, withTransaction } = setup({
        searchResults: [],
        previousSerp: [{ storeAppId: 'primary-store', title: 'Primary' }],
      });

      expect(await settled(service.checkKeyword('kw1', true))).toBeUndefined();

      expect(search).toHaveBeenCalledTimes(1 + EMPTY_ANSWER_RETRIES.APP_STORE);
      expect(upsert).not.toHaveBeenCalled();
      expect(withTransaction).not.toHaveBeenCalled();
    });

    it('refuses an empty google play search at once, as a soft block', async () => {
      const { service, search, upsert, keywordFindUnique } = setup({
        searchResults: [],
        previousSerp: [{ storeAppId: 'primary-store', title: 'Primary' }],
      });
      keywordFindUnique.mockResolvedValue({
        id: 'kw1',
        text: 'habit tracker',
        store: Store.GOOGLE_PLAY,
        country: 'us',
      });

      expect(await settled(service.checkKeyword('kw1'))).toMatchObject({
        constructor: ImplausibleResultError,
        retryable: false,
      });

      expect(search).toHaveBeenCalledTimes(1);
      expect(upsert).not.toHaveBeenCalled();
    });

    it('still refuses an empty google play search on the last attempt', async () => {
      const { service, upsert, keywordFindUnique } = setup({
        searchResults: [],
        previousSerp: [{ storeAppId: 'primary-store', title: 'Primary' }],
      });
      keywordFindUnique.mockResolvedValue({
        id: 'kw1',
        text: 'habit tracker',
        store: Store.GOOGLE_PLAY,
        country: 'us',
      });

      expect(await settled(service.checkKeyword('kw1', true))).toMatchObject({
        constructor: ImplausibleResultError,
        retryable: false,
      });

      expect(upsert).not.toHaveBeenCalled();
    });

    it('accepts it at once for a phrase that stopped ranking anything over a week ago', async () => {
      const { service, search, upsert, serpFindFirst } = setup({
        searchResults: [],
      });
      serpFindFirst.mockResolvedValue({
        date: utcDayStart(FROZEN_NOW, -(IMPLAUSIBLE_LOOKBACK_DAYS + 1)),
      });

      await service.checkKeyword('kw1');

      expect(search).toHaveBeenCalledTimes(1);
      expect(upsert).toHaveBeenCalled();
    });

    it('accepts it at once for a phrase that has never ranked anything', async () => {
      const { service, search, upsert } = setup({
        searchResults: [],
        previousSerp: null,
      });

      await service.checkKeyword('kw1');

      expect(search).toHaveBeenCalledTimes(1);
      expect(upsert).toHaveBeenCalled();
    });
  });

  describe('milestone, first rank and overtake alerts', () => {
    const events = (dispatch: jest.Mock<Promise<void>, [AlertPayload]>) =>
      dispatched(dispatch).map((payload) => payload.event);

    it('reports entering the top 10 beside the rank improvement', async () => {
      const { service, dispatch } = setup({
        tracked: primaryOnly,
        previous: { position: 14 },
      });

      await service.checkKeyword('kw1');

      expect(events(dispatch)).toEqual(['rank.improved', 'rank.milestone']);
      expect(dispatched(dispatch)[1]).toMatchObject({
        tier: 10,
        direction: 'entered',
        from: 14,
        to: 7,
        fromDepth: 200,
        toDepth: 200,
      });
    });

    it('reports reaching first place from a move of one place', async () => {
      const { service, dispatch } = setup({
        tracked: primaryOnly,
        searchResults: placed({ 'primary-store': 1 }),
        previous: { position: 2 },
      });

      await service.checkKeyword('kw1');

      expect(dispatched(dispatch)).toEqual([
        expect.objectContaining({
          event: 'rank.milestone',
          tier: 1,
          direction: 'entered',
        }),
      ]);
    });

    it('reports losing first place', async () => {
      const { service, dispatch } = setup({
        tracked: primaryOnly,
        searchResults: placed({ 'primary-store': 2 }),
        previous: { position: 1 },
      });

      await service.checkKeyword('kw1');

      expect(dispatched(dispatch)).toEqual([
        expect.objectContaining({
          event: 'rank.milestone',
          tier: 1,
          direction: 'left',
          from: 1,
          to: 2,
        }),
      ]);
    });

    it('reports a first ranking instead of a milestone', async () => {
      const { service, dispatch, rankingFindFirst } = setup({
        tracked: primaryOnly,
        previous: { position: null },
      });

      await service.checkKeyword('kw1');

      expect(events(dispatch)).toEqual(['rank.improved', 'rank.first']);
      expect(dispatched(dispatch)[1]).toMatchObject({
        position: 7,
        depth: 200,
      });
      expect(rankingFindFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            appId: 'primary',
            keywordId: 'kw1',
            date: { lt: utcDayStart(FROZEN_NOW) },
            position: { not: null },
          },
        }),
      );
    });

    it('reports a milestone when the app ranked before the previous check', async () => {
      const { service, dispatch } = setup({
        tracked: primaryOnly,
        previous: { position: null },
        rankedEarlier: { date: PREVIOUS_DAY },
      });

      await service.checkKeyword('kw1');

      expect(events(dispatch)).toEqual(['rank.improved', 'rank.milestone']);
      expect(dispatched(dispatch)[1]).toMatchObject({
        tier: 10,
        direction: 'entered',
      });
    });

    it('reports a competitor that moved ahead of the app', async () => {
      const { service, dispatch, rankingFindMany } = setup(rivalAhead);

      await service.checkKeyword('kw1');

      expect(dispatched(dispatch)).toEqual([
        expect.objectContaining({
          event: 'rank.overtaken',
          app: { id: 'primary', name: 'Mine' },
          competitor: { id: 'competitorA', name: 'Rival A', from: 9, to: 4 },
          from: 5,
          to: 6,
        }),
      ]);
      expect(rankingFindMany).toHaveBeenCalledTimes(1);
      expect(rankingFindMany).toHaveBeenCalledWith({
        where: {
          keywordId: 'kw1',
          date: PREVIOUS_DAY,
          appId: { in: ['competitorA'] },
        },
        select: { appId: true, position: true },
      });
    });

    it('skips a competitor with no row at the previous check', async () => {
      const { service, dispatch } = setup({
        ...rivalAhead,
        competitorsPrevious: [],
      });

      await service.checkKeyword('kw1');

      expect(dispatch).not.toHaveBeenCalled();
    });

    it('reports an overtake when the app falls out of view', async () => {
      const { service, dispatch } = setup({
        ...rivalAhead,
        searchResults: placed({ 'competitor-store': 4 }),
      });

      await service.checkKeyword('kw1');

      expect(events(dispatch)).toEqual([
        'rank.dropped',
        'rank.milestone',
        'rank.overtaken',
      ]);
      expect(dispatched(dispatch)[1]).toMatchObject({
        tier: 10,
        direction: 'left',
      });
      expect(dispatched(dispatch)[2]).toMatchObject({ to: null });
    });

    it('never reads competitors when the app was unranked before', async () => {
      const { service, dispatch, rankingFindMany } = setup({
        ...rivalAhead,
        previous: { position: null },
        rankedEarlier: { date: PREVIOUS_DAY },
      });

      await service.checkKeyword('kw1');

      expect(events(dispatch)).toEqual(['rank.improved', 'rank.milestone']);
      expect(rankingFindMany).not.toHaveBeenCalled();
    });

    it('reports an overtake from a re-run where only the competitor moved', async () => {
      const { service, dispatch } = setup({
        ...rivalAhead,
        existingByApp: {
          primary: { position: 6 },
          competitorA: { position: 9 },
        },
      });

      await service.checkKeyword('kw1');

      expect(events(dispatch)).toEqual(['rank.overtaken']);
    });

    it('dispatches nothing from a re-run where nothing moved', async () => {
      const { service, dispatch, rankingFindFirst, rankingFindMany } = setup({
        ...rivalAhead,
        existingByApp: {
          primary: { position: 6 },
          competitorA: { position: 4 },
        },
      });

      await service.checkKeyword('kw1');

      expect(dispatch).not.toHaveBeenCalled();
      expect(rankingFindFirst).not.toHaveBeenCalled();
      expect(rankingFindMany).not.toHaveBeenCalled();
    });

    it('dispatches nothing on the first ever capture', async () => {
      const { service, dispatch, rankingFindMany } = setup({
        tracked: withRival,
        searchResults: placed({ 'primary-store': 6, 'competitor-store': 4 }),
      });

      await service.checkKeyword('kw1');

      expect(dispatch).not.toHaveBeenCalled();
      expect(rankingFindMany).not.toHaveBeenCalled();
    });
  });
  describe('confirmed drops', () => {
    const confirmedCheck = (options: {
      earlier: { position: number | null }[];
      previous: number;
      today: number | null;
      existingToday?: { position: number | null };
    }) =>
      setup({
        tracked: primaryOnly,
        earlier: options.earlier,
        previous: { position: options.previous },
        existingToday: options.existingToday,
        searchResults: placed(
          options.today === null ? {} : { 'primary-store': options.today },
        ),
      });

    it('confirms a leave that holds', async () => {
      const { service, dispatch } = confirmedCheck({
        earlier: [{ position: 9 }],
        previous: 11,
        today: 12,
      });

      await service.checkKeyword('kw1');

      expect(dispatched(dispatch)).toEqual([
        expect.objectContaining({
          event: 'rank.milestone',
          tier: 10,
          direction: 'left',
          from: 9,
          to: 12,
          fromDepth: 200,
          toDepth: 200,
          confirmed: true,
        }),
      ]);
    });

    it('marks the return of a one day wobble as undoing', async () => {
      const { service, dispatch } = confirmedCheck({
        earlier: [{ position: 9 }],
        previous: 11,
        today: 9,
      });

      await service.checkKeyword('kw1');

      const payloads = dispatched(dispatch);
      expect(payloads).toEqual([
        expect.objectContaining({
          event: 'rank.milestone',
          tier: 10,
          direction: 'entered',
          undoesDrop: true,
        }),
      ]);
      expect(payloads[0]).not.toHaveProperty('confirmed');
    });

    it('confirms a threshold drop and the exit it caused', async () => {
      const { service, dispatch } = confirmedCheck({
        earlier: [{ position: 9 }],
        previous: 15,
        today: 15,
      });

      await service.checkKeyword('kw1');

      expect(dispatched(dispatch)).toEqual([
        expect.objectContaining({
          event: 'rank.dropped',
          from: 9,
          to: 15,
          confirmed: true,
        }),
        expect.objectContaining({
          event: 'rank.milestone',
          tier: 10,
          direction: 'left',
          confirmed: true,
        }),
      ]);
    });

    it('raises the ordinary drop beside the confirmed exit of a deepening fall', async () => {
      const { service, dispatch } = confirmedCheck({
        earlier: [{ position: 9 }],
        previous: 11,
        today: 20,
      });

      await service.checkKeyword('kw1');

      const payloads = dispatched(dispatch);
      expect(payloads).toEqual([
        expect.objectContaining({ event: 'rank.dropped', from: 11, to: 20 }),
        expect.objectContaining({
          event: 'rank.milestone',
          tier: 10,
          direction: 'left',
          from: 9,
          to: 20,
          confirmed: true,
        }),
      ]);
      expect(payloads[0]).not.toHaveProperty('confirmed');
    });

    it('marks both events of a recovery as undoing', async () => {
      const { service, dispatch } = confirmedCheck({
        earlier: [{ position: 9 }],
        previous: 20,
        today: 9,
      });

      await service.checkKeyword('kw1');

      expect(dispatched(dispatch)).toEqual([
        expect.objectContaining({
          event: 'rank.improved',
          from: 20,
          to: 9,
          undoesDrop: true,
        }),
        expect.objectContaining({
          event: 'rank.milestone',
          tier: 10,
          direction: 'entered',
          undoesDrop: true,
        }),
      ]);
    });

    it('leaves a recovery after a reported fall unmarked', async () => {
      const { service, dispatch } = confirmedCheck({
        earlier: [{ position: 11 }, { position: 9 }],
        previous: 20,
        today: 15,
      });

      await service.checkKeyword('kw1');

      const payloads = dispatched(dispatch);
      expect(payloads).toEqual([
        expect.objectContaining({ event: 'rank.improved', from: 20, to: 15 }),
      ]);
      expect(payloads[0]).not.toHaveProperty('undoesDrop');
    });

    it('leaves a rise past where a pending drop began unmarked', async () => {
      const { service, dispatch } = confirmedCheck({
        earlier: [{ position: 20 }],
        previous: 30,
        today: 8,
      });

      await service.checkKeyword('kw1');

      const payloads = dispatched(dispatch);
      expect(payloads).toEqual([
        expect.objectContaining({ event: 'rank.improved', from: 30, to: 8 }),
        expect.objectContaining({
          event: 'rank.milestone',
          tier: 10,
          direction: 'entered',
        }),
      ]);
      expect(payloads[0]).not.toHaveProperty('undoesDrop');
      expect(payloads[1]).not.toHaveProperty('undoesDrop');
    });

    it('confirms an exit when the app is not found today', async () => {
      const { service, dispatch } = confirmedCheck({
        earlier: [{ position: 9 }],
        previous: 11,
        today: null,
      });

      await service.checkKeyword('kw1');

      const payloads = dispatched(dispatch);
      expect(payloads).toEqual([
        expect.objectContaining({ event: 'rank.dropped', from: 11, to: null }),
        expect.objectContaining({
          event: 'rank.milestone',
          tier: 10,
          direction: 'left',
          from: 9,
          to: null,
          confirmed: true,
        }),
      ]);
      expect(payloads[0]).not.toHaveProperty('confirmed');
    });

    it('reports a fall that keeps going only once', async () => {
      const { service, dispatch } = confirmedCheck({
        earlier: [{ position: 15 }, { position: 9 }],
        previous: 21,
        today: 30,
      });

      await service.checkKeyword('kw1');

      const payloads = dispatched(dispatch);
      expect(payloads).toEqual([
        expect.objectContaining({ event: 'rank.dropped', from: 21, to: 30 }),
      ]);
      expect(payloads[0]).not.toHaveProperty('confirmed');
    });

    it('confirms nothing on the second check of a keyword', async () => {
      const { service, dispatch } = confirmedCheck({
        earlier: [],
        previous: 11,
        today: 12,
      });

      await service.checkKeyword('kw1');

      expect(dispatch).not.toHaveBeenCalled();
    });

    it('confirms nothing on the first check of a keyword', async () => {
      const { service, dispatch, earlierBefore } = setup({
        tracked: primaryOnly,
        previous: null,
        earlier: [{ position: 9 }],
        searchResults: placed({ 'primary-store': 12 }),
      });

      await service.checkKeyword('kw1');

      expect(dispatch).not.toHaveBeenCalled();
      expect(earlierBefore).not.toHaveBeenCalled();
    });

    it('stays silent on an unchanged same day recheck', async () => {
      const { service, dispatch } = confirmedCheck({
        earlier: [{ position: 9 }],
        previous: 11,
        today: 12,
        existingToday: { position: 12 },
      });

      await service.checkKeyword('kw1');

      expect(dispatch).not.toHaveBeenCalled();
    });

    it('starts the window at the previous check for both alerts', async () => {
      const { service, earlierBefore } = confirmedCheck({
        earlier: [{ position: 9 }],
        previous: 11,
        today: 12,
      });

      await service.checkKeyword('kw1');

      expect(earlierBefore.mock.calls).toEqual([
        ['primary', 'kw1', PREVIOUS_DAY],
        ['primary', 'kw1', PREVIOUS_DAY],
      ]);
    });
  });
});
