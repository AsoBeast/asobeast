import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { WorkspaceChecklist } from '@asobeast/shared';
import { ChecklistService } from './checklist.service';

@ApiTags('auth')
@Controller('workspace/checklist')
export class ChecklistController {
  constructor(private readonly checklist: ChecklistService) {}

  @Get()
  @ApiOperation({
    summary: 'Read the setup checklist of this workspace',
    description:
      'The goal the workspace chose, whether the checklist was hidden and up to eight items, ordered for the goal and each derived on read from rows the workspace already holds: an imported app, an app that tracks keywords in two markets, a competitor, a connected store console, a personal API token that has been used, a confirmed email alert or an active webhook, a reply the owner marked, a saved keyword field. An item that cannot be done is left out: the keyword field when the workspace has apps and none is on the App Store, the console when the instance has no store connection key, the reply until a review is stored. appId is the app a link should open (the oldest one that does not satisfy the item) and null for workspace wide items. done and total count the items listed.',
  })
  read(): Promise<WorkspaceChecklist> {
    return this.checklist.read();
  }
}
