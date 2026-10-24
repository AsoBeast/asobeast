import { Queue } from 'bullmq';
import { Store } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { QuotaService } from '../auth/quota.service';
import { WorkspaceContext } from '../common/tenancy/workspace-context';
import { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { FirstPositionChecks } from './first-position-checks';
import { KeywordTracker } from './keyword-tracker';
import { KeywordsService } from './keywords.service';
import { MarketListingRequests } from './market-listing.requests';

const quotaOff = (prisma: PrismaService) =>
  new QuotaService(prisma, new WorkspaceContext(), {
    get: (key: string) => (key === 'BILLING_ENABLED' ? false : null),
  } as unknown as ConfigService<Env, true>);

describe('KeywordsService.syncFromSnapshot', () => {
  const buildQueue = () => ({ add: jest.fn() });

  const buildService = (prisma: unknown, queue: { add: jest.Mock }) =>
    new KeywordsService(
      prisma as PrismaService,
      new KeywordTracker(
        prisma as PrismaService,
        queue as unknown as Queue,
        queue as unknown as Queue,
        new WorkspaceContext(),
      ),
      quotaOff(prisma as PrismaService),
      { request: jest.fn() } as unknown as MarketListingRequests,
      { schedule: jest.fn() } as unknown as FirstPositionChecks,
    );

  const buildPrisma = () => {
    const created: { text: string }[] = [];
    return {
      keywordMetric: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      app: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'app1',
          store: Store.APP_STORE,
          country: 'us',
          isCompetitor: false,
        }),
      },
      appSnapshot: {
        findFirst: jest.fn().mockResolvedValue({
          title: 'Zombie Castle Defense',
          subtitle: 'Tower strategy game',
          summary: 'markdown editor notes',
        }),
      },
      keyword: {
        createMany: jest
          .fn<Promise<{ count: number }>, [{ data: { text: string }[] }]>()
          .mockImplementation(({ data }) => {
            created.push(...data);
            return Promise.resolve({ count: data.length });
          }),
        findMany: jest.fn().mockImplementation(() =>
          Promise.resolve(
            created.map((keyword, index) => ({
              id: `kw${index + 1}`,
              text: keyword.text,
            })),
          ),
        ),
      },
      trackedKeyword: {
        createMany: jest.fn<
          Promise<{ count: number }>,
          [
            {
              data: { source: string; active: boolean }[];
              skipDuplicates: boolean;
            },
          ]
        >(),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };
  };

  it('tracks phrases of the native localization first, then the default, in turn', async () => {
    const prisma = buildPrisma();
    prisma.app.findUnique.mockResolvedValue({
      id: 'app1',
      store: Store.APP_STORE,
      country: 'pl',
      isCompetitor: false,
    });
    prisma.appSnapshot.findFirst.mockImplementation(
      ({ where }: { where: { localization: string | null } }) =>
        Promise.resolve(
          where.localization === 'pl'
            ? {
                title: 'Quiz Geograficzny',
                subtitle: 'Mapa Świata',
                summary: null,
              }
            : {
                title: 'GeoGuess Map Quiz',
                subtitle: 'Geography Trivia',
                summary: null,
              },
        ),
    );
    const service = buildService(prisma, buildQueue());

    await service.syncFromSnapshot('app1');

    const [{ data }] = prisma.keyword.createMany.mock.calls[0];
    const texts = data.map((row) => row.text);
    expect(texts).toContain('quiz geograficzny');
    expect(texts).toContain('geoguess map quiz');
    expect(texts.length).toBeLessThanOrEqual(15);
    expect(prisma.appSnapshot.findFirst).toHaveBeenCalledTimes(2);
  });

  it('skips the function words of a spanish google play listing', async () => {
    const prisma = buildPrisma();
    prisma.app.findUnique.mockResolvedValue({
      id: 'app1',
      store: Store.GOOGLE_PLAY,
      country: 'ar',
      isCompetitor: false,
    });
    prisma.appSnapshot.findFirst.mockResolvedValue({
      title: 'Preguntados: Juegos de Trivia',
      subtitle: null,
      summary:
        'Juegos para aumentar tu iq: quiz de preguntas gratis para amigos y familia',
    });
    const service = buildService(prisma, buildQueue());

    await service.syncFromSnapshot('app1');

    const [{ data }] = prisma.keyword.createMany.mock.calls[0];
    const texts = data.map((row) => row.text);
    expect(texts).toEqual(
      expect.arrayContaining([
        'preguntados',
        'juegos',
        'trivia',
        'juegos trivia',
      ]),
    );
    expect(texts.filter((text) => /(^| )(de|para|tu)( |$)/.test(text))).toEqual(
      [],
    );
  });

  it('reads a google play listing in canada as english', async () => {
    const prisma = buildPrisma();
    prisma.app.findUnique.mockResolvedValue({
      id: 'app1',
      store: Store.GOOGLE_PLAY,
      country: 'ca',
      isCompetitor: false,
    });
    prisma.appSnapshot.findFirst.mockResolvedValue({
      title: 'LA Fitness Mobile',
      subtitle: null,
      summary: null,
    });
    const service = buildService(prisma, buildQueue());

    await service.syncFromSnapshot('app1');

    const [{ data }] = prisma.keyword.createMany.mock.calls[0];
    expect(data.map((row) => row.text)).toContain('la fitness');
  });

  it('skips the function words of the french localization of a canadian listing', async () => {
    const prisma = buildPrisma();
    prisma.app.findUnique.mockResolvedValue({
      id: 'app1',
      store: Store.APP_STORE,
      country: 'ca',
      isCompetitor: false,
    });
    prisma.appSnapshot.findFirst.mockImplementation(
      ({ where }: { where: { localization: string | null } }) =>
        Promise.resolve(
          where.localization === 'fr-CA'
            ? {
                title: 'Crave',
                subtitle: 'Séries, films et plus encore',
                summary: null,
              }
            : {
                title: 'Crave',
                subtitle: 'Shows, movies and more',
                summary: null,
              },
        ),
    );
    const service = buildService(prisma, buildQueue());

    await service.syncFromSnapshot('app1');

    const [{ data }] = prisma.keyword.createMany.mock.calls[0];
    const texts = data.map((row) => row.text);
    expect(texts).toEqual(expect.arrayContaining(['séries', 'films']));
    expect(texts.filter((text) => /(^| )et( |$)/.test(text))).toEqual([]);
  });

  it('reads the english default of a canadian listing that has a french localization as english', async () => {
    const prisma = buildPrisma();
    prisma.app.findUnique.mockResolvedValue({
      id: 'app1',
      store: Store.APP_STORE,
      country: 'ca',
      isCompetitor: false,
    });
    prisma.appSnapshot.findFirst.mockImplementation(
      ({ where }: { where: { localization: string | null } }) =>
        Promise.resolve(
          where.localization === 'fr-CA'
            ? { title: 'LA Fitness', subtitle: 'Gym et cours', summary: null }
            : {
                title: 'LA Fitness',
                subtitle: 'Gym and classes',
                summary: null,
              },
        ),
    );
    const service = buildService(prisma, buildQueue());

    await service.syncFromSnapshot('app1');

    const [{ data }] = prisma.keyword.createMany.mock.calls[0];
    const texts = data.map((row) => row.text);
    expect(texts).toEqual(expect.arrayContaining(['la fitness', 'gym cours']));
    expect(texts.filter((text) => /(^| )et( |$)/.test(text))).toEqual([]);
  });

  it('reads the default of a danish listing without a danish localization as danish', async () => {
    const prisma = buildPrisma();
    prisma.app.findUnique.mockResolvedValue({
      id: 'app1',
      store: Store.APP_STORE,
      country: 'dk',
      isCompetitor: false,
    });
    prisma.appSnapshot.findFirst.mockImplementation(
      ({ where }: { where: { localization: string | null } }) =>
        Promise.resolve(
          where.localization === null
            ? {
                title: 'DRTV',
                subtitle: 'Programmer og kanaler',
                summary: null,
              }
            : null,
        ),
    );
    const service = buildService(prisma, buildQueue());

    await service.syncFromSnapshot('app1');

    const [{ data }] = prisma.keyword.createMany.mock.calls[0];
    const texts = data.map((row) => row.text);
    expect(texts).toContain('programmer kanaler');
    expect(texts.filter((text) => /(^| )og( |$)/.test(text))).toEqual([]);
  });

  it('reads only the default listing of a storefront without a native localization', async () => {
    const prisma = buildPrisma();
    const service = buildService(prisma, buildQueue());

    await service.syncFromSnapshot('app1');

    expect(prisma.appSnapshot.findFirst).toHaveBeenCalledTimes(1);
    expect(prisma.appSnapshot.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { appId: 'app1', country: null, localization: null },
      }),
    );
  });

  it('tracks only title and subtitle candidates without touching existing rows', async () => {
    const prisma = buildPrisma();
    const service = buildService(prisma, buildQueue());

    await service.syncFromSnapshot('app1');

    const [tracked] = prisma.trackedKeyword.createMany.mock.calls[0];
    const trackedSources = tracked.data.map((row) => row.source);
    expect(trackedSources).toContain('TITLE');
    expect(trackedSources).toContain('SUBTITLE');
    expect(trackedSources).not.toContain('DESCRIPTION');

    for (const row of tracked.data) {
      expect(row.active).toBe(true);
    }
    expect(tracked.skipDuplicates).toBe(true);
    expect(prisma.keyword.createMany.mock.calls[0][0].skipDuplicates).toBe(
      true,
    );
  });

  it('creates keyword rows in text order whatever order the snapshot yields them', async () => {
    const prisma = buildPrisma();
    const service = buildService(prisma, buildQueue());

    await service.syncFromSnapshot('app1');

    const [{ data }] = prisma.keyword.createMany.mock.calls[0];
    const texts = data.map((row) => row.text);
    expect(texts.length).toBeGreaterThan(1);
    expect(texts).toEqual([...texts].sort());
  });

  it('tracks title and summary candidates for google play, not subtitle', async () => {
    const prisma = buildPrisma();
    prisma.app.findUnique.mockResolvedValue({
      id: 'app1',
      store: Store.GOOGLE_PLAY,
      country: 'us',
      isCompetitor: false,
    });
    const service = buildService(prisma, buildQueue());

    await service.syncFromSnapshot('app1');

    const [tracked] = prisma.trackedKeyword.createMany.mock.calls[0];
    const trackedSources = tracked.data.map((row) => row.source);
    expect(trackedSources).toContain('TITLE');
    expect(trackedSources).toContain('DESCRIPTION');
    expect(trackedSources).not.toContain('SUBTITLE');
  });

  it('caps auto tracked keywords at 15', async () => {
    const prisma = buildPrisma();
    prisma.appSnapshot.findFirst.mockResolvedValue({
      title: 'alpha bravo charlie delta echo foxtrot golf hotel india juliet',
      subtitle: 'kilo lima mike november oscar papa quebec romeo sierra tango',
      summary: null,
    });
    const service = buildService(prisma, buildQueue());

    await service.syncFromSnapshot('app1');

    expect(prisma.trackedKeyword.createMany.mock.calls[0][0].data).toHaveLength(
      15,
    );
  });

  it('tracks the words of a japanese listing rather than its sentences', async () => {
    const prisma = buildPrisma();
    prisma.app.findUnique.mockResolvedValue({
      id: 'app1',
      store: Store.GOOGLE_PLAY,
      country: 'jp',
      isCompetitor: false,
    });
    prisma.appSnapshot.findFirst.mockResolvedValue({
      title: 'メルカリ - フリマアプリ',
      subtitle: null,
      summary:
        'かんたんスマホ決済のメルペイでお得にショッピングも ふりま あぷり',
    });
    const service = buildService(prisma, buildQueue());

    await service.syncFromSnapshot('app1');

    const [{ data }] = prisma.keyword.createMany.mock.calls[0];
    const texts = data.map((row) => row.text);
    expect(texts).toHaveLength(9);
    expect(texts).toEqual(
      expect.arrayContaining(['メルカリ', 'フリマアプリ', 'スマホ決済']),
    );
    expect(texts.filter((text) => text.length > 10)).toEqual([]);
  });

  it('does nothing for a competitor, whose positions ride the primary search', async () => {
    const prisma = buildPrisma();
    prisma.app.findUnique.mockResolvedValue({
      id: 'rival',
      store: Store.APP_STORE,
      country: 'us',
      isCompetitor: true,
    });
    const service = buildService(prisma, buildQueue());

    await service.syncFromSnapshot('rival');

    expect(prisma.trackedKeyword.createMany).not.toHaveBeenCalled();
    expect(prisma.keyword.createMany).not.toHaveBeenCalled();
  });

  it('does nothing when the app has no snapshot', async () => {
    const prisma = buildPrisma();
    prisma.appSnapshot.findFirst.mockResolvedValue(null);
    const service = buildService(prisma, buildQueue());

    await service.syncFromSnapshot('app1');

    expect(prisma.trackedKeyword.createMany).not.toHaveBeenCalled();
  });
});

