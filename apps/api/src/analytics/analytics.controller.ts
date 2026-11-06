import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  AppSummary,
  RankDistributionHistory,
  RatingsHistory,
  VisibilityHistory,
} from '@asobeast/shared';
import { AnalyticsService } from './analytics.service';
import { MarketHistoryQueryDto } from './dto/market-history-query.dto';
import { KeywordMarketQueryDto } from './dto/keyword-market-query.dto';
import { VisibilityCompareQueryDto } from './dto/visibility-compare-query.dto';
import { VisibilityHistoryQueryDto } from './dto/visibility-history-query.dto';

@ApiTags('analytics')
@Controller('apps')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get(':id/summary')
  @ApiOperation({
    summary: 'Dashboard summary for an app',
    description:
      'Visibility, rank distribution, movers, coverage and counts of the app, for every market or one, with shareOfVoice: the visibility of the app as a percentage of the summed visibility of the app and the tracked competitors checked on the same day, over the same keywords, and the 7 day change; the reason is named when there is none. discoveries counts the keywords the app could rank for that it does not track, and how many of them it already ranks for; see keyword discovery.',
  })
  getSummary(
    @Param('id') id: string,
    @Query() query: KeywordMarketQueryDto,
  ): Promise<AppSummary> {
    return this.analytics.summary(id, query.country);
  }

  @Get(':id/visibility-history')
  @ApiOperation({
    summary: 'Visibility score history series for an app',
    description:
      "Daily visibility of the app over a date window, for every market or one. compare=competitors also answers shareOfVoice, the app's visibility as a percentage of the summed visibility of the app and the tracked competitors checked that day, with the number of competitors counted on each day.",
  })
  getVisibilityHistory(
    @Param('id') id: string,
    @Query() query: VisibilityCompareQueryDto,
  ): Promise<VisibilityHistory> {
    return this.analytics.history(id, query);
  }

  @Get(':id/rank-distribution-history')
  @ApiOperation({ summary: 'Rank distribution history bands for an app' })
  getRankDistributionHistory(
    @Param('id') id: string,
    @Query() query: MarketHistoryQueryDto,
  ): Promise<RankDistributionHistory> {
    return this.analytics.rankDistributionHistory(id, query);
  }

  @Get(':id/ratings-history')
  @ApiOperation({ summary: 'Ratings average and count history for an app' })
  getRatingsHistory(
    @Param('id') id: string,
    @Query() query: VisibilityHistoryQueryDto,
  ): Promise<RatingsHistory> {
    return this.analytics.ratingsHistory(id, query);
  }
}
