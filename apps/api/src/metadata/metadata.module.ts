import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { KeywordsModule } from '../keywords/keywords.module';
import { MetadataAssistantController } from './metadata-assistant.controller';
import { MetadataAssistantService } from './metadata-assistant.service';
import { MetadataController } from './metadata.controller';
import { MetadataService } from './metadata.service';

@Module({
  imports: [AiModule, KeywordsModule],
  controllers: [MetadataController, MetadataAssistantController],
  providers: [MetadataService, MetadataAssistantService],
  exports: [MetadataService],
})
export class MetadataModule {}
