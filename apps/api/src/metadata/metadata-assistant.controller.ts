import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import {
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import {
  MetadataAssistantResult,
  MetadataAssistantStatus,
} from '@asobeast/shared';
import type { User } from '@prisma/client';
import { AI_ALLOWANCE_SPENT_RESPONSE } from '../ai/ai-allowance.errors';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
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
  @ApiTooManyRequestsResponse(AI_ALLOWANCE_SPENT_RESPONSE)
  @ApiOperation({ summary: 'Generate AI metadata drafts for an app' })
  generate(
    @Param('id') id: string,
    @Body() dto: MetadataAssistantDto,
    @CurrentUser() user: User,
  ): Promise<MetadataAssistantResult> {
    return this.assistant.generate(id, dto, user.id);
  }
}
