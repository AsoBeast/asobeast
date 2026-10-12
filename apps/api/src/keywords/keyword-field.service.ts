import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, Store } from '@prisma/client';
import {
  keywordFieldChars,
  KeywordFieldResult,
  KEYWORD_FIELD_CHAR_LIMIT,
  parseKeywordField,
} from '@asobeast/shared';
import { QuotaService } from '../auth/quota.service';
import { PrismaService } from '../prisma/prisma.service';
import { inKeywordField } from './keyword-field-membership';
import { KeywordTracker } from './keyword-tracker';
import { serpVolatilities } from './keyword-volatility';
import { toTrackedKeywordItem } from './keywords.mapper';
import { listingFacts } from './listing-facts';
import {
  ensureApp,
  KeywordApp,
  normalizeKeyword,
  trackedArgs,
  trackedOrder,
} from './keywords.support';

const KEYWORD_FIELD_LOCK = 3_958_261;

@Injectable()
export class KeywordFieldService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tracker: KeywordTracker,
    private readonly quota: QuotaService,
  ) {}

  private ensureKeywordFieldStore(app: KeywordApp): void {
    if (app.store !== Store.APP_STORE) {
      throw new BadRequestException(
        'The keyword field is only available for App Store apps',
      );
    }
  }

  private serializeKeywordField(
    tx: Prisma.TransactionClient,
    appId: string,
  ): Promise<number> {
    return tx.$executeRaw`SELECT pg_advisory_xact_lock(${KEYWORD_FIELD_LOCK}, hashtext(${appId}))`;
  }

  private async keywordFieldResult(
    app: KeywordApp,
    duplicatesRemoved: number,
  ): Promise<KeywordFieldResult> {
    const rows = await this.prisma.trackedKeyword.findMany({
      where: {
        appId: app.id,
        ...inKeywordField,
        active: true,
        keyword: { is: { country: app.country } },
      },
      ...trackedArgs(app.id),
      orderBy: [{ fieldOrder: 'asc' }, ...trackedOrder()],
    });
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

    await this.quota.admitKeywordMarkets(async (tx) => {
      await this.serializeKeywordField(tx, appId);
      for (const [fieldOrder, keywordId] of keywordIds.entries()) {
        await this.tracker.track(
          tx,
          {
            appId,
            keywordId,
            source: 'KEYWORD_FIELD',
            active: true,
            fieldOrder,
          },
          { active: true, fieldOrder },
        );
      }
      const dropped = {
        appId,
        ...inKeywordField,
        keywordId: { notIn: keywordIds },
      };
      await tx.trackedKeyword.updateMany({
        where: { ...dropped, source: 'KEYWORD_FIELD' },
        data: { active: false, fieldOrder: null },
      });
      await tx.trackedKeyword.updateMany({
        where: dropped,
        data: { fieldOrder: null },
      });
    });

    for (const keywordId of keywordIds) {
      await this.tracker.enqueueFirstScore(keywordId, app);
    }

    return this.keywordFieldResult(app, duplicatesRemoved);
  }
}
