import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { computeDifficulty } from './difficulty';
import { KeywordStats } from './formulas';
import { scoringConfidence, scoringProfile } from './provenance';
import { buildScoreSignals } from './score-signals';
import {
  CollectedKeywordStats,
  StatsCollectorService,
} from './stats-collector.service';
import { computeTraffic, estimateTraffic } from './traffic';

function toJson(
  { stats, evidence }: CollectedKeywordStats,
  estimatedTraffic: number,
): Prisma.InputJsonValue {
  const stored: Partial<KeywordStats> = { ...stats };
  delete stored.previousTop10;
  delete stored.official;
  return {
    ...stored,
    signals: buildScoreSignals(stats, estimatedTraffic),
    evidence,
  } as unknown as Prisma.InputJsonValue;
}

function utcDay(now: Date): Date {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

@Injectable()
export class ScoringService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly collector: StatsCollectorService,
  ) {}

  async scoreKeyword(keywordId: string): Promise<void> {
    const collected = await this.collector.collect(keywordId);
    if (!collected) {
      return;
    }
    const capturedAt = new Date();
    const { stats, evidence } = collected;
    const traffic = computeTraffic(stats);
    const difficulty = computeDifficulty(stats);
    const date = utcDay(capturedAt);
    const json = toJson(collected, estimateTraffic(stats));
    const { source: scoringSource, formulaVersion } = scoringProfile(
      stats.store,
      evidence.officialPopularityUsed,
    );
    const confidence = scoringConfidence(stats.store, evidence);
    const provenance = {
      scoringSource,
      formulaVersion,
      confidence,
      capturedAt,
    };

    await this.prisma.keywordMetric.upsert({
      where: { keywordId_date: { keywordId, date } },
      create: {
        keywordId,
        date,
        traffic,
        difficulty,
        stats: json,
        ...provenance,
      },
      update: { traffic, difficulty, stats: json, ...provenance },
    });
  }
}
