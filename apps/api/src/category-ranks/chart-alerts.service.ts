import { Injectable } from '@nestjs/common';
import type { ChartMoveScope } from '@asobeast/shared';
import { toDateKey } from '../analytics/analytics.support';
import { AlertsDispatcher } from '../alerts/alerts.dispatcher';
import { PrismaService } from '../prisma/prisma.service';
import { chartMovePayloads } from './chart-moves';

export interface ChartCheck {
  app: { id: string; name: string | null };
  chart: ChartMoveScope;
  date: Date;
  position: number | null;
  depth: number;
}

@Injectable()
export class ChartAlertsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly alerts: AlertsDispatcher,
  ) {}

  async dispatch(check: ChartCheck): Promise<void> {
    const previous = await this.previousCheck(check);
    if (!previous) return;
    const payloads = chartMovePayloads({
      occurredAt: new Date().toISOString(),
      app: check.app,
      chart: check.chart,
      date: toDateKey(check.date),
      depth: check.depth,
      from: previous.position,
      to: check.position,
    });
    for (const payload of payloads) {
      await this.alerts.dispatch(payload);
    }
  }

  private async previousCheck(
    check: ChartCheck,
  ): Promise<{ position: number | null } | null> {
    const { store, country, collection, genre, device } = check.chart;
    const emptyCaptures = await this.prisma.chartCapture.findMany({
      where: {
        store,
        country,
        collection,
        genre,
        device,
        date: { lt: check.date },
        entries: { none: {} },
      },
      select: { date: true },
    });
    return this.prisma.categoryRank.findFirst({
      where: {
        appId: check.app.id,
        collection,
        genre,
        date: {
          lt: check.date,
          notIn: emptyCaptures.map((capture) => capture.date),
        },
      },
      orderBy: { date: 'desc' },
      select: { position: true },
    });
  }
}
