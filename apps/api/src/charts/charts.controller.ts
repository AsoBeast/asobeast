import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  UseInterceptors,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ChartGenre, ChartPage } from '@asobeast/shared';
import { SpendsStoreCapacity } from '../auth/decorators/spends-store-capacity.decorator';
import { OnDemandLimiter } from '../auth/on-demand.limiter';
import { StoreDeadlineInterceptor } from '../store-providers/store-deadline.interceptor';
import { ChartReadService } from './chart-read.service';
import { ChartCaptureDto } from './dto/chart-capture.dto';
import { ChartGenresQueryDto } from './dto/chart-genres-query.dto';
import { ChartPageQueryDto } from './dto/chart-page-query.dto';

@ApiTags('charts')
@Controller('charts')
export class ChartsController {
  constructor(
    private readonly charts: ChartReadService,
    private readonly limiter: OnDemandLimiter,
  ) {}

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

  @Post('capture')
  @HttpCode(200)
  @SpendsStoreCapacity()
  @UseInterceptors(StoreDeadlineInterceptor)
  @ApiOperation({
    summary: 'Capture a top chart today',
    description:
      "Fetches today's chart from the store while you wait and stores it for every workspace, then answers the page for today. A chart already captured today is answered without a store request. Reaches the store, so it answers within the store deadline and spends one chart capture of the daily allowance only when a request is made; a refused key spends nothing.",
  })
  capture(@Body() dto: ChartCaptureDto): Promise<ChartPage> {
    return this.charts.captureToday(dto, () =>
      this.limiter.consume('chartCapture'),
    );
  }
}
