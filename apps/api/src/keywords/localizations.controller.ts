import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AppLocalizationsResult } from '@asobeast/shared';
import { AppLocalizationsService } from './app-localizations.service';

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
}
