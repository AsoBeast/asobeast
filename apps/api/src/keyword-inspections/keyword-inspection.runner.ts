import { Injectable, Logger } from '@nestjs/common';
import { Prisma, Store } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { scoreCollected } from '../scoring/keyword-score';
import { StatsCollectorService } from '../scoring/stats-collector.service';
import {
  toInspectionResults,
  toInspectionSuggestions,
} from './inspection-results';

export const INSPECTION_FAILURE_MAX_LENGTH = 500;

const asJson = (value: unknown): Prisma.InputJsonValue =>
  value as Prisma.InputJsonValue;

function failureOf(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.slice(0, INSPECTION_FAILURE_MAX_LENGTH);
}

@Injectable()
export class KeywordInspectionRunner {
  private readonly logger = new Logger(KeywordInspectionRunner.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly collector: StatsCollectorService,
  ) {}

  async run(inspectionId: string, finalAttempt: boolean): Promise<void> {
    const inspection = await this.prisma.keywordInspection.findFirst({
      where: { id: inspectionId, status: 'PENDING' },
      select: {
        id: true,
        keyword: { select: { text: true, store: true, country: true } },
      },
    });
    if (!inspection) {
      return;
    }
    try {
      await this.complete(inspection.id, inspection.keyword);
    } catch (error) {
      if (finalAttempt) {
        await this.fail(inspection.id, error);
      }
      throw error;
    }
  }

  private async complete(
    id: string,
    keyword: { text: string; store: Store; country: string },
  ): Promise<void> {
    const collected = await this.collector.collectFor(keyword);
    const score = scoreCollected(collected);
    await this.prisma.keywordInspection.updateMany({
      where: { id, status: 'PENDING' },
      data: {
        status: 'DONE',
        ...score,
        resultCount: collected.results.length,
        results: asJson(toInspectionResults(collected.results, keyword.text)),
        suggestions: asJson(toInspectionSuggestions(collected.suggestions)),
        failure: null,
        completedAt: new Date(),
      },
    });
  }

  private async fail(id: string, error: unknown): Promise<void> {
    const failure = failureOf(error);
    this.logger.warn(`keyword inspection ${id} failed: ${failure}`);
    await this.prisma.keywordInspection.updateMany({
      where: { id, status: 'PENDING' },
      data: { status: 'FAILED', failure, completedAt: new Date() },
    });
  }
}
