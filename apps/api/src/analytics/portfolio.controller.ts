import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  PortfolioHistory,
  PortfolioInsights,
  PortfolioSummary,
} from '@asobeast/shared';
import { PortfolioHistoryQueryDto } from './dto/portfolio-history-query.dto';
import { PortfolioHistoryService } from './portfolio-history.service';
import { PortfolioInsightsService } from './portfolio-insights.service';
import { PortfolioService } from './portfolio.service';

@ApiTags('analytics')
@Controller('portfolio')
export class PortfolioController {
  constructor(
    private readonly portfolio: PortfolioService,
    private readonly insights: PortfolioInsightsService,
    private readonly historyReader: PortfolioHistoryService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Portfolio dashboard summary for the workspace',
    description:
      'Every primary app of the workspace with its visibility, sparkline and counts, the groups and the totals. visibility is the workspace as one figure over every tracked keyword, with its change against seven days earlier. discoveries counts the keywords each app could rank for that it does not track, and how many of them it already ranks for; see keyword discovery.',
  })
  getPortfolio(): Promise<PortfolioSummary> {
    return this.portfolio.portfolio();
  }

  @Get('insights')
  @ApiOperation({
    summary: 'Per app signals and cross-app movers for the portfolio dashboard',
  })
  getInsights(): Promise<PortfolioInsights> {
    return this.insights.insights();
  }

  @Get('history')
  @ApiOperation({
    summary: 'Daily workspace figures for the dashboard charts',
    description:
      "One point per checked day for the last days days and, as previous, for the same number of days before them: the visibility of every tracked keyword of every primary app as one figure, how many of them rank in the top 10, and how many climbed or fell against the app's previous checked day. change compares each app's latest checked day with the day days before it: the change in visibility and in the top 10 count (null when no app was checked that day), how many keywords climbed, fell, started ranking or dropped out, how many apps moved and the largest movers. Each app is read at its own latest checked day. days is 7, 30 or 90.",
  })
  getHistory(
    @Query() query: PortfolioHistoryQueryDto,
  ): Promise<PortfolioHistory> {
    return this.historyReader.history(query.days);
  }
}
