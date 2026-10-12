import { Injectable } from '@nestjs/common';
import { Store } from '@prisma/client';
import { assertStorefront, MarketKeywordFields } from '@asobeast/shared';
import { AppLocalizationsService } from './app-localizations.service';
import { marketReads } from './market-keyword-fields';

@Injectable()
export class MarketKeywordFieldsService {
  constructor(private readonly localizations: AppLocalizationsService) {}

  async read(appId: string, country?: string): Promise<MarketKeywordFields> {
    const { home, localizations } = await this.localizations.list(appId);
    const market = country ?? home;
    if (market !== home) {
      assertStorefront(Store.APP_STORE, market);
    }
    return {
      country: market,
      home: market === home,
      localizations: marketReads({
        country: market,
        home,
        shipped: new Map(
          localizations.map(({ localization, origin }) => [
            localization,
            origin,
          ]),
        ),
        fields: new Map(
          localizations.map(({ localization, phrases }) => [
            localization,
            phrases,
          ]),
        ),
      }),
    };
  }
}
