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
      'Answers up to 50 entries of the day asked for, or of the newest captured day. Each entry carries its iconUrl, titleMatch and titleSegments, and previous, delta and movement against comparedTo, the newest captured day before date. An entry may also carry subtitle, from the newest listing the workspace captured for that app in the keyword market by the end of the shown day (only for its own apps and competitors on the App Store), with subtitleSegments, and placement (title, subtitle, both, split or none), which is absent when the subtitle is unknown and the title does not hold the keyword. On Google Play an entry instead carries shortDescription, the short description the store search showed for that app on that day, with shortDescriptionSegments, for every app the search showed one for, and placement judges the title and the short description: subtitle means the short description holds the keyword, and both and split name the title and the short description. Days captured before AsoBeast kept short descriptions, and results whose search showed none, carry no shortDescription, and their placement is never none. Movement is none when there is no earlier capture or the earlier capture did not reach that position. exits lists the apps of that earlier capture no longer listed, and dates lists up to 365 captured days, newest first.',
  })
  serp(
    @Param('keywordId') keywordId: string,
    @Query() query: SerpQueryDto,
  ): Promise<SerpSnapshot> {
    return this.serpReads.serp(keywordId, query);
  }
}
