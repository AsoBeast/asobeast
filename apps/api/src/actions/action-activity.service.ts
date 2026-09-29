import { Injectable } from '@nestjs/common';
import { ActionActivity, isActionEventType } from '@asobeast/shared';
import { utcToday } from '../analytics/analytics.support';
import { PrismaService } from '../prisma/prisma.service';
import {
  activityWindow,
  bucketActivity,
  COUNTED_EVENT_TYPES,
} from './action-activity';
import { ActionActivityQueryDto } from './dto/action-activity-query.dto';

@Injectable()
export class ActionActivityService {
  constructor(private readonly prisma: PrismaService) {}

  async read(query: ActionActivityQueryDto): Promise<ActionActivity> {
    const { from, to } = activityWindow(utcToday(), query.days);
    const events = await this.prisma.actionEvent.findMany({
      where: {
        occurredAt: { gte: from },
        type: { in: [...COUNTED_EVENT_TYPES] },
        ...(query.appId ? { appId: query.appId } : {}),
        ...(query.store || query.country
          ? { action: { store: query.store, country: query.country } }
          : {}),
      },
      select: { type: true, occurredAt: true },
    });
    return bucketActivity(
      events.flatMap((event) =>
        isActionEventType(event.type)
          ? [{ type: event.type, occurredAt: event.occurredAt }]
          : [],
      ),
      from,
      to,
    );
  }
}
