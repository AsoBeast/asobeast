import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { StoreFunnelReport } from '@asobeast/shared';
import { StoreFunnelQueryDto } from './dto/store-funnel-query.dto';
import { StoreFunnelService } from './store-funnel.service';

@ApiTags('store-connect')
@Controller('apps')
export class StoreFunnelController {
  constructor(private readonly funnel: StoreFunnelService) {}

  @Get(':id/funnel')
  @ApiOperation({
    summary:
      'Store impressions, page views, downloads and conversion of an app by market and window',
    description:
      'Reads the rows the connected store console reported: a zero filled daily series of the requested days with the total and the search share, and the 7, 14 and 28 day windows of complete days against the period before. A day is complete once it is three days old and the store has delivered it. Answers connected false and empty series for a competitor, a store without an active connection, or an app the connected key does not report.',
  })
  report(
    @Param('id') id: string,
    @Query() query: StoreFunnelQueryDto,
  ): Promise<StoreFunnelReport> {
    return this.funnel.report(id, query);
  }
}
