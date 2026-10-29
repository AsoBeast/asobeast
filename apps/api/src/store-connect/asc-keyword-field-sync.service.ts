import { Injectable, Logger } from '@nestjs/common';
import { Store } from '@prisma/client';
import {
  isAppStoreLocalization,
  parseKeywordField,
  type AppStoreLocalization,
} from '@asobeast/shared';
import { ActionRunQueue } from '../actions/action-run.queue';
import { QuotaExceededError } from '../auth/quota.errors';
import { WorkspaceContext } from '../common/tenancy/workspace-context';
import { PrismaService } from '../prisma/prisma.service';
import { loadAppMarkets } from '../keywords/app-markets';
import { storedKeywordFields } from '../keywords/keyword-field-index';
import { checkKeywordText, KeywordApp } from '../keywords/keywords.support';
import { homeLocalization, readersOf } from '../keywords/localization-markets';
import { KeywordFieldWriter } from '../keywords/keyword-field-writer';
import { AscError, AscRateLimitedError } from './asc-errors';
import { localizationOfAscLocale } from './asc-locales';
import type {
  AscAppVersionLocalization,
  AscListingApi,
  AscLiveVersion,
} from './asc-listing-api';
import { StoreConnectionService } from './store-connection.service';

const STORE = Store.APP_STORE;

export const FIELD_SYNC_QUOTA_STOPPED = (localization: string): string =>
  `The workspace keyword limit stopped this import at ${localization}. Free keyword markets or upgrade, and the next sync completes it.`;

export interface KeywordFieldSyncSummary {
  fields: number;
  changed: number;
}

interface FieldImport {
  localization: AppStoreLocalization;
  phrases: string[];
}

const untouchedOutcome = { fields: 0, changed: 0, quotaStopped: false };

const samePhrases = (before: readonly string[], phrases: string[]): boolean =>
  before.length === phrases.length &&
  before.every((phrase, index) => phrase === phrases[index]);

const fieldPhrases = (text: string): string[] =>
  parseKeywordField(text).phrases.flatMap((phrase) => {
    const check = checkKeywordText(phrase);
    return check.ok ? [check.text] : [];
  });

const knownLocalizations = (
  served: AscAppVersionLocalization[],
  home: string,
): FieldImport[] => {
  const rank = (localization: AppStoreLocalization) =>
    Number(localization !== home);
  const known = new Map<AppStoreLocalization, string[]>();
  for (const { locale, keywords } of served) {
    const localization = localizationOfAscLocale(locale);
    if (localization !== null) known.set(localization, fieldPhrases(keywords));
  }
  return [...known]
    .map(([localization, phrases]) => ({ localization, phrases }))
    .sort(
      (left, right) =>
        rank(left.localization) - rank(right.localization) ||
        left.localization.localeCompare(right.localization),
    );
};

@Injectable()
export class AscKeywordFieldSync {
  private readonly logger = new Logger(AscKeywordFieldSync.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly connections: StoreConnectionService,
    private readonly writer: KeywordFieldWriter,
    private readonly actions: ActionRunQueue,
    private readonly workspace: WorkspaceContext,
  ) {}

  async run(): Promise<KeywordFieldSyncSummary> {
    const connection = await this.connections.openAppStoreListing();
    if (!connection || connection.status === 'rejected') {
      return { fields: 0, changed: 0 };
    }
    const following = await this.prisma.keywordFieldSync.findMany({
      select: { appId: true },
      orderBy: { syncedAt: 'asc' },
    });
    let fields = 0;
    let changed = 0;
    for (const { appId } of following) {
      const app = await this.prisma.app.findUnique({
        where: { id: appId },
        select: {
          id: true,
          workspaceId: true,
          store: true,
          country: true,
          storeAppId: true,
          isCompetitor: true,
        },
      });
      if (!app || app.store !== STORE || app.isCompetitor) continue;
      const outcome = await this.syncApp(connection.api, app);
      fields += outcome.fields;
      changed += outcome.changed;
      if (outcome.quotaStopped) break;
    }
    if (changed > 0) {
      await this.actions.request({
        workspaceId: this.workspace.require('a keyword field import'),
      });
    }
    return { fields, changed };
  }

  private async syncApp(
    api: AscListingApi,
    app: KeywordApp,
  ): Promise<{ fields: number; changed: number; quotaStopped: boolean }> {
    const live = await this.liveVersion(api, app);
    if (!live) return untouchedOutcome;
    const served = await this.versionLocalizations(api, app, live.id);
    if (served === null) return untouchedOutcome;

    const stored = new Map<AppStoreLocalization, string[]>(
      (await storedKeywordFields(this.prisma, app.id)).flatMap((field) =>
        isAppStoreLocalization(field.localization)
          ? [[field.localization, [...field.phrases]] as const]
          : [],
      ),
    );
    const markets = await loadAppMarkets(this.prisma, app);
    const home = homeLocalization(app.country);
    const imports = knownLocalizations(served, home);
    const servedTags = new Set(imports.map(({ localization }) => localization));

    let fields = 0;
    let changed = 0;
    let stoppedAt: AppStoreLocalization | null = null;
    for (const entry of imports) {
      const before = stored.get(entry.localization) ?? [];
      if (samePhrases(before, entry.phrases)) {
        fields += 1;
        continue;
      }
      try {
        await this.writer.save({
          app,
          localization: entry.localization,
          phrases: entry.phrases,
          markets: readersOf(entry.localization, markets, home)
            .filter(({ role }) => role === 'default')
            .map(({ country }) => country),
        });
      } catch (error) {
        if (!(error instanceof QuotaExceededError)) throw error;
        stoppedAt = entry.localization;
        break;
      }
      fields += 1;
      changed += 1;
    }
    for (const localization of stored.keys()) {
      if (servedTags.has(localization) || localization === home) continue;
      await this.writer.remove(app, localization);
      changed += 1;
    }
    await this.recordSync(app, live.version, stoppedAt);
    return { fields, changed, quotaStopped: stoppedAt !== null };
  }

  private async liveVersion(
    api: AscListingApi,
    app: KeywordApp,
  ): Promise<AscLiveVersion | null> {
    try {
      return await api.liveVersion(app.storeAppId);
    } catch (error) {
      this.skipped(error, app.id);
      return null;
    }
  }

  private async versionLocalizations(
    api: AscListingApi,
    app: KeywordApp,
    versionId: string,
  ): Promise<AscAppVersionLocalization[] | null> {
    try {
      return await api.versionLocalizations(versionId);
    } catch (error) {
      this.skipped(error, app.id);
      return null;
    }
  }

  private skipped(error: unknown, appId: string): void {
    if (error instanceof AscRateLimitedError) throw error;
    if (error instanceof AscError) {
      this.logger.warn(
        `App Store Connect answered ${error.message} for the keyword fields of app ${appId}; they wait for the next sync`,
      );
      return;
    }
    throw error;
  }

  private recordSync(
    app: KeywordApp,
    version: string | null,
    stoppedAt: AppStoreLocalization | null,
  ): Promise<unknown> {
    const data = {
      version,
      syncedAt: new Date(),
      lastError:
        stoppedAt === null ? null : FIELD_SYNC_QUOTA_STOPPED(stoppedAt),
    };
    return this.prisma.keywordFieldSync.upsert({
      where: {
        appId_workspaceId: { appId: app.id, workspaceId: app.workspaceId },
      },
      create: {
        appId: app.id,
        workspaceId: app.workspaceId,
        ...data,
      },
      update: data,
    });
  }
}
