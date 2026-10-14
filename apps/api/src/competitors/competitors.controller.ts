import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import {
  CompetitorAnalysis,
  CompetitorDiscovery,
  CompetitorItem,
  CompetitorSuggestions,
} from '@asobeast/shared';
import { SpendsStoreCapacity } from '../auth/decorators/spends-store-capacity.decorator';
import { OnDemandLimiter } from '../auth/on-demand.limiter';
import { CompetitorSuggestionsService } from './competitor-suggestions.service';
import { CompetitorsService } from './competitors.service';
import { AddCompetitorDto } from './dto/add-competitor.dto';
import { DiscoveryQueryDto } from './dto/discovery-query.dto';
import { StoreDeadlineInterceptor } from '../store-providers/store-deadline.interceptor';

@ApiTags('competitors')
@Controller('apps/:id/competitors')
export class CompetitorsController {
  constructor(
    private readonly competitors: CompetitorsService,
    private readonly suggestions: CompetitorSuggestionsService,
    private readonly limiter: OnDemandLimiter,
  ) {}

  @Get('analysis')
  @ApiOperation({ summary: 'Keyword gap and positioning analysis' })
  analysis(@Param('id') id: string): Promise<CompetitorAnalysis> {
    return this.competitors.analysis(id);
  }

  @Get('discovery')
  @ApiOperation({ summary: 'Untracked apps recurring in your keyword results' })
  discovery(
    @Param('id') id: string,
    @Query() query: DiscoveryQueryDto,
  ): Promise<CompetitorDiscovery> {
    return this.competitors.discovery(id, query);
  }

  @Get('suggestions')
  @SpendsStoreCapacity()
  @UseInterceptors(StoreDeadlineInterceptor)
  @ApiOperation({
    summary: 'Suggest competitors from the keyword results and similar apps',
    description:
      "The untracked apps that recur in this app's own keyword results over the last 30 days, with how often and how high they rank, followed by the apps the store lists as similar, each with its icon, minus the app and its tracked competitors, at most ten. The similar apps lookup reaches the store while you wait, answers within the store deadline and spends one store lookup of the hourly allowance; when the store fails the keyword result apps are still answered and similar reads unavailable. Answers 404 for a competitor or an unknown app.",
  })
  suggest(@Param('id') id: string): Promise<CompetitorSuggestions> {
    return this.suggestions.suggest(id, () =>
      this.limiter.consume('storeLookup'),
    );
  }

  @Post()
  @SpendsStoreCapacity()
  @ApiOperation({ summary: 'Add a competitor app from a store URL' })
  @UseInterceptors(StoreDeadlineInterceptor)
  @ApiUnprocessableEntityResponse({
    description:
      'The listing is not available on iPhone, so it cannot rank in the iPhone App Store search that asobeast reads',
  })
  add(
    @Param('id') id: string,
    @Body() dto: AddCompetitorDto,
  ): Promise<CompetitorItem> {
    return this.competitors.add(id, dto.url, () =>
      this.limiter.consume('addCompetitor'),
    );
  }

  @Get()
  @ApiOperation({ summary: 'List competitors for an app' })
  list(@Param('id') id: string): Promise<CompetitorItem[]> {
    return this.competitors.list(id);
  }

  @Delete(':competitorId')
  @HttpCode(204)
  @ApiOperation({ summary: 'Remove a competitor from an app' })
  remove(
    @Param('id') id: string,
    @Param('competitorId') competitorId: string,
  ): Promise<void> {
    return this.competitors.remove(id, competitorId);
  }
}
