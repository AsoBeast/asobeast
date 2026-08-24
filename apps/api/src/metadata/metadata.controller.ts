import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { MetadataAuditResult } from '@asobeast/shared';
import { MetadataService } from './metadata.service';

@ApiTags('metadata')
@Controller('apps/:id/metadata')
export class MetadataController {
  constructor(private readonly metadata: MetadataService) {}

  @Get('audit')
  @ApiOperation({ summary: 'Metadata lint and keyword coverage matrix' })
  audit(@Param('id') id: string): Promise<MetadataAuditResult> {
    return this.metadata.audit(id);
  }
}
