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
      "One point per checked day for the last days days and, as previous, for the same number of days before them: the visibility of every tracked keyword of every primary app as one figure, how many of them rank in the top 10, and how many climbed or fell against the app's previous checked day. change compares each app's latest checked day with the day days before it, leaving out an app whose latest check is older than the range: the change in visibility and in the top 10 count (null when no app was checked that day), how many keywords climbed, fell, started ranking or dropped out, how many apps moved and the largest movers. A point counts every app: one that was not checked that day keeps the figures of its latest earlier check, and its moves count only on the days it was checked. days is 7, 30 or 90. bands splits the keywords of each point by rank. apps answers each primary app with its own points, its change over the range and how many of its keywords moved in its last run; stores pools the apps of each store the same way. lastRun compares each app checked on the newest day with the day before it, over the keywords checked on both days. listingChanges lists, per day and app, the fields a primary app changed in its home listing within the range, leaving out what the store decides (featuring, Editors' Choice). appId or store narrows the whole answer to one primary app or to the primary apps of one store.",
  })
  getHistory(
    @Query() query: PortfolioHistoryQueryDto,
  ): Promise<PortfolioHistory> {
    return this.historyReader.history(query.days, {
      appId: query.appId,
      store: query.store,
    });
  }
}
