import { Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import {
  AppAuditResult,
  AuditAiRunResult,
  AuditHistory,
} from '@asobeast/shared';
import { AuditAiRunsService } from './audit-ai-runs.service';
import { AuditService } from './audit.service';
import { AuditHistoryQueryDto } from './dto/audit-history-query.dto';

@ApiTags('audit')
@Controller('apps/:id/audit')
export class AuditController {
  constructor(
    private readonly audit: AuditService,
    private readonly runs: AuditAiRunsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'ASO audit score card for an app' })
  getAudit(@Param('id') id: string): Promise<AppAuditResult> {
    return this.audit.audit(id);
  }

  @Get('history')
  @ApiOperation({ summary: 'ASO audit score history series for an app' })
  history(
    @Param('id') id: string,
    @Query() query: AuditHistoryQueryDto,
  ): Promise<AuditHistory> {
    return this.audit.history(id, query);
  }

  @Post('ai')
  @ApiOperation({
    summary:
      'Run the AI audit synchronously (deprecated: use POST /apps/{id}/audit/ai/runs)',
  })
  runAi(@Param('id') id: string): Promise<AppAuditResult> {
    return this.audit.runAi(id);
  }

  @Post('ai/runs')
  @HttpCode(202)
  @ApiAcceptedResponse({
    description:
      'The creative analysis is queued, running or already up to date',
  })
  @ApiNotFoundResponse({ description: 'No such app in this workspace' })
  @ApiConflictResponse({ description: 'OPENAI_API_KEY is not configured' })
  @ApiUnprocessableEntityResponse({
    description: 'A competitor row, or a listing with nothing to analyze',
  })
  @ApiOperation({ summary: 'Queue the AI creative analysis for an app' })
  requestAiRun(@Param('id') id: string): Promise<AuditAiRunResult> {
    return this.runs.request(id);
  }
}
