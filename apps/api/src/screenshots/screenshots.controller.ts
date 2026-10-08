import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AppScreenshots } from '@asobeast/shared';
import { ListingMarketQueryDto } from '../apps/dto/listing-market-query.dto';
import { ScreenshotsService } from './screenshots.service';

@ApiTags('screenshots')
@Controller('apps/:id/screenshots')
export class ScreenshotsController {
  constructor(private readonly screenshots: ScreenshotsService) {}

  @Get()
  @ApiOperation({
    summary:
      'Screenshots of the latest snapshot of a listing with the caption read from each',
  })
  list(
    @Param('id') id: string,
    @Query() query: ListingMarketQueryDto,
  ): Promise<AppScreenshots> {
    return this.screenshots.forApp(id, query.country);
  }
}
