import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ActionRunModule } from '../actions/action-run.module';
import { ChangesModule } from '../changes/changes.module';
import { FLOW_PRODUCERS, QUEUES } from '../jobs/jobs.types';
import { KeywordsModule } from '../keywords/keywords.module';
import { StoreProvidersModule } from '../store-providers/store-providers.module';
import { AppCaptureService } from './app-capture.service';
import { AppGroupsService } from './app-groups.service';
import { AppsController } from './apps.controller';
import { AppsService } from './apps.service';
import { FirstRunScheduler } from './first-run.scheduler';
import { SubtitleBackfill } from './subtitle-backfill.service';

@Module({
  imports: [
    ActionRunModule,
    StoreProvidersModule,
    KeywordsModule,
    ChangesModule,
    BullModule.registerQueue(
      { name: QUEUES.APP_STORE },
      { name: QUEUES.GPLAY },
      { name: QUEUES.PIPELINE },
    ),
    BullModule.registerFlowProducer({ name: FLOW_PRODUCERS.FIRST_RUN }),
  ],
  controllers: [AppsController],
  providers: [
    AppsService,
    AppCaptureService,
    AppGroupsService,
    FirstRunScheduler,
    SubtitleBackfill,
  ],
  exports: [AppsService, AppCaptureService, SubtitleBackfill],
})
export class AppsModule {}
