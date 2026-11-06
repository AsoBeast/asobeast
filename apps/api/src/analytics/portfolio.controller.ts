import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PortfolioInsights, PortfolioSummary } from '@asobeast/shared';
import { PortfolioInsightsService } from './portfolio-insights.service';
import { PortfolioService } from './portfolio.service';

@ApiTags('analytics')
@Controller('portfolio')
export class PortfolioController {
  constructor(
    private readonly portfolio: PortfolioService,
    private readonly insights: PortfolioInsightsService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Portfolio dashboard summary for the workspace',
    description:
      'Every primary app of the workspace with its visibility, sparkline and counts, the groups and the totals. discoveries counts the keywords each app could rank for that it does not track, and how many of them it already ranks for; see keyword discovery.',
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
}
