import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { QUEUES } from '../jobs/jobs.types';
import { ScoringModule } from '../scoring/scoring.module';
import { KeywordInspectionRunner } from './keyword-inspection.runner';
import { KeywordInspectionsController } from './keyword-inspections.controller';
import { KeywordInspectionsService } from './keyword-inspections.service';

@Module({
  imports: [
    ScoringModule,
    BullModule.registerQueue(
      { name: QUEUES.APP_STORE },
      { name: QUEUES.GPLAY },
    ),
  ],
  controllers: [KeywordInspectionsController],
  providers: [KeywordInspectionsService, KeywordInspectionRunner],
  exports: [KeywordInspectionRunner],
})
export class KeywordInspectionsModule {}
