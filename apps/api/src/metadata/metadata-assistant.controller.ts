import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  MetadataAssistantResult,
  MetadataAssistantStatus,
} from '@asobeast/shared';
import { MetadataAssistantDto } from './dto/metadata-assistant.dto';
import { MetadataAssistantService } from './metadata-assistant.service';

@ApiTags('metadata')
@Controller()
export class MetadataAssistantController {
  constructor(private readonly assistant: MetadataAssistantService) {}

  @Get('metadata/assistant')
  @ApiOperation({ summary: 'AI metadata assistant availability' })
  status(): MetadataAssistantStatus {
    return this.assistant.status();
  }

  @Post('apps/:id/metadata/assistant')
  @ApiOperation({ summary: 'Generate AI metadata drafts for an app' })
  generate(
    @Param('id') id: string,
    @Body() dto: MetadataAssistantDto,
  ): Promise<MetadataAssistantResult> {
    return this.assistant.generate(id, dto);
  }
}
