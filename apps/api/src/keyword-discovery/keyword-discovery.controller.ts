import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { KeywordDiscoveryList } from '@asobeast/shared';
import { KeywordDiscoveriesQueryDto } from './dto/keyword-discoveries-query.dto';
import { KeywordDiscoveryService } from './keyword-discovery.service';

@ApiTags('keywords')
@Controller('apps/:id')
export class KeywordDiscoveryController {
  constructor(private readonly discoveries: KeywordDiscoveryService) {}

  @Get('keyword-discoveries')
  @ApiOperation({
    summary:
      'List the keywords an app ranks for or could rank for that it does not track',
    description:
      'Reads stored rows only and reaches no store. A weekly job and a manual refresh build the list from the listing of each market, the home titles and subtitles of competitors, review phrases, Apple popularity weeks for the genre of the app and the phrases the workspace tracks for other apps, leaving out what the app tracks, active or paused, and what was dismissed. position is 1 based; null with a depth means checked and not found within that depth, and a null depth means never checked. depth 50 comes from another search of the phrase today or yesterday, 200 from the search of the app itself. state is ranked when the app has a position, opportunity when it has none, relevance is at least 60 and opportunity at least 35, and open otherwise. traffic and difficulty come from a score some tracker already produced, or, for an unscored App Store term, from the popularity Apple lists; a discovery is never scored, so opportunity is null until the keyword has a score. recommended marks the first 50 rows in list order and counts cover every open row of the requested market, whatever the state filter and the limit. unfit is the number of ranked rows that did not fit the plan while auto track is on. checks reports the weekly cap of searches, how many were queued this ISO week, how many are still waiting, the day of the newest check and the next weekly run, null when the schedule is off.',
  })
  list(
    @Param('id') id: string,
    @Query() query: KeywordDiscoveriesQueryDto,
  ): Promise<KeywordDiscoveryList> {
    return this.discoveries.list(id, query);
  }
}
