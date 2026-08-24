import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PortfolioSummary } from '@asobeast/shared';
import { PortfolioService } from './portfolio.service';

@ApiTags('analytics')
@Controller('portfolio')
export class PortfolioController {
  constructor(private readonly portfolio: PortfolioService) {}

  @Get()
  @ApiOperation({ summary: 'Portfolio dashboard summary for the workspace' })
  getPortfolio(): Promise<PortfolioSummary> {
    return this.portfolio.portfolio();
  }
}
