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
  CompetitorKeywordIdeas,
} from '@asobeast/shared';
import { SpendsStoreCapacity } from '../auth/decorators/spends-store-capacity.decorator';
import { OnDemandLimiter } from '../auth/on-demand.limiter';
import { CompetitorsService } from './competitors.service';
import { AddCompetitorDto } from './dto/add-competitor.dto';
import { DiscoveryQueryDto } from './dto/discovery-query.dto';
import { KeywordIdeasQueryDto } from './dto/keyword-ideas-query.dto';
import { KeywordIdeasService } from './keyword-ideas.service';
import { StoreDeadlineInterceptor } from '../store-providers/store-deadline.interceptor';

@ApiTags('competitors')
@Controller('apps/:id/competitors')
export class CompetitorsController {
  constructor(
    private readonly competitors: CompetitorsService,
    private readonly keywordIdeasReads: KeywordIdeasService,
    private readonly limiter: OnDemandLimiter,
  ) {}

  @Get('analysis')
  @ApiOperation({ summary: 'Keyword gap and positioning analysis' })
  analysis(@Param('id') id: string): Promise<CompetitorAnalysis> {
    return this.competitors.analysis(id);
  }

  @Get('keyword-ideas')
  @SpendsStoreCapacity()
  @UseInterceptors(StoreDeadlineInterceptor)
  @ApiOperation({
    summary:
      'Search suggestions the store returns for the phrases competitors share',
  })
  async keywordIdeas(
    @Param('id') id: string,
    @Query() query: KeywordIdeasQueryDto,
  ): Promise<CompetitorKeywordIdeas> {
    await this.limiter.consume('suggestions');
    return this.keywordIdeasReads.ideas(id, query);
  }

  @Get('discovery')
  @ApiOperation({ summary: 'Untracked apps recurring in your keyword results' })
  discovery(
    @Param('id') id: string,
    @Query() query: DiscoveryQueryDto,
  ): Promise<CompetitorDiscovery> {
    return this.competitors.discovery(id, query);
  }

  @Post()
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
    return this.competitors.add(id, dto.url);
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
