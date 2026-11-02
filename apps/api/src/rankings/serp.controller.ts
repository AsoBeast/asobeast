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
  @ApiOperation({
    summary: 'Top search results captured for a keyword',
    description:
      'Answers up to 50 entries of the day asked for, or of the newest captured day. Each entry carries its iconUrl, titleMatch and titleSegments, and previous, delta and movement against comparedTo, the newest captured day before date. Movement is none when there is no earlier capture or the earlier capture did not reach that position. exits lists the apps of that earlier capture no longer listed, and dates lists up to 365 captured days, newest first.',
  })
  serp(
    @Param('keywordId') keywordId: string,
    @Query() query: SerpQueryDto,
  ): Promise<SerpSnapshot> {
    return this.serpReads.serp(keywordId, query);
  }
}