describe('KeywordsService.compare', () => {
  const buildService = (prisma: unknown) =>
    new KeywordsService(
      prisma as PrismaService,
      new KeywordTracker(
        prisma as PrismaService,
        { add: jest.fn() } as unknown as Queue,
        { add: jest.fn() } as unknown as Queue,
        new WorkspaceContext(),
      ),
      quotaOff(prisma as PrismaService),
      { request: jest.fn() } as unknown as MarketListingRequests,
      { schedule: jest.fn() } as unknown as FirstPositionChecks,
    );

  const buildPrisma = () => ({
    app: {
      findFirst: jest.fn().mockResolvedValue({ id: 'app1' }),
      findMany: jest.fn().mockResolvedValue([{ id: 'rival', name: 'Rival' }]),
    },
    trackedKeyword: {
      findMany: jest.fn().mockResolvedValue([
        {
          keywordId: 'kwGap',
          keyword: {
            text: 'habit tracker',
            country: 'us',
            metrics: [{ traffic: 5, difficulty: 3 }],
          },
        },
        {
          keywordId: 'kwLead',
          keyword: {
            text: 'daily planner',
            country: 'de',
            metrics: [{ traffic: 8, difficulty: 4 }],
          },
        },
      ]),
    },
    keywordRanking: {
      findMany: jest.fn().mockResolvedValue([
        { appId: 'app1', keywordId: 'kwGap', position: null },
        { appId: 'rival', keywordId: 'kwGap', position: 3 },
        { appId: 'app1', keywordId: 'kwLead', position: 2 },
        { appId: 'rival', keywordId: 'kwLead', position: 40 },
      ]),
    },
  });

  it('flags a gap when a competitor leads the top 10 and lists competitors', async () => {
    const service = buildService(buildPrisma());

    const result = await service.compare('app1', false);

    expect(result.competitors).toEqual([{ id: 'rival', name: 'Rival' }]);
    const gapRow = result.rows.find((row) => row.keywordId === 'kwGap');
    const leadRow = result.rows.find((row) => row.keywordId === 'kwLead');
    expect(gapRow?.gap).toBe(true);
    expect(gapRow?.you).toBeNull();
    expect(gapRow?.positions.rival).toBe(3);
    expect(leadRow?.gap).toBe(false);
    expect(result.rows[0].keywordId).toBe('kwGap');
  });

  it('filters to gaps only when requested', async () => {
    const service = buildService(buildPrisma());

    const result = await service.compare('app1', true);

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].keywordId).toBe('kwGap');
  });

  it('names the market of each row', async () => {
    const service = buildService(buildPrisma());

    const result = await service.compare('app1', false);

    expect(result.rows.find((row) => row.keywordId === 'kwGap')?.country).toBe(
      'us',
    );
    expect(result.rows.find((row) => row.keywordId === 'kwLead')?.country).toBe(
      'de',
    );
  });
  it('tells an app checked and not found from one that was never checked', async () => {
    const prisma = buildPrisma();
    prisma.keywordRanking.findMany.mockResolvedValue([
      { appId: 'app1', keywordId: 'kwGap', position: null },
      { appId: 'rival', keywordId: 'kwLead', position: null },
    ]);
    const service = buildService(prisma);

    const result = await service.compare('app1', false);

    const gapRow = result.rows.find((row) => row.keywordId === 'kwGap');
    const leadRow = result.rows.find((row) => row.keywordId === 'kwLead');
    expect(gapRow?.positions.rival).toBeNull();
    expect(gapRow?.unchecked).toEqual(['rival']);
    expect(leadRow?.you).toBeNull();
    expect(leadRow?.unchecked).toEqual(['app1']);
  });

  it("asks for the keyword's country", async () => {
    const prisma = buildPrisma();
    const service = buildService(prisma);

    await service.compare('app1', false);

    const [query] = prisma.trackedKeyword.findMany.mock.calls[0] as [
      { select: { keyword: { select: { country?: boolean } } } },
    ];
    expect(query.select.keyword.select.country).toBe(true);
  });
});

