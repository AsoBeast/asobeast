import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SerpSnapshot } from '@asobeast/shared';
import { SerpQueryDto } from './dto/serp-query.dto';
import { SerpService } from './serp.service';

@ApiTags('rankings')
@Controller('keywords')
export class SerpController {
  constructor(private readonly serpReads: SerpService) {}

  @Get(':keywordId/serp')
  @ApiOperation({ summary: 'Top search results captured for a keyword' })
  serp(
    @Param('keywordId') keywordId: string,
    @Query() query: SerpQueryDto,
  ): Promise<SerpSnapshot> {
    return this.serpReads.serp(keywordId, query);
  }
}
