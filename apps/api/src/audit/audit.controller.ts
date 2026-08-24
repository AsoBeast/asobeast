import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AppAuditResult, AuditHistory } from '@asobeast/shared';
import { AuditService } from './audit.service';
import { AuditHistoryQueryDto } from './dto/audit-history-query.dto';

@ApiTags('audit')
@Controller('apps/:id/audit')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

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
  @ApiOperation({ summary: 'Run the AI audit for an app and recompute' })
  runAi(@Param('id') id: string): Promise<AppAuditResult> {
    return this.audit.runAi(id);
  }
}
