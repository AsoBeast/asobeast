import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { QUEUES } from '../jobs/jobs.types';
import { StoreProvidersModule } from '../store-providers/store-providers.module';
import { KeywordImportService } from './keyword-import.service';
import { KeywordSuggestionService } from './keyword-suggestion.service';
import { KeywordTracker } from './keyword-tracker';
import { KeywordsController } from './keywords.controller';
import { KeywordsService } from './keywords.service';
import { SpiderService } from './spider.service';
import { TrackedKeywordAccess } from './tracked-keyword.access';

@Module({
  imports: [
    StoreProvidersModule,
    BullModule.registerQueue(
      { name: QUEUES.APP_STORE },
      { name: QUEUES.GPLAY },
    ),
  ],
  controllers: [KeywordsController],
  providers: [
    KeywordsService,
    KeywordImportService,
    KeywordSuggestionService,
    KeywordTracker,
    SpiderService,
    TrackedKeywordAccess,
  ],
  exports: [
    KeywordsService,
    KeywordSuggestionService,
    SpiderService,
    TrackedKeywordAccess,
  ],
})
export class KeywordsModule {}
