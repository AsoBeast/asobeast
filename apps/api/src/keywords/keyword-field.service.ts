import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, Store } from '@prisma/client';
import {
  type AppStoreLocalization,
  isAppStoreLocalization,
  keywordFieldChars,
  KeywordFieldQuery,
  KeywordFieldResult,
  KeywordFieldSummary,
  KEYWORD_FIELD_CHAR_LIMIT,
  parseKeywordField,
  readLocalizations,
  readsLocalization,
  storefrontsReading,
} from '@asobeast/shared';
import { QuotaService } from '../auth/quota.service';
import { WorkspaceContext } from '../common/tenancy/workspace-context';
import { PrismaService } from '../prisma/prisma.service';
import { indexKeywordFields } from './keyword-field-index';
import { KeywordFieldTarget, keywordFieldTarget } from './keyword-field-target';
import { KeywordTracker } from './keyword-tracker';
import { serpVolatilities } from './keyword-volatility';
import { toTrackedKeywordItem } from './keywords.mapper';
import { listingFacts } from './listing-facts';
import { MarketListingRequests } from './market-listing.requests';
import {
  ensureApp,
  KeywordApp,
  normalizeKeyword,
  trackedArgs,
} from './keywords.support';

const KEYWORD_FIELD_LOCK = 3_958_261;

@Injectable()
export class KeywordFieldService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tracker: KeywordTracker,
    private readonly quota: QuotaService,
    private readonly workspace: WorkspaceContext,
    private readonly listings: MarketListingRequests,
  ) {}

  private async keywordFieldApp(appId: string): Promise<KeywordApp> {
    const app = await ensureApp(this.prisma, appId);
    if (app.store !== Store.APP_STORE) {
      throw new BadRequestException(
        'The keyword field is only available for App Store apps',
      );
    }
    return app;
  }

  private serializeKeywordField(
    tx: Prisma.TransactionClient,
    appId: string,
  ): Promise<number> {
    return tx.$executeRaw`SELECT pg_advisory_xact_lock(${KEYWORD_FIELD_LOCK}, hashtext(${appId}))`;
  }

  private async phrasesOf(
    appId: string,
    localization: string,
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<string[]> {
    const field = await client.keywordField.findUnique({
      where: { appId_localization: { appId, localization } },
      select: { phrases: true },
    });
    return field?.phrases ?? [];
  }

  private async storePhrases(
    tx: Prisma.TransactionClient,
    appId: string,
    localization: string,
    phrases: string[],
  ): Promise<void> {
    if (phrases.length === 0) {
      await tx.keywordField.deleteMany({ where: { appId, localization } });
      return;
    }
    await tx.keywordField.upsert({
      where: { appId_localization: { appId, localization } },
      create: {
        appId,
        workspaceId: this.workspace.require('a keyword field save'),
        localization,
        phrases,
      },
      update: { phrases },
    });
  }

  private async untrackDropped(
    tx: Prisma.TransactionClient,
    appId: string,
    localization: string,
    dropped: string[],
  ): Promise<void> {
    if (dropped.length === 0) return;
    const [rows, fields] = await Promise.all([
      tx.trackedKeyword.findMany({
        where: {
          appId,
          active: true,
          source: 'KEYWORD_FIELD',
          keyword: { is: { text: { in: dropped } } },
        },
        select: {
          keywordId: true,
          keyword: { select: { text: true, country: true } },
        },
      }),
      tx.keywordField.findMany({
        where: { appId },
        select: { localization: true, phrases: true },
      }),
    ]);
    const held = indexKeywordFields(fields);
    const untracked = rows.filter(
      ({ keyword }) =>
        readsLocalization(keyword.country, localization) &&
        !held(keyword.country, keyword.text),
    );
    if (untracked.length === 0) return;
    await tx.trackedKeyword.updateMany({
      where: {
        appId,
        keywordId: { in: untracked.map((row) => row.keywordId) },
      },
      data: { active: false },
    });
  }

  private async keywordFieldResult(
    app: KeywordApp,
    target: KeywordFieldTarget,
    duplicatesRemoved: number,
  ): Promise<KeywordFieldResult> {
    const phrases = await this.phrasesOf(app.id, target.localization);
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
  ): Promise<KeywordFieldResult> {
    const app = await this.keywordFieldApp(appId);
    return this.keywordFieldResult(app, keywordFieldTarget(app, query), 0);
  }

  async list(appId: string): Promise<KeywordFieldSummary[]> {
    const app = await this.keywordFieldApp(appId);
    const [fields, tracked] = await Promise.all([
      this.prisma.keywordField.findMany({ where: { appId } }),
      this.prisma.keyword.findMany({
        where: { tracked: { some: { appId } } },
        distinct: ['country'],
        select: { country: true },
      }),
    ]);
    const markets = [
      ...new Set([app.country, ...tracked.map((row) => row.country)]),
    ];
    const home = readLocalizations(app.country)[0];
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
        markets: storefrontsReading(field.localization, markets),
        updatedAt: field.updatedAt.toISOString(),
      }));
  }

  async setKeywordField(
    appId: string,
    text: string,
    query: KeywordFieldQuery = {},
  ): Promise<KeywordFieldResult> {
    const app = await this.keywordFieldApp(appId);
    const target = keywordFieldTarget(app, query);

    const { phrases, duplicatesRemoved } = parseKeywordField(text);
    const unique = phrases.map(normalizeKeyword);
    if (keywordFieldChars(unique) > KEYWORD_FIELD_CHAR_LIMIT) {
      throw new BadRequestException(
        `Keyword field exceeds ${KEYWORD_FIELD_CHAR_LIMIT} characters`,
      );
    }

    const keywordIds = await this.tracker.keywordIdsFor(
      unique,
      app.store,
      target.country,
    );

    await this.quota.admitKeywordMarkets(async (tx) => {
      await this.serializeKeywordField(tx, appId);
      const before = await this.phrasesOf(appId, target.localization, tx);
      await this.storePhrases(tx, appId, target.localization, unique);
      for (const keywordId of keywordIds) {
        await this.tracker.track(
          tx,
          { appId, keywordId, source: 'KEYWORD_FIELD', active: true },
          { active: true },
        );
      }
      await this.untrackDropped(
        tx,
        appId,
        target.localization,
        before.filter((phrase) => !unique.includes(phrase)),
      );
    });

    for (const keywordId of keywordIds) {
      await this.tracker.enqueueFirstScore(keywordId, app);
    }
    await this.listings.request(app, target.country);

    return this.keywordFieldResult(app, target, duplicatesRemoved);
  }
}
