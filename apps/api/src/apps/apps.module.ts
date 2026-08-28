import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ChangesModule } from '../changes/changes.module';
import { QUEUES } from '../jobs/jobs.types';
import { KeywordsModule } from '../keywords/keywords.module';
import { StoreProvidersModule } from '../store-providers/store-providers.module';
import { AppCaptureService } from './app-capture.service';
import { AppGroupsService } from './app-groups.service';
import { AppsController } from './apps.controller';
import { AppsService } from './apps.service';
import { FirstRunScheduler } from './first-run.scheduler';

@Module({
  imports: [
    StoreProvidersModule,
    KeywordsModule,
    ChangesModule,
    BullModule.registerQueue(
      { name: QUEUES.APP_STORE },
      { name: QUEUES.GPLAY },
      { name: QUEUES.PIPELINE },
    ),
  ],
  controllers: [AppsController],
  providers: [
    AppsService,
    AppCaptureService,
    AppGroupsService,
    FirstRunScheduler,
  ],
  exports: [AppsService, AppCaptureService],
})
export class AppsModule {}
