import { PrismaService } from '../prisma/prisma.service';
import { KeywordStats } from './formulas';
import { ScoringEvidence } from './provenance';
import { ScoringService } from './scoring.service';
import {
  CollectedKeywordStats,
  StatsCollectorService,
} from './stats-collector.service';

const stats: KeywordStats = {
  store: 'APP_STORE',
  keywordText: 'games',
  top10: Array.from({ length: 10 }, () => ({
    title: 'Best Games',
    ratingCount: 1_000_000,
    daysSinceUpdate: 9,
  })),
  top30TitleMatchCount: 30,
  suggest: { priority: 9000 },
};

const evidence: ScoringEvidence = {
  searchResultCount: 10,
  suggestCompleted: true,
  prefixSweepCompleted: false,
  detailTargetCount: 0,
  detailSuccessCount: 0,
};

const collected: CollectedKeywordStats = { stats, evidence };

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
    expect(args.create.traffic).toBeCloseTo(9.29, 2);
    expect(args.create.difficulty).toBeCloseTo(9.64, 2);
    expect(args.create.stats).toEqual({ ...stats, evidence });
    expect(args.create.scoringSource).toBe('APPLE_SUGGEST_SEARCH');
    expect(args.create.formulaVersion).toBe('app-store-v1');
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
      stats: { ...stats, evidence },
      scoringSource: 'APPLE_SUGGEST_SEARCH',
      formulaVersion: 'app-store-v1',
      confidence: 'HIGH',
      capturedAt: args.create.capturedAt,
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
