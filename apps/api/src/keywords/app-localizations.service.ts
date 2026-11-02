import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  APP_STORE_LOCALIZATIONS,
  type AppLocalizationItem,
  type AppLocalizationsResult,
  type AppStoreLocalization,
} from '@asobeast/shared';
import { type SecretBox } from '../common/crypto/secret-box';
import { WorkspaceContext } from '../common/tenancy/workspace-context';
import { PrismaService } from '../prisma/prisma.service';
import { recordAppLocalizations } from './app-localization-records';
import { toAppLocalizationItems } from './app-localizations';
import { loadAppMarkets } from './app-markets';
import {
  fieldSyncOf,
  importStateOf,
  refuseManagedField,
  STORE_IMPORT_FOLLOWING,
  STORE_IMPORT_NEEDED,
} from './keyword-field-managed';
import { SECRET_BOX } from '../store-connect/secret-box.provider';
import {
  KeywordFieldWriter,
  serializeKeywordField,
} from './keyword-field-writer';
import { ensureLocalizedFieldApp, KeywordApp } from './keywords.support';
import { homeLocalization } from './localization-markets';

const itemOf = (
  result: AppLocalizationsResult,
  localization: AppStoreLocalization,
): AppLocalizationItem | undefined =>
  result.localizations.find((item) => item.localization === localization);

const alreadyShipped = (localization: AppStoreLocalization) =>
  new ConflictException(
    `${APP_STORE_LOCALIZATIONS[localization]} is already one of this app's localizations`,
  );

const notShipped = (localization: AppStoreLocalization) =>
  new NotFoundException(
    `${APP_STORE_LOCALIZATIONS[localization]} is not one of this app's localizations`,
  );

const notRemovable = (app: KeywordApp, localization: AppStoreLocalization) =>
  new ConflictException(
    `${APP_STORE_LOCALIZATIONS[localization]} is the default localization of the ${app.country.toUpperCase()} storefront and cannot be removed`,
  );

@Injectable()
export class AppLocalizationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly writer: KeywordFieldWriter,
    private readonly workspace: WorkspaceContext,
    @Inject(SECRET_BOX) private readonly box: SecretBox | null,
  ) {}

  async list(appId: string): Promise<AppLocalizationsResult> {
    return this.resultOf(await ensureLocalizedFieldApp(this.prisma, appId));
  }

  async startImport(appId: string): Promise<AppLocalizationsResult> {
    const app = await ensureLocalizedFieldApp(this.prisma, appId);
    const state = await importStateOf(this.prisma, this.box, app.id);
    if (state === 'following') {
      throw new ConflictException(STORE_IMPORT_FOLLOWING);
    }
    if (state !== 'available') {
      throw new ConflictException(STORE_IMPORT_NEEDED);
    }
    await this.prisma.keywordFieldSync.upsert({
      where: {
        appId_workspaceId: {
          appId: app.id,
          workspaceId: this.workspace.require('a keyword field import'),
        },
      },
      create: {
        appId: app.id,
        workspaceId: this.workspace.require('a keyword field import'),
      },
      update: {},
    });
    return this.resultOf(app);
  }

  async stopImport(appId: string): Promise<void> {
    const app = await ensureLocalizedFieldApp(this.prisma, appId);
    const removed = await this.prisma.withTransaction(async (tx) => {
      await serializeKeywordField(tx, app.id);
      return tx.keywordFieldSync.deleteMany({ where: { appId: app.id } });
    });
    if (removed.count === 0) {
      throw new NotFoundException('This app does not follow App Store Connect');
    }
  }

  async add(
    appId: string,
    localization: AppStoreLocalization,
  ): Promise<AppLocalizationItem> {
    const app = await ensureLocalizedFieldApp(this.prisma, appId);
    await refuseManagedField(this.prisma, this.box, app.id);
    if (itemOf(await this.resultOf(app), localization)) {
      throw alreadyShipped(localization);
    }
    const inserted = await recordAppLocalizations(this.prisma, [
      {
        appId,
        workspaceId: this.workspace.require('an app localization'),
        localization,
        origin: 'manual',
      },
    ]);
    if (inserted === 0) throw alreadyShipped(localization);
    const added = itemOf(await this.resultOf(app), localization);
    if (!added) throw notShipped(localization);
    return added;
  }

  async remove(
    appId: string,
    localization: AppStoreLocalization,
  ): Promise<void> {
    const app = await ensureLocalizedFieldApp(this.prisma, appId);
    await refuseManagedField(this.prisma, this.box, app.id);
    if (localization === homeLocalization(app.country)) {
      throw notRemovable(app, localization);
    }
    if (!itemOf(await this.resultOf(app), localization)) {
      throw notShipped(localization);
    }
    await this.writer.remove(app, localization);
  }

  private async resultOf(app: KeywordApp): Promise<AppLocalizationsResult> {
    const [stored, fields, markets, sync, storeImport] = await Promise.all([
      this.prisma.appLocalization.findMany({
        where: { appId: app.id },
        select: { localization: true, origin: true },
      }),
      this.prisma.keywordField.findMany({
        where: { appId: app.id },
        select: { localization: true, phrases: true, updatedAt: true },
      }),
      loadAppMarkets(this.prisma, app),
      fieldSyncOf(this.prisma, app.id),
      importStateOf(this.prisma, this.box, app.id),
    ]);
    return {
      home: app.country,
      markets,
      localizations: toAppLocalizationItems({
        home: app.country,
        markets,
        stored,
        fields,
      }),
      storeManaged: storeImport === 'following',
      storeSync:
        sync === null
          ? null
          : {
              at: sync.syncedAt?.toISOString() ?? null,
              version: sync.version,
              error: sync.lastError,
            },
      storeImport,
    };
  }
}
