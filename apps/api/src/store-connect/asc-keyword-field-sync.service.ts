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
import { AscError, AscRateLimitedError, isNotFound } from './asc-errors';
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

export const FIELD_SYNC_UNSERVED_APP =
  'App Store Connect does not show this app to the connected key';

export const FIELD_SYNC_NO_LIVE_VERSION =
  'App Store Connect has no released iOS version for this app yet';

export interface KeywordFieldSyncSummary {
  fields: number;
  changed: number;
}

interface FieldImport {
  localization: AppStoreLocalization;
  phrases: string[];
}

interface FieldOutcome {
  fields: number;
  changed: number;
  stoppedAt: AppStoreLocalization | null;
  stopped: boolean;
}

const untouchedOutcome = { fields: 0, changed: 0, quotaStopped: false };

const partialOutcome = ({
  fields,
  changed,
}: FieldOutcome): {
  fields: number;
  changed: number;
  quotaStopped: boolean;
} => ({
  fields,
  changed,
  quotaStopped: false,
});

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
): { imports: FieldImport[]; unmapped: string[] } => {
  const rank = (localization: AppStoreLocalization) =>
    Number(localization !== home);
  const known = new Map<AppStoreLocalization, string[]>();
  const unmapped: string[] = [];
  for (const { locale, keywords } of served) {
    const localization = localizationOfAscLocale(locale);
    if (localization === null) {
      unmapped.push(locale);
      continue;
    }
    known.set(localization, fieldPhrases(keywords));
  }
  const imports = [...known]
    .map(([localization, phrases]) => ({ localization, phrases }))
    .sort(
      (left, right) =>
        rank(left.localization) - rank(right.localization) ||
        left.localization.localeCompare(right.localization),
    );
  return { imports, unmapped };
};

const defaultMarketsOf = (
  localization: AppStoreLocalization,
  markets: string[],
  home: string,
): string[] =>
  readersOf(localization, markets, home)
    .filter(({ role }) => role === 'default')
    .map(({ country }) => country);

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
      try {
        const outcome = await this.syncApp(connection.api, app);
        fields += outcome.fields;
        changed += outcome.changed;
        if (outcome.quotaStopped) break;
      } catch (error) {
        if (error instanceof AscRateLimitedError) throw error;
        this.logger.warn(
          `the keyword fields of app ${app.id} wait for the next sync: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
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
    const { imports, unmapped } = knownLocalizations(served, home);
    const servedTags = new Set(imports.map(({ localization }) => localization));

    const outcome = await this.importFields(app, imports, stored, markets);
    if (outcome.stopped) return partialOutcome(outcome);
    if (unmapped.length > 0) {
      this.logger.warn(
        `App Store Connect serves the locales ${unmapped.join(', ')} for app ${app.id}; AsoBeast maps none of them, so its stored fields wait untouched`,
      );
    } else {
      const removed = await this.removeUnserved(
        app,
        stored,
        servedTags,
        markets,
      );
      if (removed === null) return partialOutcome(outcome);
      outcome.changed += removed;
    }
    await this.recordSync(app, live.version, outcome.stoppedAt);
    return {
      fields: outcome.fields,
      changed: outcome.changed,
      quotaStopped: outcome.stoppedAt !== null,
    };
  }

  private async importFields(
    app: KeywordApp,
    imports: FieldImport[],
    stored: Map<AppStoreLocalization, string[]>,
    markets: string[],
  ): Promise<FieldOutcome> {
    const home = homeLocalization(app.country);
    let fields = 0;
    let changed = 0;
    let stoppedAt: AppStoreLocalization | null = null;
    for (const entry of imports) {
      if (!(await this.stillFollowing(app)))
        return { fields, changed, stoppedAt, stopped: true };
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
          markets: defaultMarketsOf(entry.localization, markets, home),
        });
      } catch (error) {
        if (!(error instanceof QuotaExceededError)) throw error;
        stoppedAt = entry.localization;
        break;
      }
      fields += 1;
      changed += 1;
    }
    return { fields, changed, stoppedAt, stopped: false };
  }

  private async removeUnserved(
    app: KeywordApp,
    stored: Map<AppStoreLocalization, string[]>,
    servedTags: Set<AppStoreLocalization>,
    markets: string[],
  ): Promise<number | null> {
    const home = homeLocalization(app.country);
    let removed = 0;
    for (const localization of stored.keys()) {
      if (servedTags.has(localization)) continue;
      if (!(await this.stillFollowing(app))) return null;
      const before = stored.get(localization) ?? [];
      if (localization === home) {
        if (before.length === 0) continue;
        await this.writer.save({
          app,
          localization,
          phrases: [],
          markets: defaultMarketsOf(localization, markets, home),
        });
      } else {
        await this.writer.remove(app, localization);
      }
      removed += 1;
    }
    return removed;
  }

  private async liveVersion(
    api: AscListingApi,
    app: KeywordApp,
  ): Promise<AscLiveVersion | null> {
    try {
      const live = await api.liveVersion(app.storeAppId);
      if (live === null)
        await this.recordSkipped(app, FIELD_SYNC_NO_LIVE_VERSION);
      return live;
    } catch (error) {
      await this.skipped(error, app);
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
      await this.skipped(error, app);
      return null;
    }
  }

  private async skipped(error: unknown, app: KeywordApp): Promise<void> {
    if (error instanceof AscRateLimitedError) throw error;
    if (!(error instanceof AscError)) throw error;
    const message = isNotFound(error) ? FIELD_SYNC_UNSERVED_APP : error.message;
    this.logger.warn(
      `the keyword fields of app ${app.id} wait for the next sync: ${message}`,
    );
    await this.recordSkipped(app, message);
  }

  private stillFollowing(app: KeywordApp): Promise<boolean> {
    return this.prisma.keywordFieldSync
      .findFirst({
        where: { appId: app.id },
        select: { appId: true },
      })
      .then((row) => row !== null);
  }

  private recordSkipped(app: KeywordApp, message: string): Promise<unknown> {
    return this.prisma.keywordFieldSync.updateMany({
      where: { appId: app.id },
      data: { lastError: message },
    });
  }

  private recordSync(
    app: KeywordApp,
    version: string | null,
    stoppedAt: AppStoreLocalization | null,
  ): Promise<unknown> {
    return this.prisma.keywordFieldSync.updateMany({
      where: { appId: app.id },
      data: {
        version,
        syncedAt: new Date(),
        lastError:
          stoppedAt === null ? null : FIELD_SYNC_QUOTA_STOPPED(stoppedAt),
      },
    });
  }
}
