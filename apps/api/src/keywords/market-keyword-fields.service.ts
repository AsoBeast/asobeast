import { Injectable } from '@nestjs/common';
import { Store } from '@prisma/client';
import {
  assertStorefront,
  keywordFieldLocalizations,
  MarketKeywordFields,
  SplitPhrase,
} from '@asobeast/shared';
import {
  latestListingTexts,
  latestLocalizedTexts,
} from '../apps/listing-texts';
import { FieldPhrases, judgingSurfaces } from '../metadata/listing-surfaces';
import { PrismaService } from '../prisma/prisma.service';
import { AppLocalizationsService } from './app-localizations.service';
import { marketReads } from './market-keyword-fields';
import { localizationGroups, splitPhrases, wastedWords } from './wasted-words';

@Injectable()
export class MarketKeywordFieldsService {
  constructor(
    private readonly localizations: AppLocalizationsService,
    private readonly prisma: PrismaService,
  ) {}

  async read(appId: string, country?: string): Promise<MarketKeywordFields> {
    const { home, localizations } = await this.localizations.list(appId);
    const market = country ?? home;
    if (market !== home) {
      assertStorefront(Store.APP_STORE, market);
    }
    const fields: FieldPhrases = new Map(
      localizations.map(({ localization, phrases }) => [localization, phrases]),
    );
    const reads = marketReads({
      country: market,
      home,
      shipped: new Map(
        localizations.map(({ localization, origin }) => [localization, origin]),
      ),
      fields,
    });
    return {
      country: market,
      home: market === home,
      localizations: reads,
      wastedWords: wastedWords(reads),
      splitPhrases: await this.splitPhrasesOf(appId, home, market, fields),
    };
  }

  private async splitPhrasesOf(
    appId: string,
    home: string,
    market: string,
    fields: FieldPhrases,
  ): Promise<SplitPhrase[]> {
    const [listings, localized, tracked] = await Promise.all([
      latestListingTexts(this.prisma, appId, home, [market]),
      latestLocalizedTexts(this.prisma, appId, home, [market]),
      this.prisma.trackedKeyword.findMany({
        where: { appId, active: true, keyword: { is: { country: market } } },
        select: { keywordId: true, keyword: { select: { text: true } } },
      }),
    ]);
    const saved: FieldPhrases = new Map(
      [...fields].filter(([, phrases]) => phrases.length > 0),
    );
    const groups = localizationGroups(
      keywordFieldLocalizations(market),
      judgingSurfaces(
        {
          store: Store.APP_STORE,
          country: market,
          home: market === home,
          listing: listings.get(market),
          captured: localized.get(market) ?? [],
        },
        saved,
      ),
    );
    return splitPhrases({
      phrases: tracked.map(({ keywordId, keyword }) => ({
        keywordId,
        text: keyword.text,
      })),
      groups,
    });
  }
}