describe('KeywordsService.listTracked serp volatility', () => {
  const buildService = (prisma: unknown) =>
    new KeywordsService(
      prisma as PrismaService,
      new KeywordTracker(
        prisma as PrismaService,
        { add: jest.fn() } as unknown as Queue,
        { add: jest.fn() } as unknown as Queue,
        new WorkspaceContext(),
      ),
      quotaOff(prisma as PrismaService),
      { request: jest.fn() } as unknown as MarketListingRequests,
      { schedule: jest.fn() } as unknown as FirstPositionChecks,
    );

  const trackedRow = (keywordId: string, text: string) => ({
    keywordId,
    source: 'MANUAL',
    active: true,
    relevance: null,
    keyword: { text, country: 'us', rankings: [], metrics: [] },
  });

  const buildPrisma = () => ({
    keywordField: { findMany: jest.fn().mockResolvedValue([]) },
    app: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'app1',
        store: Store.APP_STORE,
        country: 'us',
        storeAppId: 'store1',
      }),
    },
    appSnapshot: { findFirst: jest.fn().mockResolvedValue(null) },
    trackedKeyword: {
      findMany: jest
        .fn()
        .mockResolvedValue([
          trackedRow('kwStable', 'habit tracker'),
          trackedRow('kwChurn', 'daily planner'),
          trackedRow('kwUnchecked', 'sleep timer'),
        ]),
    },
    serpEntry: {
      findFirst: jest
        .fn()
        .mockResolvedValue({ date: new Date('2026-07-08T00:00:00.000Z') }),
      findMany: jest.fn().mockResolvedValue([
        {
          keywordId: 'kwStable',
          date: new Date('2026-07-07'),
          storeAppId: 'a',
        },
        {
          keywordId: 'kwStable',
          date: new Date('2026-07-07'),
          storeAppId: 'b',
        },
        {
          keywordId: 'kwStable',
          date: new Date('2026-07-08'),
          storeAppId: 'b',
        },
        {
          keywordId: 'kwStable',
          date: new Date('2026-07-08'),
          storeAppId: 'a',
        },
        { keywordId: 'kwChurn', date: new Date('2026-07-07'), storeAppId: 'a' },
        { keywordId: 'kwChurn', date: new Date('2026-07-07'), storeAppId: 'b' },
        { keywordId: 'kwChurn', date: new Date('2026-07-08'), storeAppId: 'x' },
        { keywordId: 'kwChurn', date: new Date('2026-07-08'), storeAppId: 'y' },
      ]),
    },
  });

  it('scores a stable keyword 0, a churning keyword above 0 and an unchecked keyword null', async () => {
    const service = buildService(buildPrisma());

    const items = await service.listTracked('app1');
    const byId = new Map(items.map((item) => [item.keywordId, item]));

    expect(byId.get('kwStable')?.serpVolatility7d).toBe(0);
    expect(byId.get('kwChurn')?.serpVolatility7d).toBe(100);
    expect(byId.get('kwUnchecked')?.serpVolatility7d).toBeNull();
  });

  it('loads hold facts only when the list asks for them', async () => {
    const withRanking = (row: ReturnType<typeof trackedRow>) => ({
      ...row,
      keyword: {
        ...row.keyword,
        rankings: [{ position: 5, date: new Date(), depth: 200 }],
      },
    });
    const prisma = {
      ...buildPrisma(),
      trackedKeyword: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            withRanking(trackedRow('kwStable', 'habit tracker')),
            trackedRow('kwChurn', 'daily planner'),
            trackedRow('kwUnchecked', 'sleep timer'),
          ]),
      },
      $queryRaw: jest.fn().mockResolvedValue([
        {
          keywordId: 'kwStable',
          bestPosition: 2,
          daysInTier: 4,
          latestPosition: 5,
          latestDate: new Date().toISOString().slice(0, 10),
        },
      ]),
    };
    const service = buildService(prisma);

    const plain = await service.listTracked('app1');
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
    const plainRow = plain.find((item) => item.keywordId === 'kwStable');
    expect(plainRow).not.toHaveProperty('bestPosition');
    expect(plainRow).not.toHaveProperty('daysInTier');
    expect(plainRow).not.toHaveProperty('heldTier');

    const withFacts = await service.listTracked('app1', undefined, undefined, {
      holdFacts: true,
    });
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    const factsRow = withFacts.find((item) => item.keywordId === 'kwStable');
    expect(factsRow?.bestPosition).toBe(2);
    expect(factsRow?.positionDeltaFromBest).toBe(3);
    expect(factsRow?.daysInTier).toBe(4);
    expect(factsRow?.heldTier).toBe(10);
  });
});

