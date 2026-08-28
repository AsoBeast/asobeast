import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { BullBoardModule } from '@bull-board/nestjs';
import { BullModule } from '@nestjs/bullmq';
import type { QueueOptions, RedisOptions } from 'bullmq';
import { DynamicModule, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ActionsEngineModule } from '../actions/actions-engine.module';
import { AlertsModule } from '../alerts/alerts.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { AccountModule } from '../account/account.module';
import { AppsModule } from '../apps/apps.module';
import { AuditModule } from '../audit/audit.module';
import { ADMIN_QUEUES_ROUTE, requireAdminAccess } from '../auth/admin-access';
import { CategoryRanksModule } from '../category-ranks/category-ranks.module';
import { Env } from '../config/env';
import { KeywordsModule } from '../keywords/keywords.module';
import { RankingsModule } from '../rankings/rankings.module';
import { ReviewsModule } from '../reviews/reviews.module';
import { ScoringModule } from '../scoring/scoring.module';
import { ProxyPoolModule } from '../store-providers/egress/proxy-pool.module';
import { AppStoreWorker } from './app-store.worker';
import { DigestDispatcher } from './digest.dispatcher';
import { GplayWorker } from './gplay.worker';
import { ActiveWorkspaces } from './active-workspaces';
import { JobTargetCountry } from './job-target-country';
import { OverLimitRegistry } from './over-limit.registry';
import {
  BudgetController,
  CapacityController,
  JobsController,
} from './jobs.controller';
import { CapacityService } from './capacity.service';
import { DailyBudgetService } from './daily-budget.service';
import { DailyCapacity } from './daily-capacity.service';
import { DailyTargetsCollector } from './daily-targets.service';
import { FirstRunStatusService } from './first-run-status.service';
import { FLOW_PRODUCERS, QUEUES } from './jobs.types';
import { PipelineService } from './pipeline.service';
import { PipelineWorker } from './pipeline.worker';
import { RetentionService } from './retention.service';
import { RunStatusService } from './run-status.service';
import { ScoringController } from './scoring.controller';
import { StoreJobsHandler } from './store-jobs.handler';
import { JOB_OPTIONS } from './job-options';

const bullBoardModules: DynamicModule[] =
  (process.env.BULL_BOARD_ENABLED ?? 'true') === 'false'
    ? []
    : [
        BullBoardModule.forRoot({
          route: ADMIN_QUEUES_ROUTE,
          adapter: ExpressAdapter,
          middleware: requireAdminAccess,
        }),
        BullBoardModule.forFeature(
          { name: QUEUES.PIPELINE, adapter: BullMQAdapter },
          { name: QUEUES.APP_STORE, adapter: BullMQAdapter },
          { name: QUEUES.GPLAY, adapter: BullMQAdapter },
          { name: QUEUES.ALERTS, adapter: BullMQAdapter },
          { name: QUEUES.BILLING, adapter: BullMQAdapter },
        ),
      ];

function redisConnection(config: ConfigService<Env, true>): RedisOptions {
  const host: string = config.get('REDIS_HOST', { infer: true });
  const port: number = config.get('REDIS_PORT', { infer: true });
  const db: number = config.get('REDIS_DB', { infer: true });
  return { host, port, db };
}

@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>): QueueOptions => ({
        connection: redisConnection(config),
        defaultJobOptions: JOB_OPTIONS,
      }),
    }),
    BullModule.registerQueue(
      { name: QUEUES.PIPELINE },
      { name: QUEUES.APP_STORE },
      { name: QUEUES.GPLAY },
    ),
    BullModule.registerFlowProducer({ name: FLOW_PRODUCERS.DAILY_PIPELINE }),
    AccountModule,
    AppsModule,
    RankingsModule,
    CategoryRanksModule,
    KeywordsModule,
    ScoringModule,
    AlertsModule,
    AnalyticsModule,
    ReviewsModule,
    AuditModule,
    ActionsEngineModule,
    ProxyPoolModule,
    ...bullBoardModules,
  ],
  controllers: [
    JobsController,
    BudgetController,
    CapacityController,
    ScoringController,
  ],
  providers: [
    ActiveWorkspaces,
    CapacityService,
    DailyBudgetService,
    DailyCapacity,
    DailyTargetsCollector,
    FirstRunStatusService,
    JobTargetCountry,
    OverLimitRegistry,
    StoreJobsHandler,
    AppStoreWorker,
    GplayWorker,
    PipelineWorker,
    PipelineService,
    RetentionService,
    RunStatusService,
    DigestDispatcher,
  ],
  exports: [BullModule, PipelineService],
})
export class JobsModule {}
