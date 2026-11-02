import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ActionRunModule } from '../actions/action-run.module';
import { ChangesModule } from '../changes/changes.module';
import { FLOW_PRODUCERS, QUEUES } from '../jobs/jobs.types';
import { KeywordsModule } from '../keywords/keywords.module';
import { ScreenshotsModule } from '../screenshots/screenshots.module';
import { StoreConnectModule } from '../store-connect/store-connect.module';
import { StoreProvidersModule } from '../store-providers/store-providers.module';
import { AppCaptureService } from './app-capture.service';
import { AppGroupsService } from './app-groups.service';
import { AppSetupController } from './app-setup.controller';
import { AppSetupService } from './app-setup.service';
import { AppsController } from './apps.controller';
import { AppsService } from './apps.service';
import { FirstRunScheduler } from './first-run.scheduler';
import { ListingCaptureService } from './listing-capture.service';
import { ListingReadService } from './listing-read.service';
import { LocalizationDetectionController } from './localization-detection.controller';
import { LocalizationDetection } from './localization-detection.service';
import { LocalizedListingCapture } from './localized-listing-capture.service';
import { MarketLocalizationRecorder } from './market-localization-recorder';
import { MarketSeedController } from './market-seed.controller';
import { MarketSeedService } from './market-seed.service';
import { MarketSuggestionsController } from './market-suggestions.controller';
import { MarketSuggestionsService } from './market-suggestions.service';
import { StoreSearchController } from './store-search.controller';
import { StoreSearchService } from './store-search.service';
import { SubtitleBackfill } from './subtitle-backfill.service';

@Module({
  imports: [
    ActionRunModule,
    StoreProvidersModule,
    StoreConnectModule,
    KeywordsModule,
    ChangesModule,
    ScreenshotsModule,
    BullModule.registerQueue(
      { name: QUEUES.APP_STORE },
      { name: QUEUES.GPLAY },
      { name: QUEUES.PIPELINE },
    ),
    BullModule.registerFlowProducer({ name: FLOW_PRODUCERS.FIRST_RUN }),
  ],
  controllers: [
    AppsController,
    AppSetupController,
    LocalizationDetectionController,
    MarketSeedController,
    MarketSuggestionsController,
    StoreSearchController,
  ],
  providers: [
    AppsService,
    AppCaptureService,
    AppGroupsService,
    AppSetupService,
    FirstRunScheduler,
    ListingCaptureService,
    ListingReadService,
    LocalizationDetection,
    LocalizedListingCapture,
    MarketLocalizationRecorder,
    MarketSeedService,
    MarketSuggestionsService,
    StoreSearchService,
    SubtitleBackfill,
  ],
  exports: [
    AppsService,
    AppCaptureService,
    LocalizationDetection,
    SubtitleBackfill,
  ],
})
export class AppsModule {}
