import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ActionDetail } from '@asobeast/shared';
import { PrismaService } from '../prisma/prisma.service';
import { EVENT_SELECT, toActionEventItem } from './action-events';
import { ROW_SELECT, toActionItem } from './actions.mapper';

@Injectable()
export class ActionDetailService {
  private readonly logger = new Logger(ActionDetailService.name);

  constructor(private readonly prisma: PrismaService) {}

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

    return {
      ...toActionItem(row),
      events: events.flatMap((event) => {
        const item = toActionEventItem(event);
        if (!item) {
          this.logger.warn(`action event ${event.id} has an unknown type`);
          return [];
        }
        return [item];
      }),
      trend: null,
      outcome: null,
    };
  }
}
