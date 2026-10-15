import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { FLOW_PRODUCERS, QUEUES } from '../jobs/jobs.types';
import { StoreProvidersModule } from '../store-providers/store-providers.module';
import { AppLocalizationsService } from './app-localizations.service';
import { FirstPositionChecks } from './first-position-checks';
import { KeywordFieldService } from './keyword-field.service';
import { KeywordFieldWriter } from './keyword-field-writer';
import { KeywordImportService } from './keyword-import.service';
import { KeywordSuggestionService } from './keyword-suggestion.service';
import { KeywordTracker } from './keyword-tracker';
import { KeywordsController } from './keywords.controller';
import { LocalizationsController } from './localizations.controller';
import { LocalizedKeywordFieldService } from './localized-keyword-field.service';
import { KeywordsService } from './keywords.service';
import { MarketKeywordFieldsService } from './market-keyword-fields.service';
import { MarketListingRequests } from './market-listing.requests';
import { SpiderService } from './spider.service';
import { TrackedKeywordAccess } from './tracked-keyword.access';

@Module({
  imports: [
    StoreProvidersModule,
    BullModule.registerQueue(
      { name: QUEUES.APP_STORE },
      { name: QUEUES.GPLAY },
    ),
    BullModule.registerFlowProducer({ name: FLOW_PRODUCERS.FIRST_RUN }),
  ],
  controllers: [KeywordsController, LocalizationsController],
  providers: [
    AppLocalizationsService,
    FirstPositionChecks,
    KeywordsService,
    KeywordFieldService,
    KeywordFieldWriter,
    KeywordImportService,
    KeywordSuggestionService,
    KeywordTracker,
    LocalizedKeywordFieldService,
    MarketKeywordFieldsService,
    MarketListingRequests,
    SpiderService,
    TrackedKeywordAccess,
  ],
  exports: [
    AppLocalizationsService,
    FirstPositionChecks,
    KeywordsService,
    KeywordFieldService,
    KeywordSuggestionService,
    KeywordTracker,
    MarketListingRequests,
    SpiderService,
    TrackedKeywordAccess,
  ],
})
export class KeywordsModule {}
