import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type {
  AppLocalizationItem,
  AppLocalizationsResult,
  AppStoreLocalization,
} from '@asobeast/shared';
import { AppLocalizationsService } from './app-localizations.service';
import { AddAppLocalizationDto } from './dto/app-localization.dto';
import { LocalizationPipe } from './localization.pipe';

@ApiTags('keywords')
@Controller('apps/:id')
export class LocalizationsController {
  constructor(private readonly localizations: AppLocalizationsService) {}

  @Get('localizations')
  @ApiOperation({
    summary: 'List the App Store localizations an app ships',
    description:
      'Returns the default localization of the home storefront, every localization added by hand or detected, and every localization with a saved keyword field, the home localization first and the rest by display name. Each item carries its keyword field and the markets of the app that read it, with the role each market gives it, default or additional. markets lists the home market first and then every market in which the app tracks keywords. Answers 400 for a Google Play app and 404 for a missing app.',
  })
  list(@Param('id') id: string): Promise<AppLocalizationsResult> {
    return this.localizations.list(id);
  }

  @Post('localizations')
  @ApiOperation({
    summary: 'Add an App Store localization to an app',
    description:
      'Marks one of the 50 App Store localizations as shipped by the app, with no keyword field yet, and answers 201 with the item. Answers 409 when the app already ships it, the default localization of the home storefront included, and 400 for a tag outside the 50 or a Google Play app.',
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
      'Removes a shipped localization and its keyword field in one transaction. Each phrase of the field stops being tracked as a keyword field phrase in every market that reads the localization, unless another saved field there holds it. Keywords tracked from another source stay tracked. Answers 204, 409 for the default localization of the home storefront, 404 when the app does not ship the localization, and 400 for an unknown tag or a Google Play app.',
  })
  remove(
    @Param('id') id: string,
    @Param('localization', LocalizationPipe) localization: AppStoreLocalization,
  ): Promise<void> {
    return this.localizations.remove(id, localization);
  }
}
