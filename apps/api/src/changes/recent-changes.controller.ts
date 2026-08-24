import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ChangeTimeline } from '@asobeast/shared';
import { ChangesService } from './changes.service';
import { RecentChangesQueryDto } from './dto/recent-changes-query.dto';

@ApiTags('changes')
@Controller('changes')
export class RecentChangesController {
  constructor(private readonly changes: ChangesService) {}

  @Get('recent')
  @ApiOperation({
    summary: 'Recent metadata changes across the workspace',
  })
  recent(@Query() query: RecentChangesQueryDto): Promise<ChangeTimeline> {
    return this.changes.recent(query.limit);
  }
}
