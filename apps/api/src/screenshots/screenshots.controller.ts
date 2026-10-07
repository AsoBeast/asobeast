import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AppScreenshots } from '@asobeast/shared';
import { ScreenshotsService } from './screenshots.service';

@ApiTags('screenshots')
@Controller('apps/:id/screenshots')
export class ScreenshotsController {
  constructor(private readonly screenshots: ScreenshotsService) {}

  @Get()
  @ApiOperation({
    summary:
      'Screenshots of the latest snapshot with the caption read from each',
  })
  list(@Param('id') id: string): Promise<AppScreenshots> {
    return this.screenshots.forApp(id);
  }
}
