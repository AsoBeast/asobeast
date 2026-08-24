import { Controller, Get, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  AlertDeliveryItem,
  AlertDeliveryStatus,
  AlertFlushResult,
  AlertsConfig,
} from '@asobeast/shared';
import { AlertDeliveriesService } from './alert-deliveries.service';
import { AlertFlushService } from './alert-flush.service';
import { ListDeliveriesQueryDto } from './dto/list-deliveries-query.dto';
import { MailerService } from './mailer.service';

@ApiTags('alerts')
@Controller('alerts')
export class AlertsController {
  constructor(
    private readonly mailer: MailerService,
    private readonly deliveries: AlertDeliveriesService,
    private readonly flush: AlertFlushService,
  ) {}

  @Get('config')
  @ApiOperation({ summary: 'Probe which alert channels are available' })
  config(): AlertsConfig {
    return { emailEnabled: this.mailer.enabled };
  }

  @Get('delivery')
  @ApiOperation({ summary: 'Report the alert delivery mode and outbox status' })
  delivery(): Promise<AlertDeliveryStatus> {
    return this.flush.status();
  }

  @Post('flush')
  @ApiOperation({ summary: 'Flush the alert outbox into grouped deliveries' })
  flushNow(): Promise<AlertFlushResult> {
    return this.flush.flush();
  }

  @Get('deliveries')
  @ApiOperation({ summary: 'List recent alert deliveries for one channel' })
  listDeliveries(
    @Query() query: ListDeliveriesQueryDto,
  ): Promise<AlertDeliveryItem[]> {
    return this.deliveries.list(query);
  }
}
