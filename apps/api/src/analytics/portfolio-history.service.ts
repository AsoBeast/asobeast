import { Injectable } from '@nestjs/common';
import {
  PortfolioHistory,
  PortfolioHistoryDays,
  PortfolioHistoryScope,
} from '@asobeast/shared';
import { HOME_EVENTS } from '../apps/listing';
import { PrismaService } from '../prisma/prisma.service';
import { addDays, keywordWindow } from './analytics.support';
import { newestReference, portfolioHistory } from './portfolio-history';

@Injectable()
export class PortfolioHistoryService {
  constructor(private readonly prisma: PrismaService) {}

  async history(
    days: PortfolioHistoryDays,
    scope: PortfolioHistoryScope = {},
  ): Promise<PortfolioHistory> {
    const apps = await this.prisma.app.findMany({
      where: { isCompetitor: false, id: scope.appId, store: scope.store },
      select: { id: true, store: true },
    });
    const windowDays = 2 * days;
    const metricRows = windowDays + 1;
    const windows = await Promise.all(
      apps.map(async ({ id, store }) => ({
        appId: id,
        store,
        ...(await keywordWindow(
          this.prisma,
          { appId: id },
          windowDays,
          metricRows,
        )),
      })),
    );
    const newest = newestReference(windows);
    const stamps =
      newest === null
        ? []
        : await this.prisma.changeEvent.findMany({
            where: {
              appId: { in: apps.map(({ id }) => id) },
              ...HOME_EVENTS,
              capturedAt: { gte: addDays(newest, -days) },
            },
            select: { appId: true, field: true, capturedAt: true },
          });
    return portfolioHistory(windows, days, stamps);
  }
}
