import { Injectable, NotFoundException } from '@nestjs/common';
import { ChangeField, ChangeImpactReport } from '@asobeast/shared';
import { addDays, utcToday } from '../analytics/analytics.support';
import { PrismaService } from '../prisma/prisma.service';
import {
  changeDays,
  ImpactKeyword,
  impactReadPlan,
  ImpactReadPlan,
  measureChangeImpact,
} from './change-impact';

@Injectable()
export class ChangeImpactService {
  constructor(private readonly prisma: PrismaService) {}

  async report(
    appId: string,
    days: number,
    country?: string,
  ): Promise<ChangeImpactReport> {
    const app = await this.prisma.app.findFirst({
      where: { id: appId },
      select: { id: true, country: true },
    });
    if (!app) {
      throw new NotFoundException(`App ${appId} not found`);
    }

    const market = country ?? app.country;
    const today = utcToday();
    const events = await this.prisma.changeEvent.findMany({
      where: { appId: app.id, capturedAt: { gte: addDays(today, -days) } },
      select: { field: true, capturedAt: true },
    });
    const changes = changeDays(
      events.map((event) => ({
        field: event.field as ChangeField,
        capturedAt: event.capturedAt,
      })),
    );
    const keywords = await this.keywords(
      app.id,
      market,
      impactReadPlan(changes, today),
    );

    return {
      appId: app.id,
      country: market,
      days,
      ...measureChangeImpact({ changes, keywords, today }),
    };
  }

  private async keywords(
    appId: string,
    country: string,
    plan: ImpactReadPlan,
  ): Promise<ImpactKeyword[]> {
    if (plan.metricsUntil === null) {
      return [];
    }
    const rows = await this.prisma.trackedKeyword.findMany({
      where: { appId, active: true, keyword: { country } },
      select: {
        keyword: {
          select: {
            metrics: {
              where: { date: { lte: plan.metricsUntil } },
              orderBy: { date: 'desc' },
              select: { traffic: true, difficulty: true, date: true },
            },
            rankings: {
              where: { appId, date: { in: plan.rankingDates } },
              select: { position: true, date: true, depth: true },
            },
          },
        },
      },
    });
    return rows.map((row) => row.keyword);
  }
}
