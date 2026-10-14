import { Injectable } from '@nestjs/common';
import {
  type AppStoreLocalization,
  isAppStoreLocalization,
  keywordFieldChars,
  KeywordFieldQuery,
  KeywordFieldResult,
  KeywordFieldSummary,
  KEYWORD_FIELD_CHAR_LIMIT,
} from '@asobeast/shared';
import { PrismaService } from '../prisma/prisma.service';
import { loadAppMarkets } from './app-markets';
import { storedPhrases } from './keyword-field-index';
import { parseFieldText } from './keyword-field-text';
import { KeywordFieldTarget, keywordFieldTarget } from './keyword-field-target';
import { KeywordFieldWriter } from './keyword-field-writer';
import { serpVolatilities } from './keyword-volatility';
import { toTrackedKeywordItem } from './keywords.mapper';
import {
  ensureKeywordFieldApp,
  KeywordApp,
  trackedArgs,
} from './keywords.support';
import { listingFacts } from './listing-facts';
import { homeLocalization, readsKeywordField } from './localization-markets';

export type StoredKeywordFieldResult = KeywordFieldResult &
  Required<Pick<KeywordFieldResult, 'country' | 'localization' | 'phrases'>>;

@Injectable()
export class KeywordFieldService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly writer: KeywordFieldWriter,
  ) {}

  private async keywordFieldResult(
    app: KeywordApp,
    target: KeywordFieldTarget,
    duplicatesRemoved: number,
  ): Promise<StoredKeywordFieldResult> {
    const phrases = await storedPhrases(
      this.prisma,
      app.id,
      target.localization,
    );
    const rows = await this.prisma.trackedKeyword.findMany({
      where: {
        appId: app.id,
        active: true,
        keyword: { is: { country: target.country, text: { in: phrases } } },
      },
      ...trackedArgs(app.id),
    });
    const order = new Map(phrases.map((phrase, index) => [phrase, index]));
    rows.sort(
      (left, right) =>
        (order.get(left.keyword.text) ?? 0) -
        (order.get(right.keyword.text) ?? 0),
    );
    const [facts, volatility] = await Promise.all([
      listingFacts(this.prisma, app, [target.country]),
      serpVolatilities(
        this.prisma,
        rows.map((row) => row.keywordId),
      ),
    ]);
    const tracked = rows.map((row) =>
      toTrackedKeywordItem(row, facts, volatility.get(row.keywordId) ?? null),
    );

    return {
      tracked,
      charactersUsed: keywordFieldChars(phrases),
      charactersLimit: KEYWORD_FIELD_CHAR_LIMIT,
      duplicatesRemoved,
      country: target.country,
      localization: target.localization,
      phrases,
    };
  }

  async getKeywordField(
    appId: string,
    query: KeywordFieldQuery = {},
  ): Promise<StoredKeywordFieldResult> {
    const app = await ensureKeywordFieldApp(this.prisma, appId);
    return this.keywordFieldResult(app, keywordFieldTarget(app, query), 0);
  }

  async list(appId: string): Promise<KeywordFieldSummary[]> {
    const app = await ensureKeywordFieldApp(this.prisma, appId);
    const [fields, markets] = await Promise.all([
      this.prisma.keywordField.findMany({ where: { appId } }),
      loadAppMarkets(this.prisma, app),
    ]);
    const home = homeLocalization(app.country);
    const homeFirst = (localization: AppStoreLocalization) =>
      Number(localization !== home);
    return fields
      .flatMap(({ localization, ...field }) =>
        isAppStoreLocalization(localization)
          ? [{ ...field, localization }]
          : [],
      )
      .sort(
        (left, right) =>
          homeFirst(left.localization) - homeFirst(right.localization) ||
          left.localization.localeCompare(right.localization),
      )
      .map((field) => ({
        localization: field.localization,
        phrases: field.phrases,
        charactersUsed: keywordFieldChars(field.phrases),
        charactersLimit: KEYWORD_FIELD_CHAR_LIMIT,
        markets: markets.filter((market) =>
          readsKeywordField(market, field.localization),
        ),
        updatedAt: field.updatedAt.toISOString(),
      }));
  }

  async setKeywordField(
    appId: string,
    text: string,
    query: KeywordFieldQuery = {},
  ): Promise<StoredKeywordFieldResult> {
    const app = await ensureKeywordFieldApp(this.prisma, appId);
    const target = keywordFieldTarget(app, query);

    const { phrases, duplicatesRemoved } = parseFieldText(text);

    await this.writer.save({
      app,
      localization: target.localization,
      phrases,
      markets: [target.country],
    });
    return this.keywordFieldResult(app, target, duplicatesRemoved);
  }
}
