import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  APP_STORE_LOCALIZATIONS,
  type AppLocalizationItem,
  type AppLocalizationsResult,
  type AppStoreLocalization,
} from '@asobeast/shared';
import { WorkspaceContext } from '../common/tenancy/workspace-context';
import { PrismaService } from '../prisma/prisma.service';
import { recordAppLocalizations } from './app-localization-records';
import { toAppLocalizationItems } from './app-localizations';
import { loadAppMarkets } from './app-markets';
import { KeywordFieldWriter } from './keyword-field-writer';
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
  ) {}

  async list(appId: string): Promise<AppLocalizationsResult> {
    return this.resultOf(await ensureLocalizedFieldApp(this.prisma, appId));
  }

  async add(
    appId: string,
    localization: AppStoreLocalization,
  ): Promise<AppLocalizationItem> {
    const app = await ensureLocalizedFieldApp(this.prisma, appId);
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
    if (localization === homeLocalization(app.country)) {
      throw notRemovable(app, localization);
    }
    if (!itemOf(await this.resultOf(app), localization)) {
      throw notShipped(localization);
    }
    await this.writer.remove(app, localization);
  }

  private async resultOf(app: KeywordApp): Promise<AppLocalizationsResult> {
    const [stored, fields, markets] = await Promise.all([
      this.prisma.appLocalization.findMany({
        where: { appId: app.id },
        select: { localization: true, origin: true },
      }),
      this.prisma.keywordField.findMany({
        where: { appId: app.id },
        select: { localization: true, phrases: true, updatedAt: true },
      }),
      loadAppMarkets(this.prisma, app),
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
    };
  }
}
