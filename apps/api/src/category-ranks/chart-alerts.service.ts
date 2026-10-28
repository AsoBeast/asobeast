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
    const previous = await this.prisma.categoryRank.findFirst({
      where: {
        appId: check.app.id,
        collection: check.chart.collection,
        genre: check.chart.genre,
        date: { lt: check.date },
      },
      orderBy: { date: 'desc' },
      select: { position: true },
    });
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
}
