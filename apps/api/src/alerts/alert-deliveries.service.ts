import { BadRequestException, Injectable } from '@nestjs/common';
import { AlertDelivery } from '@prisma/client';
import {
  AlertChannel,
  AlertDeliveryItem,
  DeliveryStatus,
  WebhookEvent,
} from '@asobeast/shared';
import { PrismaService } from '../prisma/prisma.service';
import { ListDeliveriesQueryDto } from './dto/list-deliveries-query.dto';

@Injectable()
export class AlertDeliveriesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListDeliveriesQueryDto): Promise<AlertDeliveryItem[]> {
    const { webhookId, emailAlertId, limit } = query;
    if (Boolean(webhookId) === Boolean(emailAlertId)) {
      throw new BadRequestException(
        'Provide exactly one of webhookId or emailAlertId',
      );
    }
    const deliveries = await this.prisma.alertDelivery.findMany({
      where: webhookId ? { webhookId } : { emailAlertId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return deliveries.map(toAlertDeliveryItem);
  }
}

function toAlertDeliveryItem(delivery: AlertDelivery): AlertDeliveryItem {
  return {
    id: delivery.id,
    channel: delivery.channel as AlertChannel,
    event: delivery.event as WebhookEvent,
    status: delivery.status as DeliveryStatus,
    detail: delivery.detail,
    attempt: delivery.attempt,
    createdAt: delivery.createdAt.toISOString(),
  };
}