describe('KeywordsService.listTracked play acquisitions', () => {
  const buildService = (prisma: unknown) =>
    new KeywordsService(
      prisma as PrismaService,
      new KeywordTracker(
        prisma as PrismaService,
        { add: jest.fn() } as unknown as Queue,
        { add: jest.fn() } as unknown as Queue,
        new WorkspaceContext(),
      ),
      quotaOff(prisma as PrismaService),
      { request: jest.fn() } as unknown as MarketListingRequests,
      { schedule: jest.fn() } as unknown as FirstPositionChecks,
    );

  const trackedRow = (keywordId: string, text: string) => ({
    keywordId,
    source: 'MANUAL',
    active: true,
    relevance: null,
    keyword: { text, country: 'us', rankings: [], metrics: [] },
  });

  const buildPrisma = (store: Store) => ({
    keywordField: { findMany: jest.fn().mockResolvedValue([]) },
    app: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'app1',
        store,
        country: 'us',
        storeAppId: 'com.example.habits',
      }),
    },
    appSnapshot: { findFirst: jest.fn().mockResolvedValue(null) },
    trackedKeyword: {
      findMany: jest
        .fn()
        .mockResolvedValue([
          trackedRow('kwHabit', 'habit tracker'),
          trackedRow('kwSleep', 'sleep timer'),
        ]),
    },
    serpEntry: {
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
    },
    storeReportRequest: {
      findFirst: jest.fn().mockResolvedValue({ id: 'req_play' }),
    },
    storeFunnelSearchTerm: {
      findMany: jest.fn().mockResolvedValue([
        {
          month: new Date('2026-08-01T00:00:00.000Z'),
          normalized: 'habit tracker',
          visitors: 900,
          acquisitions: 50,
        },
        {
          month: new Date('2026-09-01T00:00:00.000Z'),
          normalized: 'habit tracker',
          visitors: 520,
          acquisitions: 31,
        },
      ]),
    },
  });

  it("joins the newest month's acquisitions by normalized text", async () => {
    const prisma = buildPrisma(Store.GOOGLE_PLAY);

    const items = await buildService(prisma).listTracked('app1');
    const byId = new Map(items.map((item) => [item.keywordId, item]));

    expect(byId.get('kwHabit')?.playAcquisitions).toEqual({
      month: '2026-09-01',
      visitors: 520,
      acquisitions: 31,
    });
    expect(byId.get('kwSleep')?.playAcquisitions).toBeNull();
    expect(prisma.storeFunnelSearchTerm.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          appId: 'app1',
          normalized: { in: ['habit tracker', 'sleep timer'] },
        },
      }),
    );
  });

  it('answers no acquisitions while play is not connected', async () => {
    const prisma = buildPrisma(Store.GOOGLE_PLAY);
    prisma.storeReportRequest.findFirst.mockResolvedValue(null);

    const items = await buildService(prisma).listTracked('app1');

    expect(items.every((item) => item.playAcquisitions === null)).toBe(true);
    expect(prisma.storeFunnelSearchTerm.findMany).not.toHaveBeenCalled();
  });

  it('leaves app store keywords without the field', async () => {
    const prisma = buildPrisma(Store.APP_STORE);

    const items = await buildService(prisma).listTracked('app1');

    expect(items.every((item) => !('playAcquisitions' in item))).toBe(true);
    expect(prisma.storeFunnelSearchTerm.findMany).not.toHaveBeenCalled();
  });
});

