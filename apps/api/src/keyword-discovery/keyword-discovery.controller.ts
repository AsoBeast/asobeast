import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  KeywordDiscoveryDismissResult,
  KeywordDiscoveryList,
  KeywordDiscoveryRefreshResult,
  KeywordDiscoverySettings,
  KeywordDiscoveryTrackResult,
} from '@asobeast/shared';
import { SpendsStoreCapacity } from '../auth/decorators/spends-store-capacity.decorator';
import { OnDemandLimiter } from '../auth/on-demand.limiter';
import { QueuesWork } from '../redis/queues-work.decorator';
import { KeywordDiscoveriesQueryDto } from './dto/keyword-discoveries-query.dto';
import { KeywordDiscoveryDismissDto } from './dto/keyword-discovery-dismiss.dto';
import { KeywordDiscoverySettingsDto } from './dto/keyword-discovery-settings.dto';
import { KeywordDiscoveryTrackDto } from './dto/keyword-discovery-track.dto';
import { KeywordDiscoveryActions } from './keyword-discovery-actions.service';
import { KeywordDiscoveryService } from './keyword-discovery.service';

@ApiTags('keywords')
@Controller('apps/:id')
export class KeywordDiscoveryController {
  constructor(
    private readonly discoveries: KeywordDiscoveryService,
    private readonly actions: KeywordDiscoveryActions,
    private readonly limiter: OnDemandLimiter,
  ) {}

  @Get('keyword-discoveries')
  @ApiOperation({
    summary:
      'List the keywords an app ranks for or could rank for that it does not track',
    description:
      'Reads stored rows only and reaches no store. A weekly job and a manual refresh build the list from the listing of each market, the home titles and subtitles of competitors, review phrases, Apple popularity weeks for the genre of the app and the phrases the workspace tracks for other apps, leaving out what the app tracks, active or paused, and what was dismissed. position is 1 based; null with a depth means checked and not found within that depth, and a null depth means never checked. depth 50 comes from another search of the phrase today or yesterday, 200 from the search of the app itself. state is ranked when the app has a position, opportunity when it has none, relevance is at least 60 and opportunity at least 35, and open otherwise. traffic and difficulty come from a score some tracker already produced, or, for an unscored App Store term, from the popularity Apple lists; a discovery is never scored, so opportunity is null until the keyword has a score. recommended marks the first 50 rows in list order and counts cover every open row of the requested market, whatever the state filter and the limit. unfit is the number of ranked rows that did not fit the plan while auto track is on. checks reports the weekly cap of searches, how many were queued this ISO week, how many are still waiting, the day of the newest check and the next run of the discovery schedule, whatever its cadence, null when the schedule is off.',
  })
  list(
    @Param('id') id: string,
    @Query() query: KeywordDiscoveriesQueryDto,
  ): Promise<KeywordDiscoveryList> {
    return this.discoveries.list(id, query);
  }

  @Post('keyword-discoveries/track')
  @QueuesWork()
  @HttpCode(200)
  @ApiOperation({
    summary: 'Track keyword discoveries',
    description:
      'Tracks the discoveries named by keywordIds, or every ranked discovery with allRanked true, optionally in one market; exactly one of the two is required. Ids that are not open discoveries of the app are ignored. Tracking spends the keyword room of the plan the way a manual add does: skipped counts the rows over that room, which stay discoveries. A known position from a check of today or yesterday becomes the first position of the keyword and every other row queues its first position check. Answers 403 and writes nothing when another request took the last keyword slots in the meantime.',
  })
  track(
    @Param('id') id: string,
    @Body() dto: KeywordDiscoveryTrackDto,
  ): Promise<KeywordDiscoveryTrackResult> {
    return this.actions.track(id, dto);
  }

  @Post('keyword-discoveries/dismiss')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Dismiss keyword discoveries',
    description:
      'Hides the named discoveries for good: a dismissed phrase is never proposed again for the app. dismissed counts the rows this request dismissed, so a second dismiss of the same ids answers 0.',
  })
  dismiss(
    @Param('id') id: string,
    @Body() dto: KeywordDiscoveryDismissDto,
  ): Promise<KeywordDiscoveryDismissResult> {
    return this.actions.dismiss(id, dto.keywordIds);
  }

  @Post('keyword-discoveries/refresh')
  @QueuesWork()
  @SpendsStoreCapacity()
  @HttpCode(202)
  @ApiOperation({
    summary: 'Refresh keyword discoveries',
    description:
      'Rebuilds the list from stored data, reads the positions other searches of the same phrases found today or yesterday for free, and queues at most the checks left of the weekly cap (40 per app on the App Store and 20 on Google Play, counted from Monday 00:00 UTC and shared with the weekly run). Spends one deep search allowance only when at least one check is queued; queued 0 costs nothing. Answers 202.',
  })
  refresh(@Param('id') id: string): Promise<KeywordDiscoveryRefreshResult> {
    return this.actions.refresh(id, () => this.limiter.consume('spider'));
  }

  @Patch('keyword-discoveries/settings')
  @QueuesWork()
  @ApiOperation({
    summary: 'Change the keyword discovery settings of an app',
    description:
      'Switching autoTrackRanked on tracks every ranked discovery that fits the keyword room of the plan at once, and every later check that finds the app tracks its phrase too; tracked and skipped report what this request tracked. Switching it off tracks nothing and leaves tracked keywords alone.',
  })
  updateSettings(
    @Param('id') id: string,
    @Body() dto: KeywordDiscoverySettingsDto,
  ): Promise<KeywordDiscoverySettings> {
    return this.actions.updateSettings(id, dto.autoTrackRanked);
  }
}
