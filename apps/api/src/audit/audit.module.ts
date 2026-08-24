import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { KeywordsModule } from '../keywords/keywords.module';
import { AuditAiService } from './audit-ai.service';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';

@Module({
  imports: [AiModule, KeywordsModule],
  controllers: [AuditController],
  providers: [AuditService, AuditAiService],
  exports: [AuditService],
})
export class AuditModule {}
