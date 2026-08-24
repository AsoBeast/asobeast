import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ChangeTimeline } from '@asobeast/shared';
import { ChangesService } from './changes.service';
import { ChangeTimelineQueryDto } from './dto/change-timeline-query.dto';

@ApiTags('changes')
@Controller('apps/:id/changes')
export class ChangesController {
  constructor(private readonly changes: ChangesService) {}

  @Get()
  @ApiOperation({
    summary: 'Metadata change timeline for an app and its competitors',
  })
  timeline(
    @Param('id') id: string,
    @Query() query: ChangeTimelineQueryDto,
  ): Promise<ChangeTimeline> {
    return this.changes.timeline(id, query.days);
  }
}
