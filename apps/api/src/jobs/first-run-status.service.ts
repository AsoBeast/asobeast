import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  FIRST_RUN_HISTORY_DAYS,
  FIRST_RUN_STAGES,
  type FirstRunStage,
  type FirstRunStageStatus,
  type FirstRunStatus,
} from '@asobeast/shared';
import { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { nextDailyRun, nextWeeklyRun } from './daily-schedule';

const DAY_MS = 24 * 60 * 60_000;

interface ReadyRow {
  ready: number;
}

interface StageInput {
  ready: number;
  total: number;
  expectedBy: Date | null;
}

@Injectable()
export class FirstRunStatusService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async forApp(appId: string, now = new Date()): Promise<FirstRunStatus> {
    const app = await this.prisma.app.findFirst({
      where: { id: appId },
      select: {
        id: true,
        snapshots: {
          orderBy: { capturedAt: 'desc' },
          take: 1,
          select: { ratingCount: true },
        },
      },
    });
    if (!app) {
      throw new NotFoundException(`App ${appId} not found`);
    }

    const tracked = await this.prisma.trackedKeyword.count({
      where: { appId, active: true },
    });
    const ranked = await this.rankedKeywords(appId);
    const scored = await this.scoredKeywords(appId);
    const reviewed = await this.prisma.review.count({ where: { appId } });
    const captureDays = await this.captureDays(appId);

    const snapshot = app.snapshots[0];
    const historyTotal = tracked === 0 ? 0 : FIRST_RUN_HISTORY_DAYS;
    const historyReady = Math.min(captureDays, historyTotal);
    const inputs: Record<FirstRunStage, StageInput> = {
      metadata: {
        ready: snapshot ? 1 : 0,
        total: 1,
        expectedBy: null,
      },
      keywords: { ready: tracked, total: tracked, expectedBy: null },
      rankings: {
        ready: ranked,
        total: tracked,
        expectedBy: nextDailyRun(this.cron('CRON_DAILY'), now),
      },
      scores: {
        ready: scored,
        total: tracked,
        expectedBy: nextWeeklyRun(this.cron('CRON_SCORING'), now),
      },
      reviews: {
        ready: reviewed === 0 ? 0 : 1,
        total: (snapshot?.ratingCount ?? 0) > 0 ? 1 : 0,
        expectedBy: null,
      },
      history: {
        ready: historyReady,
        total: historyTotal,
        expectedBy: new Date(
          now.getTime() + (historyTotal - historyReady) * DAY_MS,
        ),
      },
    };

    const stages = FIRST_RUN_STAGES.map((stage) =>
      stageStatus(stage, inputs[stage]),
    );

    return {
      appId,
      complete: stages.every((stage) => stage.complete),
      stages,
    };
  }

  private cron(key: 'CRON_DAILY' | 'CRON_SCORING'): string {
    return this.config.get(key, { infer: true });
  }

  private async rankedKeywords(appId: string): Promise<number> {
    const [row] = await this.prisma.$queryRaw<ReadyRow[]>`
      SELECT COUNT(DISTINCT r."keywordId")::int AS ready
      FROM "KeywordRanking" r
      JOIN "TrackedKeyword" t
        ON t."keywordId" = r."keywordId" AND t."appId" = r."appId"
      WHERE t."appId" = ${appId} AND t."active" = true
    `;
    return row?.ready ?? 0;
  }

  private async scoredKeywords(appId: string): Promise<number> {
    const [row] = await this.prisma.$queryRaw<ReadyRow[]>`
      SELECT COUNT(DISTINCT m."keywordId")::int AS ready
      FROM "KeywordMetric" m
      JOIN "TrackedKeyword" t ON t."keywordId" = m."keywordId"
      WHERE t."appId" = ${appId} AND t."active" = true
    `;
    return row?.ready ?? 0;
  }

  private async captureDays(appId: string): Promise<number> {
    const [row] = await this.prisma.$queryRaw<ReadyRow[]>`
      SELECT COUNT(DISTINCT r."date")::int AS ready
      FROM "KeywordRanking" r
      JOIN "TrackedKeyword" t
        ON t."keywordId" = r."keywordId" AND t."appId" = r."appId"
      WHERE t."appId" = ${appId} AND t."active" = true
    `;
    return row?.ready ?? 0;
  }
}

function stageStatus(
  stage: FirstRunStage,
  input: StageInput,
): FirstRunStageStatus {
  const complete = input.ready >= input.total;
  return {
    stage,
    ready: input.ready,
    total: input.total,
    complete,
    expectedBy: complete ? null : (input.expectedBy?.toISOString() ?? null),
  };
}
