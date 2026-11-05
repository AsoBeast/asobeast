import { Controller, Get, Post, Query } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  AlertDeliveryItem,
  AlertDeliveryStatus,
  AlertEventList,
  AlertFlushResult,
  AlertsConfig,
} from '@asobeast/shared';
import { AlertDeliveriesService } from './alert-deliveries.service';
import { AlertEventFeed } from './alert-event-feed.service';
import { Env } from '../config/env';
import { AlertFlushService } from './alert-flush.service';
import { essentialAlertsNeed } from './default-alerts-readiness';
import { DefaultAlertsService } from './default-alerts.service';
import { ListAlertEventsQueryDto } from './dto/list-alert-events-query.dto';
import { ListDeliveriesQueryDto } from './dto/list-deliveries-query.dto';
import { MailerService } from './mailer.service';
import { QueuesWork } from '../redis/queues-work.decorator';

@ApiTags('alerts')
@Controller('alerts')
export class AlertsController {
  constructor(
    private readonly mailer: MailerService,
    private readonly deliveries: AlertDeliveriesService,
    private readonly flush: AlertFlushService,
    private readonly settings: ConfigService<Env, true>,
    private readonly defaults: DefaultAlertsService,
    private readonly feed: AlertEventFeed,
  ) {}

  @Get('config')
  @ApiOperation({ summary: 'Probe which alert channels are available' })
  async config(): Promise<AlertsConfig> {
    return {
      emailEnabled: this.mailer.enabled,
      rankDropThreshold: this.settings.get('ALERT_RANK_DROP_THRESHOLD', {
        infer: true,
      }),
      essentialAlertsNeed: essentialAlertsNeed(
        this.mailer.enabled,
        this.mailer.origin,
      ),
      essentialAlertsPending: await this.defaults.pending(),
    };
  }

  @Get('delivery')
  @ApiOperation({ summary: 'Report the alert delivery mode and outbox status' })
  delivery(): Promise<AlertDeliveryStatus> {
    return this.flush.status();
  }

  @Post('flush')
  @QueuesWork()
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

  @Get('events')
  @ApiOperation({
    summary: 'List the events the daily run detected',
    description:
      "Lists the alert events the pipeline recorded for the workspace in the last 30 days, newest first, whether or not any webhook or email alert is subscribed. Each item carries the event, the time it was recorded, the app, the market, one plain sentence and the typed payload. review.new and digest.weekly are never listed, and a drop or exit repeated for subscribers that wait for confirmation is listed once. type takes one or more feed events, comma separated or repeated. appId includes the app's competitors and the search result entrants of the keywords it tracks. since is an ISO 8601 date or instant and is exclusive. Page with nextCursor, which is null on the last page. Answers 400 for an unknown type, a bad since, cursor or limit, and 404 for an app that is not in the workspace.",
  })
  listEvents(@Query() query: ListAlertEventsQueryDto): Promise<AlertEventList> {
    return this.feed.list(query);
  }
}
