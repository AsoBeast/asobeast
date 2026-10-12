import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, Store } from '@prisma/client';
import {
  keywordFieldChars,
  KeywordFieldResult,
  KEYWORD_FIELD_CHAR_LIMIT,
  parseKeywordField,
} from '@asobeast/shared';
import { QuotaService } from '../auth/quota.service';
import { WorkspaceContext } from '../common/tenancy/workspace-context';
import { PrismaService } from '../prisma/prisma.service';
import { defaultLocalizationOf } from './keyword-field-index';
import { KeywordTracker } from './keyword-tracker';
import { serpVolatilities } from './keyword-volatility';
import { toTrackedKeywordItem } from './keywords.mapper';
import { listingFacts } from './listing-facts';
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
  ) {}

  private ensureKeywordFieldStore(app: KeywordApp): void {
    if (app.store !== Store.APP_STORE) {
      throw new BadRequestException(
        'The keyword field is only available for App Store apps',
      );
    }
  }

  private homeLocalization(app: KeywordApp): string {
    const localization = defaultLocalizationOf(app.country);
    if (!localization) {
      throw new BadRequestException(
        `The ${app.country.toUpperCase()} storefront has no App Store localization`,
      );
    }
    return localization;
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

  private async keywordFieldResult(
    app: KeywordApp,
    duplicatesRemoved: number,
  ): Promise<KeywordFieldResult> {
    const phrases = await this.phrasesOf(app.id, this.homeLocalization(app));
    const rows = await this.prisma.trackedKeyword.findMany({
      where: {
        appId: app.id,
        active: true,
        keyword: { is: { country: app.country, text: { in: phrases } } },
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
      listingFacts(this.prisma, app),
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
      charactersUsed: keywordFieldChars(tracked.map((item) => item.text)),
      charactersLimit: KEYWORD_FIELD_CHAR_LIMIT,
      duplicatesRemoved,
    };
  }

  async getKeywordField(appId: string): Promise<KeywordFieldResult> {
    const app = await ensureApp(this.prisma, appId);
    this.ensureKeywordFieldStore(app);
    return this.keywordFieldResult(app, 0);
  }

  async setKeywordField(
    appId: string,
    text: string,
  ): Promise<KeywordFieldResult> {
    const app = await ensureApp(this.prisma, appId);
    this.ensureKeywordFieldStore(app);

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
      app.country,
    );

    const localization = this.homeLocalization(app);
    await this.quota.admitKeywordMarkets(async (tx) => {
      await this.serializeKeywordField(tx, appId);
      const before = await this.phrasesOf(appId, localization, tx);
      await this.storePhrases(tx, appId, localization, unique);
      for (const keywordId of keywordIds) {
        await this.tracker.track(
          tx,
          { appId, keywordId, source: 'KEYWORD_FIELD', active: true },
          { active: true },
        );
      }
      const dropped = before.filter((phrase) => !unique.includes(phrase));
      await tx.trackedKeyword.updateMany({
        where: {
          appId,
          source: 'KEYWORD_FIELD',
          keyword: { is: { country: app.country, text: { in: dropped } } },
        },
        data: { active: false },
      });
    });

    for (const keywordId of keywordIds) {
      await this.tracker.enqueueFirstScore(keywordId, app);
    }

    return this.keywordFieldResult(app, duplicatesRemoved);
  }

  async forget(
    app: KeywordApp,
    keyword: { country: string; text: string },
  ): Promise<void> {
    if (app.store !== Store.APP_STORE || keyword.country !== app.country) {
      return;
    }
    const localization = this.homeLocalization(app);
    await this.prisma.withTransaction(async (tx) => {
      await this.serializeKeywordField(tx, app.id);
      const phrases = await this.phrasesOf(app.id, localization, tx);
      if (phrases.includes(keyword.text)) {
        await this.storePhrases(
          tx,
          app.id,
          localization,
          phrases.filter((phrase) => phrase !== keyword.text),
        );
      }
    });
  }
}
