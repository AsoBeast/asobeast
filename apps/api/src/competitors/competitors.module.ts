import { Module } from '@nestjs/common';
import { AppsModule } from '../apps/apps.module';
import { KeywordsModule } from '../keywords/keywords.module';
import { StoreProvidersModule } from '../store-providers/store-providers.module';
import { CompetitorsController } from './competitors.controller';
import { CompetitorsService } from './competitors.service';
import { KeywordIdeasService } from './keyword-ideas.service';

@Module({
  imports: [AppsModule, KeywordsModule, StoreProvidersModule],
  controllers: [CompetitorsController],
  providers: [CompetitorsService, KeywordIdeasService],
})
export class CompetitorsModule {}
