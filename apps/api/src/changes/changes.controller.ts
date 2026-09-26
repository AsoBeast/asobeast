import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ChangeImpactReport, ChangeTimeline } from '@asobeast/shared';
import { ChangeImpactService } from './change-impact.service';
import { ChangesService } from './changes.service';
import { ChangeImpactQueryDto } from './dto/change-impact-query.dto';
import { ChangeTimelineQueryDto } from './dto/change-timeline-query.dto';

@ApiTags('changes')
@Controller('apps/:id/changes')
export class ChangesController {
  constructor(
    private readonly changes: ChangesService,
    private readonly changeImpact: ChangeImpactService,
  ) {}

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

  @Get('impact')
  @ApiOperation({
    summary:
      'Keyword position and visibility movement after each change to an app listing',
  })
  impact(
    @Param('id') id: string,
    @Query() query: ChangeImpactQueryDto,
  ): Promise<ChangeImpactReport> {
    return this.changeImpact.report(id, query.days, query.country);
  }
}
