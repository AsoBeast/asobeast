import { Module } from '@nestjs/common';
import { AppsModule } from '../apps/apps.module';
import { KeywordsModule } from '../keywords/keywords.module';
import { CompetitorsController } from './competitors.controller';
import { CompetitorsService } from './competitors.service';

@Module({
  imports: [AppsModule, KeywordsModule],
  controllers: [CompetitorsController],
  providers: [CompetitorsService],
})
export class CompetitorsModule {}
