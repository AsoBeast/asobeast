import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  KeywordComparison,
  KeywordCountrySummary,
  KeywordFieldResult,
  KeywordSuggestion,
  SpiderEnqueueResult,
  SpiderStatus,
  TrackedKeywordItem,
} from '@asobeast/shared';
import { OnDemandLimiter } from '../auth/on-demand.limiter';
import { SpendsStoreCapacity } from '../auth/decorators/spends-store-capacity.decorator';
import { AddKeywordsDto } from './dto/add-keywords.dto';
import { CompareQueryDto } from './dto/compare-query.dto';
import { KeywordFieldDto } from './dto/keyword-field.dto';
import { ListKeywordsQueryDto } from './dto/list-keywords-query.dto';
import { SpiderQueryDto, SpiderStartDto } from './dto/spider.dto';
import { SuggestionsQueryDto } from './dto/suggestions-query.dto';
import { UpdateKeywordDto } from './dto/update-keyword.dto';
import { KeywordSuggestionService } from './keyword-suggestion.service';
import { KeywordsService } from './keywords.service';
import { SpiderService } from './spider.service';

@ApiTags('keywords')
@Controller('apps/:id')
export class KeywordsController {
  constructor(
    private readonly keywords: KeywordsService,
    private readonly keywordSuggestions: KeywordSuggestionService,
    private readonly spider: SpiderService,
    private readonly limiter: OnDemandLimiter,
  ) {}

  @Get('keywords')
  @ApiOperation({ summary: 'List tracked keywords for an app' })
  list(
    @Param('id') id: string,
    @Query() query: ListKeywordsQueryDto,
  ): Promise<TrackedKeywordItem[]> {
    return this.keywords.listTracked(id, query.sort, query.country);
  }

  @Get('keyword-countries')
  @ApiOperation({ summary: 'List the markets an app tracks keywords in' })
  countries(@Param('id') id: string): Promise<KeywordCountrySummary[]> {
    return this.keywords.keywordCountries(id);
  }

  @Get('keywords/compare')
  @ApiOperation({ summary: 'Compare keyword positions against competitors' })
  compare(
    @Param('id') id: string,
    @Query() query: CompareQueryDto,
  ): Promise<KeywordComparison> {
    return this.keywords.compare(id, query.onlyGaps);
  }

  @Get('keywords/suggestions')
  @SpendsStoreCapacity()
  @ApiOperation({ summary: 'Suggest keywords via metadata, search or similar' })
  async suggestions(
    @Param('id') id: string,
    @Query() query: SuggestionsQueryDto,
  ): Promise<KeywordSuggestion[]> {
    await this.limiter.consume('suggestions');
    return this.keywordSuggestions.suggest(
      id,
      query.strategy,
      query.limit,
      query.country,
    );
  }

  @Get('keywords/spider')
  @ApiOperation({ summary: 'Aggregate suggest spider probes for a term' })
  spiderStatus(
    @Param('id') id: string,
    @Query() query: SpiderQueryDto,
  ): Promise<SpiderStatus> {
    return this.spider.spiderStatus(id, query.term, query.country);
  }

  @Post('keywords/spider')
  @HttpCode(202)
  @ApiOperation({ summary: 'Enqueue suggest spider probes for a term' })
  startSpider(
    @Param('id') id: string,
    @Body() dto: SpiderStartDto,
  ): Promise<SpiderEnqueueResult> {
    return this.spider.startSpider(id, dto.term, dto.country);
  }

  @Post('keywords')
  @ApiOperation({ summary: 'Add manual keywords' })
  add(
    @Param('id') id: string,
    @Body() dto: AddKeywordsDto,
  ): Promise<TrackedKeywordItem[]> {
    return this.keywords.addManual(id, dto.keywords, dto.country);
  }

  @Patch('keywords/:keywordId')
  @ApiOperation({
    summary: 'Update a tracked keyword active flag or relevance',
  })
  update(
    @Param('id') id: string,
    @Param('keywordId') keywordId: string,
    @Body() dto: UpdateKeywordDto,
  ): Promise<TrackedKeywordItem> {
    return this.keywords.updateKeyword(id, keywordId, dto);
  }

  @Delete('keywords/:keywordId')
  @HttpCode(204)
  @ApiOperation({ summary: 'Stop tracking a keyword' })
  remove(
    @Param('id') id: string,
    @Param('keywordId') keywordId: string,
  ): Promise<void> {
    return this.keywords.remove(id, keywordId);
  }

  @Get('keyword-field')
  @ApiOperation({
    summary: 'Read the stored iOS keyword field',
    description:
      'Returns the normalized phrases tracked from the last submission in the home market, not the string that was submitted, so spacing, casing and order may differ. duplicatesRemoved is always 0 because a read discards nothing.',
  })
  keywordField(@Param('id') id: string): Promise<KeywordFieldResult> {
    return this.keywords.getKeywordField(id);
  }

  @Put('keyword-field')
  @ApiOperation({ summary: 'Set the manual iOS keyword field' })
  setKeywordField(
    @Param('id') id: string,
    @Body() dto: KeywordFieldDto,
  ): Promise<KeywordFieldResult> {
    return this.keywords.setKeywordField(id, dto.text);
  }
}