describe('KeywordsService country tracking', () => {
  const buildService = (
    prisma: unknown,
    queue: { add: jest.Mock },
    schedule: jest.Mock = jest.fn(),
  ) =>
    new KeywordsService(
      prisma as PrismaService,
      new KeywordTracker(
        prisma as PrismaService,
        queue as unknown as Queue,
        queue as unknown as Queue,
        new WorkspaceContext(),
      ),
      quotaOff(prisma as PrismaService),
      { request: jest.fn() } as unknown as MarketListingRequests,
      { schedule } as unknown as FirstPositionChecks,
    );

  it('adds a keyword into the requested market, not the app home country', async () => {
    const queue = { add: jest.fn() };
    const keywordCreateMany = jest.fn().mockResolvedValue({ count: 1 });
    const prisma = {
      keywordField: { findMany: jest.fn().mockResolvedValue([]) },
      app: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'app1',
          store: Store.APP_STORE,
          country: 'us',
          storeAppId: 's',
        }),
      },
      keyword: {
        createMany: keywordCreateMany,
        findMany: jest.fn().mockResolvedValue([{ id: 'kw1', text: 'fitness' }]),
      },
      keywordMetric: { findFirst: jest.fn().mockResolvedValue(null) },
      trackedKeyword: {
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      appSnapshot: { findFirst: jest.fn().mockResolvedValue(null) },
      withTransaction: (run: (tx: unknown) => unknown) => run(prisma),
    };

    await buildService(prisma, queue).addManual('app1', ['fitness'], 'pl');

    const calls = keywordCreateMany.mock.calls as Array<
      [{ data: { country: string }[] }]
    >;
    expect(calls[0][0].data[0].country).toBe('pl');
    const lookup = (
      prisma.keyword.findMany.mock.calls as Array<
        [{ where: { country: string } }]
      >
    )[0][0];
    expect(lookup.where.country).toBe('pl');
  });

  it('checks the first position before it asks for the first score', async () => {
    const order: string[] = [];
    const queue = {
      add: jest.fn(() => {
        order.push('score');
        return Promise.resolve();
      }),
    };
    const schedule = jest.fn(() => {
      order.push('check');
      return Promise.resolve(1);
    });
    const prisma = {
      keywordField: { findMany: jest.fn().mockResolvedValue([]) },
      app: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'app1',
          store: Store.APP_STORE,
          country: 'us',
          storeAppId: 's',
        }),
      },
      keyword: {
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
        findMany: jest.fn().mockResolvedValue([{ id: 'kw1', text: 'fitness' }]),
      },
      keywordMetric: { findFirst: jest.fn().mockResolvedValue(null) },
      trackedKeyword: {
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      appSnapshot: { findFirst: jest.fn().mockResolvedValue(null) },
      withTransaction: (run: (tx: unknown) => unknown) => run(prisma),
    };

    await buildService(prisma, queue, schedule).addManual('app1', ['fitness']);

    expect(order).toEqual(['check', 'score']);
  });

  it('checks the positions of the keywords it starts tracking, not those already active', async () => {
    const schedule = jest.fn().mockResolvedValue(1);
    const prisma = {
      keywordField: { findMany: jest.fn().mockResolvedValue([]) },
      app: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'app1',
          store: Store.APP_STORE,
          country: 'us',
          storeAppId: 's',
        }),
      },
      keyword: {
        createMany: jest.fn().mockResolvedValue({ count: 2 }),
        findMany: jest.fn().mockResolvedValue([
          { id: 'kw1', text: 'fitness' },
          { id: 'kw2', text: 'workout' },
        ]),
      },
      keywordMetric: { findFirst: jest.fn().mockResolvedValue(null) },
      trackedKeyword: {
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findMany: jest
          .fn()
          .mockResolvedValueOnce([{ keywordId: 'kw2' }])
          .mockResolvedValue([]),
      },
      appSnapshot: { findFirst: jest.fn().mockResolvedValue(null) },
      withTransaction: (run: (tx: unknown) => unknown) => run(prisma),
    };

    await buildService(prisma, { add: jest.fn() }, schedule).addManual('app1', [
      'fitness',
      'workout',
    ]);

    expect(prisma.trackedKeyword.findMany).toHaveBeenNthCalledWith(1, {
      where: { appId: 'app1', active: true, keywordId: { in: ['kw1', 'kw2'] } },
      select: { keywordId: true },
    });
    expect(schedule).toHaveBeenCalledWith('app1', ['kw1']);
  });

  it('summarizes tracked markets home-first with counts including an empty home', async () => {
    const prisma = {
      keywordField: { findMany: jest.fn().mockResolvedValue([]) },
      app: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'app1',
          store: Store.APP_STORE,
          country: 'us',
          storeAppId: 's',
        }),
      },
      trackedKeyword: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            { keyword: { country: 'pl' } },
            { keyword: { country: 'pl' } },
            { keyword: { country: 'de' } },
          ]),
      },
    };

    const summary = await buildService(prisma, {
      add: jest.fn(),
    }).keywordCountries('app1');

    expect(summary[0]).toEqual({ country: 'us', keywordCount: 0 });
    expect(summary).toContainEqual({ country: 'pl', keywordCount: 2 });
    expect(summary).toContainEqual({ country: 'de', keywordCount: 1 });
    expect(summary.findIndex((row) => row.country === 'pl')).toBeLessThan(
      summary.findIndex((row) => row.country === 'de'),
    );
  });
});
