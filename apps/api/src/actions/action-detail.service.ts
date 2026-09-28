import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ActionDetail } from '@asobeast/shared';
import { utcToday } from '../analytics/analytics.support';
import { PrismaService } from '../prisma/prisma.service';
import { EVENT_SELECT, toActionEventItem } from './action-events';
import { measureOutcome } from './action-outcome';
import { ActionSeriesReader } from './action-series.reader';
import { ROW_SELECT, toActionItem } from './actions.mapper';

@Injectable()
export class ActionDetailService {
  private readonly logger = new Logger(ActionDetailService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly series: ActionSeriesReader,
  ) {}

  async get(id: string): Promise<ActionDetail> {
    const [row, events] = await Promise.all([
      this.prisma.actionItem.findFirst({ where: { id }, select: ROW_SELECT }),
      this.prisma.actionEvent.findMany({
        where: { actionId: id },
        orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }],
        select: EVENT_SELECT,
      }),
    ]);
    if (!row) {
      throw new NotFoundException('Action not found');
    }

    const item = toActionItem(row);
    const trend = await this.series.read(item, utcToday());
    return {
      ...item,
      events: events.flatMap((event) => {
        const item = toActionEventItem(event);
        if (!item) {
          this.logger.warn(`action event ${event.id} has an unknown type`);
          return [];
        }
        return [item];
      }),
      trend,
      outcome:
        trend && item.status === 'DONE' && item.closedAt
          ? measureOutcome(trend, new Date(item.closedAt))
          : null,
    };
  }
}
