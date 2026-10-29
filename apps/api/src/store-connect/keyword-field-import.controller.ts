import { Controller, Delete, HttpCode, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AppLocalizationsResult } from '@asobeast/shared';
import { QueuesWork } from '../redis/queues-work.decorator';
import { AppLocalizationsService } from '../keywords/app-localizations.service';
import { WorkspaceContext } from '../common/tenancy/workspace-context';
import { StoreReportQueue } from './store-report-queue';

@ApiTags('store-connect')
@Controller('apps/:id')
export class KeywordFieldImportController {
  constructor(
    private readonly localizations: AppLocalizationsService,
    private readonly reports: StoreReportQueue,
    private readonly workspace: WorkspaceContext,
  ) {}

  @Post('keyword-fields/import')
  @HttpCode(200)
  @QueuesWork()
  @ApiOperation({
    summary: 'Follow App Store Connect for the keyword fields of an app',
    description:
      'Marks the app as following App Store Connect, queues a store sync that imports the keyword field of every localization the live version serves, and answers 200 with the localizations of the app, storeImport following. The import replaces any field typed here and tracks its phrases in every market whose storefront reads the localization as its default localization. The fields stay imported while the App Store connection is active; stop importing hands them back editable, exactly as they were. Answers 409 when the app already follows App Store Connect or no active App Store Connect connection exists, and 400 for a Google Play or competitor app.',
  })
  start(@Param('id') id: string): Promise<AppLocalizationsResult> {
    return this.localizations.startImport(id).then(async (result) => {
      await this.reports.enqueue(
        this.workspace.require('a keyword field import'),
        'APP_STORE',
      );
      return result;
    });
  }

  @Delete('keyword-fields/import')
  @HttpCode(204)
  @ApiOperation({
    summary: 'Stop following App Store Connect for the keyword fields',
    description:
      'Removes the follow mark of the app. The stored keyword fields stay exactly as the last import left them and become editable again. Answers 204, 404 when the app does not follow App Store Connect, and 400 for a Google Play or competitor app.',
  })
  stop(@Param('id') id: string): Promise<void> {
    return this.localizations.stopImport(id);
  }
}
