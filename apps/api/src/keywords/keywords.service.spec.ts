import { Queue } from 'bullmq';
import { Store } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { QuotaService } from '../auth/quota.service';
import { WorkspaceContext } from '../common/tenancy/workspace-context';
import { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { KeywordsService } from './keywords.service';

const quotaOff = (prisma: PrismaService) =>
  new QuotaService(prisma, new WorkspaceContext(), {
    get: () => false,
  } as unknown as ConfigService<Env, true>);

describe('KeywordsService.syncFromSnapshot', () => {
  const buildQueue = () => ({ add: jest.fn() });

  const buildService = (prisma: unknown, queue: { add: jest.Mock }) =>
    new KeywordsService(
      prisma as PrismaService,
      queue as unknown as Queue,
      queue as unknown as Queue,
      quotaOff(prisma as PrismaService),
      new WorkspaceContext(),
    );

  const buildPrisma = () => {
    let keywordId = 0;
    return {
      keywordMetric: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      app: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'app1',
          store: Store.APP_STORE,
          country: 'us',
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
        upsert: jest.fn().mockImplementation(() => {
          keywordId += 1;
          return Promise.resolve({ id: `kw${keywordId}` });
        }),
      },
      trackedKeyword: {
        upsert: jest.fn<
          Promise<void>,
          [{ create: { source: string; active: boolean }; update: object }]
        >(),
      },
    };
  };

  it('tracks only title and subtitle candidates with create-only upserts', async () => {
    const prisma = buildPrisma();
    const service = buildService(prisma, buildQueue());

    await service.syncFromSnapshot('app1');

    const trackedSources = prisma.trackedKeyword.upsert.mock.calls.map(
      ([args]) => args.create.source,
    );
    expect(trackedSources).toContain('TITLE');
    expect(trackedSources).toContain('SUBTITLE');
    expect(trackedSources).not.toContain('DESCRIPTION');

    for (const [args] of prisma.trackedKeyword.upsert.mock.calls) {
      expect(args.create.active).toBe(true);
      expect(args.update).toEqual({});
    }
  });

  it('tracks title and summary candidates for google play, not subtitle', async () => {
    const prisma = buildPrisma();
    prisma.app.findUnique.mockResolvedValue({
      id: 'app1',
      store: Store.GOOGLE_PLAY,
      country: 'us',
    });
    const service = buildService(prisma, buildQueue());

    await service.syncFromSnapshot('app1');

    const trackedSources = prisma.trackedKeyword.upsert.mock.calls.map(
      ([args]) => args.create.source,
    );
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

    expect(prisma.trackedKeyword.upsert).toHaveBeenCalledTimes(15);
  });

  it('does nothing when the app has no snapshot', async () => {
    const prisma = buildPrisma();
    prisma.appSnapshot.findFirst.mockResolvedValue(null);
    const service = buildService(prisma, buildQueue());

    await service.syncFromSnapshot('app1');

    expect(prisma.trackedKeyword.upsert).not.toHaveBeenCalled();
  });
});

describe('KeywordsService.compare', () => {
  const buildService = (prisma: unknown) =>
    new KeywordsService(
      prisma as PrismaService,
      { add: jest.fn() } as unknown as Queue,
      { add: jest.fn() } as unknown as Queue,
      quotaOff(prisma as PrismaService),
      new WorkspaceContext(),
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
            metrics: [{ traffic: 5, difficulty: 3 }],
          },
        },
        {
          keywordId: 'kwLead',
          keyword: {
            text: 'daily planner',
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
});

describe('KeywordsService.listTracked serp volatility', () => {
  const buildService = (prisma: unknown) =>
    new KeywordsService(
      prisma as PrismaService,
      { add: jest.fn() } as unknown as Queue,
      { add: jest.fn() } as unknown as Queue,
      quotaOff(prisma as PrismaService),
      new WorkspaceContext(),
    );

  const trackedRow = (keywordId: string, text: string) => ({
    keywordId,
    source: 'MANUAL',
    active: true,
    relevance: null,
    keyword: { text, rankings: [], metrics: [] },
  });

  const buildPrisma = () => ({
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
});

describe('KeywordsService country tracking', () => {
  const buildService = (prisma: unknown, queue: { add: jest.Mock }) =>
    new KeywordsService(
      prisma as PrismaService,
      queue as unknown as Queue,
      queue as unknown as Queue,
      quotaOff(prisma as PrismaService),
      new WorkspaceContext(),
    );

  it('adds a keyword into the requested market, not the app home country', async () => {
    const queue = { add: jest.fn() };
    const keywordUpsert = jest.fn().mockResolvedValue({ id: 'kw1' });
    const prisma = {
      app: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'app1',
          store: Store.APP_STORE,
          country: 'us',
          storeAppId: 's',
        }),
      },
      keyword: { upsert: keywordUpsert },
      keywordMetric: { findFirst: jest.fn().mockResolvedValue(null) },
      trackedKeyword: {
        upsert: jest.fn().mockResolvedValue(undefined),
        findMany: jest.fn().mockResolvedValue([]),
      },
      appSnapshot: { findFirst: jest.fn().mockResolvedValue(null) },
      withTransaction: (run: (tx: unknown) => unknown) => run(prisma),
    };

    await buildService(prisma, queue).addManual('app1', ['fitness'], 'pl');

    const calls = keywordUpsert.mock.calls as Array<
      [
        {
          where: { text_store_country: { country: string } };
          create: { country: string };
        },
      ]
    >;
    expect(calls[0][0].where.text_store_country.country).toBe('pl');
    expect(calls[0][0].create.country).toBe('pl');
  });

  it('summarizes tracked markets home-first with counts including an empty home', async () => {
    const prisma = {
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
