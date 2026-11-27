import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type {
  AppLocalizationItem,
  AppLocalizationsResult,
  AppStoreLocalization,
  KeywordFieldSavePreview,
  ListingTargetsResult,
  ListingTargetsSaveResult,
  LocalizedKeywordFieldResult,
  MarketKeywordFields,
} from '@asobeast/shared';
import { RateLimitClass } from '../auth/rate-limit/rate-class';
import { ReadOnlyEndpoint } from '../auth/read-access';
import { AppLocalizationsService } from './app-localizations.service';
import { AddAppLocalizationDto } from './dto/app-localization.dto';
import { ListingTargetsDto } from './dto/listing-targets.dto';
import {
  KeywordFieldPreviewDto,
  LocalizedKeywordFieldDto,
} from './dto/localized-keyword-field.dto';
import { MarketQueryDto } from './dto/market-query.dto';
import { ListingTargetsService } from './listing-targets/listing-targets.service';
import { LocalizationPipe } from './localization.pipe';
import { LocalizedKeywordFieldService } from './localized-keyword-field.service';
import { MarketKeywordFieldsService } from './market-keyword-fields.service';
import { QueuesWork } from '../redis/queues-work.decorator';

@ApiTags('keywords')
@Controller('apps/:id')
export class LocalizationsController {
  constructor(
    private readonly localizations: AppLocalizationsService,
    private readonly fieldSaves: LocalizedKeywordFieldService,
    private readonly marketFields: MarketKeywordFieldsService,
    private readonly targets: ListingTargetsService,
  ) {}

  @Get('localizations')
  @ApiOperation({
    summary: 'List the App Store localizations an app ships',
    description:
      "Returns the home localization, the one the home listing is written in (the home storefront's default unless the listing is proven to be in one of the storefront's other languages), every localization added by hand or detected, and every localization with a saved keyword field, the home localization first and the rest by display name. Each item carries its keyword field and the markets of the app that read it, with the role each market gives it, default or additional. markets lists the home market first and then every market in which the app tracks keywords. storeImport answers how the app follows App Store Connect: unavailable when the workspace has no active App Store Connect key, available when the owner may start importing, following while the fields import from App Store Connect, and paused when an import started but the connection needs attention. storeManaged is true only while following, and storeSync names the version of the last import, when it ran and the error that stopped it, if one did. Answers 400 for a Google Play or competitor app and 404 for a missing app.",
  })
  list(@Param('id') id: string): Promise<AppLocalizationsResult> {
    return this.localizations.list(id);
  }

  @Post('localizations')
  @ApiOperation({
    summary: 'Add an App Store localization to an app',
    description:
      'Marks one of the 50 App Store localizations as shipped by the app, with no keyword field yet, and answers 201 with the item. Answers 409 when the app already ships it, the home localization included, or while the app follows an active App Store Connect connection, and 400 for a tag outside the 50 or a Google Play or competitor app.',
  })
  add(
    @Param('id') id: string,
    @Body() dto: AddAppLocalizationDto,
  ): Promise<AppLocalizationItem> {
    return this.localizations.add(id, dto.localization);
  }

  @Delete('localizations/:localization')
  @HttpCode(204)
  @ApiOperation({
    summary: 'Remove an App Store localization from an app',
    description:
      'Removes a shipped localization and its keyword field in one transaction. Each phrase of the field stops being tracked as a keyword field phrase in every market that reads the localization, unless another saved field there holds it. Keywords tracked from another source stay tracked. Answers 204, 409 for the home localization or while the app follows an active App Store Connect connection, 404 when the app does not ship the localization, and 400 for an unknown tag or a Google Play or competitor app.',
  })
  remove(
    @Param('id') id: string,
    @Param('localization', LocalizationPipe) localization: AppStoreLocalization,
  ): Promise<void> {
    return this.localizations.remove(id, localization);
  }

  @Get('keyword-fields/market')
  @ApiOperation({
    summary: 'Read what one market search reads',
    description:
      'Answers every localization the storefront of the market reads, in read order, with its role (default or additional), whether the app ships it, its origin (home, manual or detected, null when it is not shipped), its saved phrases and the characters they use. Without a query it describes the home storefront of the app. Any App Store storefront may be asked for, whether or not the app tracks keywords there. Answers 400 when country is neither the home storefront nor an App Store storefront and for a Google Play or competitor app, and 404 for a missing app.',
  })
  marketKeywordFields(
    @Param('id') id: string,
    @Query() query: MarketQueryDto,
  ): Promise<MarketKeywordFields> {
    return this.marketFields.read(id, query.country);
  }

