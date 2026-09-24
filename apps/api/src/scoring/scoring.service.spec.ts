import { PrismaService } from '../prisma/prisma.service';
import { KeywordStats } from './formulas';
import { ScoringEvidence } from './provenance';
import { ScoringService } from './scoring.service';
import {
  CollectedKeywordStats,
  StatsCollectorService,
} from './stats-collector.service';

const storedStats: KeywordStats = {
  store: 'APP_STORE',
  keywordText: 'games',
  resultCount: 30,
  top10: Array.from({ length: 10 }, () => ({
    title: 'Best Games',
    ratingCount: 1_000_000,
  })),
  suggest: { status: 'hit', prefixLength: 1, position: 1 },
};

const evidence: ScoringEvidence = {
  searchResultCount: 10,
  suggestCompleted: true,
  suggestRequests: 2,
  detailTargetCount: 10,
  detailSuccessCount: 10,
  officialPopularityUsed: false,
};

const storedJson = {
  ...storedStats,
  signals: {
    suggestReach: 'hit',
    suggestPrefixLength: 1,
    suggestPosition: 1,
    serpRelevance: 1,
    medianRatingCount: 1_000_000,
    flags: [],
    officialPopularity: null,
    estimatedTraffic: 7,
    entryDifficulty: null,
  },
  evidence,
};

const collected: CollectedKeywordStats = { stats: storedStats, evidence };

interface UpsertArgs {
  where: { keywordId_date: { keywordId: string; date: Date } };
  create: {
    keywordId: string;
    traffic: number;
    difficulty: number;
    stats: unknown;
    scoringSource: string;
    formulaVersion: string;
    confidence: string;
    capturedAt: Date;
  };
  update: {
    traffic: number;
    difficulty: number;
    stats: unknown;
    scoringSource: string;
    formulaVersion: string;
    confidence: string;
    capturedAt: Date;
  };
}

describe('ScoringService', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('upserts a metric with computed scores for today', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-28T23:59:59.500Z'));
    const upsert = jest.fn<Promise<void>, [UpsertArgs]>();
    const collect = jest.fn<Promise<CollectedKeywordStats>, [string]>();
    collect.mockResolvedValue(collected);
    const prisma = {
      keywordMetric: { upsert },
    } as unknown as PrismaService;
    const collector = { collect } as unknown as StatsCollectorService;
    const service = new ScoringService(prisma, collector);

    await service.scoreKeyword('kw1');

    expect(collect).toHaveBeenCalledWith('kw1');
    const [args] = upsert.mock.calls[0];
    expect(args.create.keywordId).toBe('kw1');
    expect(args.create.traffic).toBeCloseTo(7, 2);
    expect(args.create.difficulty).toBeCloseTo(6.7, 2);
    expect(args.create.stats).toEqual(storedJson);
    expect(args.create.scoringSource).toBe('APPLE_SEARCH_SIGNALS');
    expect(args.create.formulaVersion).toBe('app-store-v2');
    expect(args.create.confidence).toBe('HIGH');
    expect(args.create.capturedAt.toISOString()).toBe(
      '2026-07-28T23:59:59.500Z',
    );
    expect(args.where.keywordId_date.date.toISOString()).toBe(
      '2026-07-28T00:00:00.000Z',
    );
    expect(args.update).toEqual({
      traffic: args.create.traffic,
      difficulty: args.create.difficulty,
      stats: storedJson,
      scoringSource: 'APPLE_SEARCH_SIGNALS',
      formulaVersion: 'app-store-v2',
      confidence: 'HIGH',
      capturedAt: args.create.capturedAt,
    });
  });

  it('writes the same row on a second run the same day', async () => {
    const upsert = jest.fn<Promise<void>, [UpsertArgs]>();
    const collect = jest.fn<Promise<CollectedKeywordStats>, [string]>();
    collect.mockResolvedValue(collected);
    const prisma = {
      keywordMetric: { upsert },
    } as unknown as PrismaService;
    const service = new ScoringService(prisma, {
      collect,
    } as unknown as StatsCollectorService);

    jest.useFakeTimers().setSystemTime(new Date('2026-07-28T01:00:00Z'));
    await service.scoreKeyword('kw1');
    jest.setSystemTime(new Date('2026-07-28T22:00:00Z'));
    await service.scoreKeyword('kw1');

    const [first, second] = upsert.mock.calls.map(([args]) => args.where);
    expect(second).toEqual(first);
  });

  it('names apple ads as the source of an official value', async () => {
    const upsert = jest.fn<Promise<void>, [UpsertArgs]>();
    const collect = jest.fn<Promise<CollectedKeywordStats>, [string]>();
    collect.mockResolvedValue({
      stats: { ...storedStats, official: { value: 71 } },
      evidence: { ...evidence, officialPopularityUsed: true },
    });
    const service = new ScoringService(
      { keywordMetric: { upsert } } as unknown as PrismaService,
      { collect } as unknown as StatsCollectorService,
    );

    await service.scoreKeyword('kw1');

    const [args] = upsert.mock.calls[0];
    expect(args.create.traffic).toBeCloseTo(7.1, 3);
    expect(args.create.scoringSource).toBe('APPLE_ADS_POPULARITY');
    expect(args.create.confidence).toBe('HIGH');
    expect(args.create.stats).not.toHaveProperty('official');
    expect(args.create.stats).toMatchObject({
      signals: { officialPopularity: 71, estimatedTraffic: 7 },
    });
  });

  it('skips the upsert when the keyword is gone', async () => {
    const upsert = jest.fn<Promise<void>, [UpsertArgs]>();
    const collect = jest.fn<Promise<CollectedKeywordStats | null>, [string]>();
    collect.mockResolvedValue(null);
    const prisma = {
      keywordMetric: { upsert },
    } as unknown as PrismaService;
    const collector = { collect } as unknown as StatsCollectorService;
    const service = new ScoringService(prisma, collector);

    await service.scoreKeyword('gone');

    expect(upsert).not.toHaveBeenCalled();
  });
});
