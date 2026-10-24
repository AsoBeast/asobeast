import { Injectable, NotFoundException } from '@nestjs/common';
import { Store } from '@prisma/client';
import {
  CHANGE_IMPACT_WINDOWS,
  ChangeImpactItem,
  ChangeImpactReport,
  isChangeField,
} from '@asobeast/shared';
import { addDays, utcToday } from '../analytics/analytics.support';
import { PrismaService } from '../prisma/prisma.service';
import {
  changeDays,
  ImpactKeyword,
  impactReadPlan,
  ImpactReadPlan,
  measureChangeImpact,
} from './change-impact';
import { HOME_EVENTS } from '../apps/listing';
import {
  marketFunnelScope,
  reportedThrough,
  type FunnelScope,
} from '../store-connect/store-funnel';
import { StoreFunnelService } from '../store-connect/store-funnel.service';
import { measureChangeFunnel } from './change-impact-funnel';

@Injectable()
export class ChangeImpactService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly funnel: StoreFunnelService,
  ) {}

  async report(
    appId: string,
    days: number,
    country?: string,
  ): Promise<ChangeImpactReport> {
    const app = await this.prisma.app.findFirst({
      where: { id: appId },
      select: { id: true, country: true, store: true },
    });
    if (!app) {
      throw new NotFoundException(`App ${appId} not found`);
    }

    const market = country ?? app.country;
    const today = utcToday();
    const events = await this.prisma.changeEvent.findMany({
      where: {
        appId: app.id,
        ...HOME_EVENTS,
        capturedAt: { gte: addDays(today, -days) },
      },
      select: { field: true, capturedAt: true },
    });
    const changes = changeDays(
      events.flatMap(({ field, capturedAt }) =>
        isChangeField(field) ? [{ field, capturedAt }] : [],
      ),
    );
    const keywords = await this.keywords(
      app.id,
      market,
      impactReadPlan(changes, today),
    );

    const measured = measureChangeImpact({ changes, keywords, today });

    return {
      appId: app.id,
      country: market,
      days,
      ...measured,
      items: await this.withFunnel(
        app,
        marketFunnelScope(app.store, market, app.country),
        measured.items,
        today,
      ),
    };
  }

  private async withFunnel(
    app: { id: string; store: Store },
    scope: FunnelScope,
    items: ChangeImpactItem[],
    today: Date,
  ): Promise<ChangeImpactItem[]> {
    const oldest = items.at(-1)?.changedOn;
    if (!oldest || !(await this.funnel.connected(app.id, app.store))) {
      return items;
    }
    const from = addDays(
      new Date(`${oldest}T00:00:00.000Z`),
      -Math.max(...CHANGE_IMPACT_WINDOWS),
    );
    const [rows, { firstDate, lastDate }] = await Promise.all([
      this.funnel.rows(app.id, from, scope),
      this.funnel.range(app.id),
    ]);
    const through = reportedThrough(today, lastDate);
    return items.map((item) => ({
      ...item,
      windows: item.windows.map((window) => ({
        ...window,
        funnel: measureChangeFunnel({
          rows,
          changedOn: item.changedOn,
          days: window.days,
          completeThrough: through,
          firstDate,
          store: app.store,
        }),
      })),
    }));
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
