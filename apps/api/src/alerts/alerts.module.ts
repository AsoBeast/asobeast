import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { FLOW_PRODUCERS, QUEUES } from '../jobs/jobs.types';
import { AlertDeliveriesService } from './alert-deliveries.service';
import { AlertMail } from './alert-mail';
import { AlertFlushService } from './alert-flush.service';
import { AlertsController } from './alerts.controller';
import { AlertsDispatcher } from './alerts.dispatcher';
import { AlertsWorker } from './alerts.worker';
import { EmailAlertsController } from './email-alerts.controller';
import { EmailAlertUnsubscribe } from './email-alert-unsubscribe.service';
import { EmailAlertsService } from './email-alerts.service';
import { MailerService } from './mailer.service';
import { WebhookDelivery } from './webhook-delivery';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';

@Module({
  imports: [
    BullModule.registerQueue({ name: QUEUES.ALERTS }),
    BullModule.registerFlowProducer({ name: FLOW_PRODUCERS.ALERT_DELIVERY }),
  ],
  controllers: [WebhooksController, EmailAlertsController, AlertsController],
  providers: [
    WebhooksService,
    EmailAlertsService,
    EmailAlertUnsubscribe,
    AlertMail,
    AlertDeliveriesService,
    AlertFlushService,
    WebhookDelivery,
    MailerService,
    AlertsDispatcher,
    AlertsWorker,
  ],
  exports: [AlertsDispatcher, AlertFlushService, MailerService, BullModule],
})
export class AlertsModule {}
