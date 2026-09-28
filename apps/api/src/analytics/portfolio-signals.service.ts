import { Injectable, Logger } from '@nestjs/common';
import { AppActionCounts, AppAuditTrend } from '@asobeast/shared';
import { PrismaService } from '../prisma/prisma.service';
import { addDays } from './analytics.support';

const AUDIT_TREND_DAYS = 7;

export const EMPTY_ACTION_COUNTS: AppActionCounts = {
  open: 0,
  critical: 0,
  high: 0,
};

@Injectable()
export class PortfolioSignals {
  private readonly logger = new Logger(PortfolioSignals.name);

  constructor(private readonly prisma: PrismaService) {}

  async actionCounts(
    appIds: string[],
  ): Promise<Map<string, AppActionCounts> | null> {
    if (appIds.length === 0) return new Map();
    try {
      const rows = await this.prisma.actionItem.groupBy({
        by: ['appId', 'priority'],
        where: {
          appId: { in: appIds },
          status: 'OPEN',
        },
        _count: { _all: true },
      });

      const counts = new Map<string, AppActionCounts>();
      for (const row of rows) {
        const current = counts.get(row.appId) ?? { ...EMPTY_ACTION_COUNTS };
        current.open += row._count._all;
        if (row.priority === 'critical') current.critical += row._count._all;
        if (row.priority === 'high') current.high += row._count._all;
        counts.set(row.appId, current);
      }
      return counts;
    } catch (error) {
      this.logger.error('action counts unavailable for this digest', error);
      return null;
    }
  }

  async auditTrend(appId: string, to: Date): Promise<AppAuditTrend | null> {
    const [current, baseline] = await Promise.all([
      this.prisma.auditScore.findFirst({
        where: { appId, date: { lte: to } },
        orderBy: { date: 'desc' },
        select: { date: true, overall: true },
      }),
      this.prisma.auditScore.findFirst({
        where: { appId, date: { lte: addDays(to, -AUDIT_TREND_DAYS) } },
        orderBy: { date: 'desc' },
        select: { date: true, overall: true },
      }),
    ]);

    if (!current) {
      return null;
    }

    const hasBaseline =
      baseline !== null && baseline.date.getTime() < current.date.getTime();
    const delta7d =
      hasBaseline && current.overall !== null && baseline.overall !== null
        ? current.overall - baseline.overall
        : null;

    return { current: current.overall, delta7d };
  }
}
