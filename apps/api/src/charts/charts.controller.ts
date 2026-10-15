import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ChartGenre, ChartPage } from '@asobeast/shared';
import { ChartReadService } from './chart-read.service';
import { ChartGenresQueryDto } from './dto/chart-genres-query.dto';
import { ChartPageQueryDto } from './dto/chart-page-query.dto';

@ApiTags('charts')
@Controller('charts')
export class ChartsController {
  constructor(private readonly charts: ChartReadService) {}

  @Get()
  @ApiOperation({
    summary: 'Read a top chart for one day',
    description:
      'One day of a free, paid or grossing chart of one store, country, category and device: every row with its position, its position on the comparison day and the movement between them, the climbers, fallers, new entries and exits, the days a capture exists for, whether this workspace follows the chart, and which rows are its own apps or competitors. Reads what the daily run or a capture stored; never reaches the store.',
  })
  page(@Query() query: ChartPageQueryDto): Promise<ChartPage> {
    return this.charts.page(query);
  }

  @Get('genres')
  @ApiOperation({ summary: 'List the chart categories of a store' })
  genres(@Query() query: ChartGenresQueryDto): readonly ChartGenre[] {
    return this.charts.genres(query.store);
  }
}
