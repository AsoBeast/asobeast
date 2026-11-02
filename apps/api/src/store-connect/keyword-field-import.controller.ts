import {
  Controller,
  Delete,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AppLocalizationsResult } from '@asobeast/shared';
import { SessionOnly } from '../auth/decorators/session-only.decorator';
import { OwnerGuard } from '../auth/guards/owner.guard';
import { QueuesWork } from '../redis/queues-work.decorator';
import { KeywordFieldImportService } from './keyword-field-import.service';

@ApiTags('store-connect')
@Controller('apps/:id')
export class KeywordFieldImportController {
  constructor(private readonly imports: KeywordFieldImportService) {}

  @Post('keyword-fields/import')
  @HttpCode(200)
  @SessionOnly()
  @UseGuards(OwnerGuard)
  @QueuesWork()
  @ApiOperation({
    summary: 'Follow App Store Connect for the keyword fields of an app',
    description:
      'Marks the app as following App Store Connect, queues a store sync that imports the keyword field of every localization the live version serves, and answers 200 with the localizations of the app, storeImport following. The import replaces any field typed here, deletes the field and the localization of every localization the live version does not serve, and tracks its phrases in every market whose storefront reads the localization as its default localization. Deleted fields and localizations do not come back when the import stops. The fields stay imported while the App Store connection is active; stop importing hands them back editable, exactly as they were. Owner only, through a signed in session. Answers 409 when the app already follows App Store Connect or no active App Store Connect connection exists, and 400 for a Google Play or competitor app.',
  })
  start(@Param('id') id: string): Promise<AppLocalizationsResult> {
    return this.imports.start(id);
  }

  @Delete('keyword-fields/import')
  @HttpCode(204)
  @SessionOnly()
  @UseGuards(OwnerGuard)
  @ApiOperation({
    summary: 'Stop following App Store Connect for the keyword fields',
    description:
      'Removes the follow mark of the app. The stored keyword fields stay exactly as the last import left them and become editable again. Owner only, through a signed in session. Answers 204, 404 when the app does not follow App Store Connect, and 400 for a Google Play or competitor app.',
  })
  stop(@Param('id') id: string): Promise<void> {
    return this.imports.stop(id);
  }
}
