import { Injectable } from '@nestjs/common';
import type { AppLocalizationsResult } from '@asobeast/shared';
import { WorkspaceContext } from '../common/tenancy/workspace-context';
import { AppLocalizationsService } from '../keywords/app-localizations.service';
import { StoreReportQueue } from './store-report-queue';

@Injectable()
export class KeywordFieldImportService {
  constructor(
    private readonly localizations: AppLocalizationsService,
    private readonly reports: StoreReportQueue,
    private readonly workspace: WorkspaceContext,
  ) {}

  async start(appId: string): Promise<AppLocalizationsResult> {
    const result = await this.localizations.startImport(appId);
    try {
      await this.reports.enqueue(
        this.workspace.require('a keyword field import'),
        'APP_STORE',
      );
    } catch (error) {
      await this.localizations.stopImport(appId).catch(() => undefined);
      throw error;
    }
    return result;
  }

  stop(appId: string): Promise<void> {
    return this.localizations.stopImport(appId);
  }
}
