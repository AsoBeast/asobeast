import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { KeywordsModule } from '../keywords/keywords.module';
import { AuditAiService } from './audit-ai.service';
import { AuditContextLoader } from './audit-context.loader';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';

@Module({
  imports: [AiModule, KeywordsModule],
  controllers: [AuditController],
  providers: [AuditService, AuditContextLoader, AuditAiService],
  exports: [AuditService],
})
export class AuditModule {}
