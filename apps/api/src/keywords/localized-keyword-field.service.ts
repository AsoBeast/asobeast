import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  APP_STORE_LOCALIZATIONS,
  type AppLocalizationItem,
  type AppStoreLocalization,
  KEYWORD_FIELD_CHAR_LIMIT,
  keywordFieldChars,
  KeywordFieldPreviewRequest,
  KeywordFieldSavePreview,
  LocalizedKeywordFieldRequest,
  LocalizedKeywordFieldResult,
} from '@asobeast/shared';
import { QuotaService } from '../auth/quota.service';
import { requestsPerJob } from '../jobs/request-weights';
import { type SecretBox } from '../common/crypto/secret-box';
import { PrismaService } from '../prisma/prisma.service';
import { SECRET_BOX } from '../store-connect/secret-box.provider';
import { AppLocalizationsService } from './app-localizations.service';
import { loadAppMarkets } from './app-markets';
import { planFieldSave } from './keyword-field-save-plan';
import { refuseManagedField } from './keyword-field-managed';
import { parseFieldText } from './keyword-field-text';
import { KeywordFieldWriter } from './keyword-field-writer';
import { keywordQuotaOf } from './keyword-quota';
import { loadTrackingStates } from './keyword-tracking-state';
import { ensureLocalizedFieldApp } from './keywords.support';
import { readersOf, trackInError } from './localization-markets';

@Injectable()
export class LocalizedKeywordFieldService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly writer: KeywordFieldWriter,
    private readonly localizations: AppLocalizationsService,
    private readonly quota: QuotaService,
    @Inject(SECRET_BOX) private readonly box: SecretBox | null,
  ) {}

  async save(
    appId: string,
    localization: AppStoreLocalization,
    request: LocalizedKeywordFieldRequest,
  ): Promise<LocalizedKeywordFieldResult> {
    const app = await ensureLocalizedFieldApp(this.prisma, appId);
    await refuseManagedField(this.prisma, this.box, app.id);
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

  async preview(
    appId: string,
    localization: AppStoreLocalization,
    request: KeywordFieldPreviewRequest,
  ): Promise<KeywordFieldSavePreview> {
    const app = await ensureLocalizedFieldApp(this.prisma, appId);
    const { phrases, duplicatesRemoved } = parseFieldText(request.text);
    const [markets, stored, usage] = await Promise.all([
      loadAppMarkets(this.prisma, app),
      this.prisma.keywordField.findUnique({
        where: { appId_localization: { appId, localization } },
        select: { phrases: true },
      }),
      this.quota.usage(),
    ]);
    const readers = readersOf(localization, markets, app.country);
    const tracking = await loadTrackingStates(
      this.prisma,
      app,
      readers.flatMap(({ country }) =>
        phrases.map((text) => ({ text, country })),
      ),
    );
    return {
      localization,
      duplicatesRemoved,
      charactersUsed: keywordFieldChars(phrases),
      charactersLimit: KEYWORD_FIELD_CHAR_LIMIT,
      ...planFieldSave({
        stored: stored?.phrases ?? [],
        phrases,
        readers,
        tracking,
        requestsPerKeyword: requestsPerJob(app.store, 'keywords'),
      }),
      quota: keywordQuotaOf(usage, this.quota.upgradeFrom(usage.plan)),
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
