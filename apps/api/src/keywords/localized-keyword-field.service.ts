import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  APP_STORE_LOCALIZATIONS,
  type AppLocalizationItem,
  type AppStoreLocalization,
  LocalizedKeywordFieldRequest,
  LocalizedKeywordFieldResult,
} from '@asobeast/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AppLocalizationsService } from './app-localizations.service';
import { loadAppMarkets } from './app-markets';
import { parseFieldText } from './keyword-field-text';
import { KeywordFieldWriter } from './keyword-field-writer';
import { ensureKeywordFieldApp } from './keywords.support';
import { trackInError } from './localization-markets';

@Injectable()
export class LocalizedKeywordFieldService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly writer: KeywordFieldWriter,
    private readonly localizations: AppLocalizationsService,
  ) {}

  async save(
    appId: string,
    localization: AppStoreLocalization,
    request: LocalizedKeywordFieldRequest,
  ): Promise<LocalizedKeywordFieldResult> {
    const app = await ensureKeywordFieldApp(this.prisma, appId);
    const { phrases, duplicatesRemoved } = parseFieldText(request.text);
    const refusal = trackInError(
      localization,
      request.trackIn,
      await loadAppMarkets(this.prisma, app),
    );
    if (refusal !== null) {
      throw new BadRequestException(refusal);
    }
    const { trackedIn } = await this.writer.save({
      app,
      localization,
      phrases,
      markets: request.trackIn,
    });
    return {
      localization: await this.itemOf(appId, localization),
      duplicatesRemoved,
      trackedIn,
    };
  }

  private async itemOf(
    appId: string,
    localization: AppStoreLocalization,
  ): Promise<AppLocalizationItem> {
    const { localizations } = await this.localizations.list(appId);
    const item = localizations.find(
      (entry) => entry.localization === localization,
    );
    if (!item) {
      throw new NotFoundException(
        `${APP_STORE_LOCALIZATIONS[localization]} is not one of this app's localizations`,
      );
    }
    return item;
  }
}
