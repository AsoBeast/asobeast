import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { scoreCollected } from './keyword-score';
import { StatsCollectorService } from './stats-collector.service';

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
    const { traffic, difficulty, stats, ...profile } =
      scoreCollected(collected);
    const date = utcDay(capturedAt);
    const provenance = { ...profile, capturedAt };

    await this.prisma.keywordMetric.upsert({
      where: { keywordId_date: { keywordId, date } },
      create: {
        keywordId,
        date,
        traffic,
        difficulty,
        stats,
        ...provenance,
      },
      update: { traffic, difficulty, stats, ...provenance },
    });
  }
}
