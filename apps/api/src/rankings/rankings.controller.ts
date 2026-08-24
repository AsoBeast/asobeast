import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RankingSeries, SerpMovers } from '@asobeast/shared';
import { RankingHistoryQueryDto } from './dto/ranking-history-query.dto';
import { SerpMoversQueryDto } from './dto/serp-movers-query.dto';
import { RankingsService } from './rankings.service';
import { SerpService } from './serp.service';

@ApiTags('rankings')
@Controller('apps')
export class RankingsController {
  constructor(
    private readonly rankings: RankingsService,
    private readonly serp: SerpService,
  ) {}

  @Get(':id/rankings')
  @ApiOperation({ summary: 'Ranking history series for an app' })
  history(
    @Param('id') id: string,
    @Query() query: RankingHistoryQueryDto,
  ): Promise<RankingSeries> {
    return this.rankings.history(id, query);
  }

  @Get(':id/serp-movers')
  @ApiOperation({
    summary: 'Apps that broke into the top 10 for tracked keywords',
  })
  serpMovers(
    @Param('id') id: string,
    @Query() query: SerpMoversQueryDto,
  ): Promise<SerpMovers> {
    return this.serp.serpMovers(id, query);
  }
}
