import { Injectable } from '@nestjs/common';
import { PortfolioHistory, PortfolioHistoryDays } from '@asobeast/shared';
import { PrismaService } from '../prisma/prisma.service';
import { keywordWindow } from './analytics.support';
import { portfolioHistory } from './portfolio-history';

@Injectable()
export class PortfolioHistoryService {
  constructor(private readonly prisma: PrismaService) {}

  async history(days: PortfolioHistoryDays): Promise<PortfolioHistory> {
    const apps = await this.prisma.app.findMany({
      where: { isCompetitor: false },
      select: { id: true },
    });
    const windowDays = 2 * days;
    const metricRows = windowDays + 1;
    const windows = await Promise.all(
      apps.map(async ({ id }) => ({
        appId: id,
        ...(await keywordWindow(
          this.prisma,
          { appId: id },
          windowDays,
          metricRows,
        )),
      })),
    );
    return portfolioHistory(windows, days);
  }
}
