import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { KeywordsModule } from '../keywords/keywords.module';
import { QUEUES } from '../jobs/jobs.types';
import { AuditAiRunsService } from './audit-ai-runs.service';
import { AuditAiService } from './audit-ai.service';
import { AuditContextLoader } from './audit-context.loader';
import { AuditCreativeWorker } from './audit-creative.worker';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';

@Module({
  imports: [
    AiModule,
    AnalyticsModule,
    KeywordsModule,
    BullModule.registerQueue({ name: QUEUES.AI }),
  ],
  controllers: [AuditController],
  providers: [
    AuditService,
    AuditContextLoader,
    AuditAiService,
    AuditAiRunsService,
    AuditCreativeWorker,
  ],
  exports: [AuditService],
})
export class AuditModule {}
