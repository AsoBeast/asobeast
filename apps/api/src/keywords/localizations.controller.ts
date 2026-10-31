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
  LocalizedKeywordFieldResult,
  MarketKeywordFields,
} from '@asobeast/shared';
import { RateLimitClass } from '../auth/rate-limit/rate-class';
import { ReadOnlyEndpoint } from '../auth/read-access';
import { AppLocalizationsService } from './app-localizations.service';
import { AddAppLocalizationDto } from './dto/app-localization.dto';
import {
  KeywordFieldPreviewDto,
  LocalizedKeywordFieldDto,
} from './dto/localized-keyword-field.dto';
import { MarketQueryDto } from './dto/market-query.dto';
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
  ) {}

  @Get('localizations')
  @ApiOperation({
    summary: 'List the App Store localizations an app ships',
    description:
      'Returns the default localization of the home storefront, every localization added by hand or detected, and every localization with a saved keyword field, the home localization first and the rest by display name. Each item carries its keyword field and the markets of the app that read it, with the role each market gives it, default or additional. markets lists the home market first and then every market in which the app tracks keywords. storeImport answers how the app follows App Store Connect: unavailable when the workspace has no active App Store Connect key, available when the owner may start importing, following while the fields import from App Store Connect, and paused when an import started but the connection needs attention. storeManaged is true only while following, and storeSync names the version of the last import, when it ran and the error that stopped it, if one did. Answers 400 for a Google Play or competitor app and 404 for a missing app.',
  })
  list(@Param('id') id: string): Promise<AppLocalizationsResult> {
    return this.localizations.list(id);
  }

  @Post('localizations')
  @ApiOperation({
    summary: 'Add an App Store localization to an app',
    description:
      'Marks one of the 50 App Store localizations as shipped by the app, with no keyword field yet, and answers 201 with the item. Answers 409 when the app already ships it, the default localization of the home storefront included, or while the app follows an active App Store Connect connection, and 400 for a tag outside the 50 or a Google Play or competitor app.',
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
      'Removes a shipped localization and its keyword field in one transaction. Each phrase of the field stops being tracked as a keyword field phrase in every market that reads the localization, unless another saved field there holds it. Keywords tracked from another source stay tracked. Answers 204, 409 for the default localization of the home storefront or while the app follows an active App Store Connect connection, 404 when the app does not ship the localization, and 400 for an unknown tag or a Google Play or competitor app.',
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
}
