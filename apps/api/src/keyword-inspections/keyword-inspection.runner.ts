import { Injectable, Logger } from '@nestjs/common';
import { Prisma, Store } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { scoreCollected } from '../scoring/keyword-score';
import { StatsCollectorService } from '../scoring/stats-collector.service';
import {
  toInspectionResults,
  toInspectionSuggestions,
} from './inspection-results';
import {
  INSPECTION_NOT_COLLECTING,
  INSPECTION_PENDING_TTL_MS,
  INSPECTION_TIMED_OUT,
  inspectionFailureOf,
} from './inspection-failures';

const asJson = (value: unknown): Prisma.InputJsonValue =>
  value as Prisma.InputJsonValue;

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

@Injectable()
export class KeywordInspectionRunner {
  private readonly logger = new Logger(KeywordInspectionRunner.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly collector: StatsCollectorService,
  ) {}

  async run(inspectionId: string): Promise<void> {
    const inspection = await this.prisma.keywordInspection.findFirst({
      where: { id: inspectionId, status: 'PENDING' },
      select: {
        id: true,
        requestedAt: true,
        keyword: { select: { text: true, store: true, country: true } },
      },
    });
    if (!inspection) {
      return;
    }
    if (
      inspection.requestedAt.getTime() <
      Date.now() - INSPECTION_PENDING_TTL_MS
    ) {
      await this.close(inspection.id, INSPECTION_TIMED_OUT);
      return;
    }
    await this.complete(inspection.id, inspection.keyword);
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

  async fail(id: string, error: unknown): Promise<void> {
    this.logger.warn(`keyword inspection ${id} failed: ${messageOf(error)}`);
    await this.close(id, inspectionFailureOf(error));
  }

  async refuse(id: string): Promise<void> {
    await this.close(id, INSPECTION_NOT_COLLECTING);
  }

  private async close(id: string, failure: string): Promise<void> {
    await this.prisma.keywordInspection.updateMany({
      where: { id, status: 'PENDING' },
      data: { status: 'FAILED', failure, completedAt: new Date() },
    });
  }
}
