import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AppStoreLocalization } from '@asobeast/shared';
import { QuotaService } from '../auth/quota.service';
import { WorkspaceContext } from '../common/tenancy/workspace-context';
import { recordAppLocalizations } from './app-localization-records';
import { indexKeywordFields, storedPhrases } from './keyword-field-index';
import { KeywordTracker } from './keyword-tracker';
import { KeywordApp } from './keywords.support';
import { homeLocalization, readsKeywordField } from './localization-markets';
import { MarketListingRequests } from './market-listing.requests';

const KEYWORD_FIELD_LOCK = 3_958_261;

export interface KeywordFieldSave {
  app: KeywordApp;
  localization: AppStoreLocalization;
  phrases: string[];
  markets: readonly string[];
}

export interface KeywordFieldWrite {
  keywordIds: string[];
  trackedIn: string[];
}

interface MarketKeywords {
  market: string;
  keywordIds: string[];
}

@Injectable()
export class KeywordFieldWriter {
  constructor(
    private readonly tracker: KeywordTracker,
    private readonly quota: QuotaService,
    private readonly workspace: WorkspaceContext,
    private readonly listings: MarketListingRequests,
  ) {}

  async save({
    app,
    localization,
    phrases,
    markets,
  }: KeywordFieldSave): Promise<KeywordFieldWrite> {
    const resolved = await this.resolveKeywords(app, phrases, markets);
    await this.quota.admitKeywordMarkets(async (tx) => {
      await this.serialize(tx, app.id);
      const before = await storedPhrases(tx, app.id, localization);
      await this.storePhrases(tx, app.id, localization, phrases);
      await this.recordShipped(tx, app, localization, phrases);
      for (const { keywordIds } of resolved) {
        for (const keywordId of keywordIds) {
          await this.tracker.track(
            tx,
            { appId: app.id, keywordId, source: 'KEYWORD_FIELD', active: true },
            { active: true },
          );
        }
      }
      await this.untrackDropped(
        tx,
        app.id,
        localization,
        before.filter((phrase) => !phrases.includes(phrase)),
      );
    });
    return this.announce(app, resolved);
  }

  private async resolveKeywords(
    app: KeywordApp,
    phrases: string[],
    markets: readonly string[],
  ): Promise<MarketKeywords[]> {
    const resolved: MarketKeywords[] = [];
    for (const market of new Set(markets)) {
      resolved.push({
        market,
        keywordIds: await this.tracker.keywordIdsFor(
          phrases,
          app.store,
          market,
        ),
      });
    }
    return resolved;
  }

  private async announce(
    app: KeywordApp,
    resolved: MarketKeywords[],
  ): Promise<KeywordFieldWrite> {
    const keywordIds = resolved.flatMap((entry) => entry.keywordIds);
    for (const keywordId of keywordIds) {
      await this.tracker.enqueueFirstScore(keywordId, app);
    }
    const trackedIn = resolved
      .filter((entry) => entry.keywordIds.length > 0)
      .map((entry) => entry.market);
    for (const market of trackedIn) {
      await this.listings.request(app, market);
    }
    return { keywordIds, trackedIn };
  }

  private serialize(
    tx: Prisma.TransactionClient,
    appId: string,
  ): Promise<number> {
    return tx.$executeRaw`SELECT pg_advisory_xact_lock(${KEYWORD_FIELD_LOCK}, hashtext(${appId}))`;
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

  private async recordShipped(
    tx: Prisma.TransactionClient,
    app: KeywordApp,
    localization: AppStoreLocalization,
    phrases: string[],
  ): Promise<void> {
    if (
      phrases.length === 0 ||
      localization === homeLocalization(app.country)
    ) {
      return;
    }
    await recordAppLocalizations(tx, [
      {
        appId: app.id,
        workspaceId: this.workspace.require('an app localization'),
        localization,
        origin: 'manual',
      },
    ]);
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
        readsKeywordField(keyword.country, localization) &&
        !held(keyword.country, keyword.text),
    );
    if (untracked.length === 0) return;
    await tx.trackedKeyword.updateMany({
      where: {
        appId,
        active: true,
        source: 'KEYWORD_FIELD',
        keywordId: { in: untracked.map((row) => row.keywordId) },
      },
      data: { active: false },
    });
  }
}
