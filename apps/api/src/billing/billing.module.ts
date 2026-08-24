import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QUEUES } from '../jobs/jobs.types';
import { AlertsModule } from '../alerts/alerts.module';
import { Env } from '../config/env';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { BillingWebhookController } from './billing-webhook.controller';
import { BillingWebhookService } from './billing-webhook.service';
import { BillingReconciler } from './billing-reconciler.service';
import { AccountNotifier } from './account-notifier.service';
import { DowngradeWarner } from './downgrade-warner.service';
import { TrialNotifier } from './trial-notifier.service';
import { BillingWorker } from './billing.worker';
import { PriceCatalog } from './price-catalog';
import { STRIPE_CLIENT, createStripeClient } from './stripe.client';
import { StripeService } from './stripe.service';

@Module({
  imports: [AlertsModule, BullModule.registerQueue({ name: QUEUES.BILLING })],
  controllers: [BillingController, BillingWebhookController],
  providers: [
    {
      provide: STRIPE_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        createStripeClient(config.get('STRIPE_SECRET_KEY', { infer: true })),
    },
    StripeService,
    PriceCatalog,
    BillingService,
    BillingWebhookService,
    BillingReconciler,
    AccountNotifier,
    TrialNotifier,
    DowngradeWarner,
    BillingWorker,
  ],
  exports: [
    StripeService,
    PriceCatalog,
    BillingService,
    BillingWebhookService,
    BillingReconciler,
    AccountNotifier,
  ],
})
export class BillingModule {}
