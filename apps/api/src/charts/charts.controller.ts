import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Res,
  UseInterceptors,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ChartFollowItem, ChartGenre, ChartPage } from '@asobeast/shared';
import { SpendsStoreCapacity } from '../auth/decorators/spends-store-capacity.decorator';
import { OnDemandLimiter } from '../auth/on-demand.limiter';
import { StoreDeadlineInterceptor } from '../store-providers/store-deadline.interceptor';
import { ChartFollowsService } from './chart-follows.service';
import { ChartReadService } from './chart-read.service';
import { ChartCaptureDto } from './dto/chart-capture.dto';
import { ChartFollowDto } from './dto/chart-follow.dto';
import { ChartGenresQueryDto } from './dto/chart-genres-query.dto';
import { ChartPageQueryDto } from './dto/chart-page-query.dto';

@ApiTags('charts')
@Controller('charts')
export class ChartsController {
  constructor(
    private readonly charts: ChartReadService,
    private readonly follows: ChartFollowsService,
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

  @Get('follows')
  @ApiOperation({ summary: 'List the top charts this workspace follows' })
  listFollows(): Promise<ChartFollowItem[]> {
    return this.follows.list();
  }

  @Post('follows')
  @ApiOperation({
    summary: 'Follow a top chart',
    description:
      'Asks the daily run to capture this chart every day. Answers 201 for a new follow and 200 with the existing one when the workspace already follows the chart. Writes nothing to the store; capture today separately.',
  })
  async follow(
    @Body() dto: ChartFollowDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ChartFollowItem> {
    const { item, created } = await this.follows.follow(dto);
    res.status(created ? HttpStatus.CREATED : HttpStatus.OK);
    return item;
  }

  @Delete('follows/:id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Stop following a top chart' })
  forget(@Param('id') id: string): Promise<void> {
    return this.follows.forget(id);
  }
}
