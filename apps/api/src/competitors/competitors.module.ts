import { Module } from '@nestjs/common';
import { AppsModule } from '../apps/apps.module';
import { KeywordsModule } from '../keywords/keywords.module';
import { StoreProvidersModule } from '../store-providers/store-providers.module';
import { CompetitorSuggestionsService } from './competitor-suggestions.service';
import { CompetitorsController } from './competitors.controller';
import { CompetitorsService } from './competitors.service';

@Module({
  imports: [AppsModule, KeywordsModule, StoreProvidersModule],
  controllers: [CompetitorsController],
  providers: [CompetitorsService, CompetitorSuggestionsService],
})
export class CompetitorsModule {}