  @Put('keyword-fields/:localization')
  @QueuesWork()
  @ApiOperation({
    summary: 'Save the keyword field of one localization',
    description:
      'Replaces the keyword field of one App Store localization with the normalized, deduplicated phrases of text, ships the localization when it is not shipped yet, and tracks every phrase in each market of trackIn. trackIn may be empty and must name only markets of the app whose storefront reads the localization. A phrase removed from the field stops being tracked as a keyword field phrase in every market that reads the localization, unless another saved field read there holds it. Answers 400 when the text runs past 100 characters, when trackIn names a country that is not a market of the app or a storefront that does not read the localization, and for a Google Play or competitor app. Answers 403 with quota and writes nothing when the keyword markets would pass the plan limit. Answers 404 for a missing app, and for an empty save of a localization the app does not ship. Answers 409 while the app follows an active App Store Connect connection. Saves to one app are written one at a time, so the last save wins.',
  })
  saveKeywordField(
    @Param('id') id: string,
    @Param('localization', LocalizationPipe) localization: AppStoreLocalization,
    @Body() dto: LocalizedKeywordFieldDto,
  ): Promise<LocalizedKeywordFieldResult> {
    return this.fieldSaves.save(id, localization, dto);
  }

  @Post('keyword-fields/:localization/preview')
  @HttpCode(200)
  @ReadOnlyEndpoint()
  @RateLimitClass('read')
  @ApiOperation({
    summary: 'Preview saving the keyword field of one localization',
    description:
      'Answers, for every market of the app whose storefront reads the localization, the phrases the field would add to the tracked keywords, how many of them would open a new keyword market and the daily store requests that costs, plus the phrases the save would add to and drop from the stored field and the keyword limit of the plan. Writes nothing and queues nothing. Answers 400 for text over 100 characters and for a Google Play or competitor app, and 404 for a missing app.',
  })
  previewKeywordField(
    @Param('id') id: string,
    @Param('localization', LocalizationPipe) localization: AppStoreLocalization,
    @Body() dto: KeywordFieldPreviewDto,
  ): Promise<KeywordFieldSavePreview> {
    return this.fieldSaves.preview(id, localization, dto);
  }

  @Get('localizations/:localization/targets')
  @ApiOperation({
    summary: 'Read the target keywords of one localization',
    description:
      'Answers the ten target slots of one App Store localization in order, null for an empty slot. Slot 1 is meant for the title, slots 2 and 3 for the subtitle and slots 4 to 10 are extra, as role says. Each filled slot carries its phrase, the reader markets that track it (with their keyword id and whether it is paused), the reader markets that do not, and the scores of its lead market, the first reader that tracks it. readers lists the markets of the app whose storefront reads the localization, home first, and is empty for a localization no market reads yet. candidates lists up to 50 active tracked keywords of the reader markets, one per phrase, never a competitor brand and never a phrase already in a slot, by opportunity. Each slot and candidate may carry placement, a suggestion derived from stored scores: field names where the phrase belongs (title, subtitle or keywordField) or skip, reason says why, and popularity, difficulty and position (null unless checked within a day) are the figures judged. Room is shared among the targets, and each candidate is judged as if it were added to them. placement is absent when the phrase is unscored, its score is outdated or no reader market tracks it. Answers 400 for an unknown tag and for a Google Play or competitor app, and 404 for a missing app.',
  })
  readTargets(
    @Param('id') id: string,
    @Param('localization', LocalizationPipe) localization: AppStoreLocalization,
  ): Promise<ListingTargetsResult> {
    return this.targets.read(id, localization);
  }

  @Put('localizations/:localization/targets')
  @QueuesWork()
  @ApiOperation({
    summary: 'Save the target keywords of one localization',
    description:
      'Stores up to ten target keywords of one App Store localization in slot order, null for an empty slot, each normalized like a tracked keyword. Empty slots in the middle keep their place and every slot null removes the targets. Every phrase new to the stored list, or every slot with trackMissing, that a market of the app reading the localization does not track yet is tracked there as a manual keyword, a paused one resumed, within the keyword limit of the plan, with its first position check and score queued. A reorder or a removal tracks nothing. A phrase that did not fit is answered in notTracked with its market and keywordLimit, and its slot is stored anyway. A localization no market reads stores its targets and tracks nothing. Answers the targets as the read does, plus tracked, notTracked and quota. Answers 400 for more than ten slots, a duplicate or an invalid phrase (naming its position), an unknown tag and a Google Play or competitor app, 403 with quota and writes nothing when the keyword markets would pass the plan limit meanwhile, and 404 for a missing app.',
  })
  saveTargets(
    @Param('id') id: string,
    @Param('localization', LocalizationPipe) localization: AppStoreLocalization,
    @Body() dto: ListingTargetsDto,
  ): Promise<ListingTargetsSaveResult> {
    return this.targets.save(id, localization, dto);
  }
}
