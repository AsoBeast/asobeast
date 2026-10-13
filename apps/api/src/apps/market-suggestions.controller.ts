import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { MarketSuggestionsResult } from '@asobeast/shared';
import { MarketSuggestionsService } from './market-suggestions.service';

@ApiTags('apps')
@Controller('apps/:id')
export class MarketSuggestionsController {
  constructor(private readonly suggestions: MarketSuggestionsService) {}

  @Get('market-suggestions')
  @ApiOperation({
    summary: 'Suggest storefronts from the languages the home listing declares',
    description:
      'Reads the languages the newest home listing declares and answers every App Store storefront that reads a localization in one of them, the home storefront left out, with the localization, its role in that storefront (default or additional), whether the app already tracks keywords there and the daily store requests the market costs: the listing reads of the app and its competitors, native localizations included, and the requests one tracked keyword adds. English is never suggested because every storefront reads it. A Google Play app answers an empty list. Answers 404 for an unknown app.',
  })
  suggest(@Param('id') id: string): Promise<MarketSuggestionsResult> {
    return this.suggestions.suggest(id);
  }
}
