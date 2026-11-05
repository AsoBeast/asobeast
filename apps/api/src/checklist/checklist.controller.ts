import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { WorkspaceChecklist } from '@asobeast/shared';
import { ChecklistService } from './checklist.service';
import { UpdateWorkspaceChecklistDto } from './dto/update-workspace-checklist.dto';

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

  @Patch()
  @ApiOperation({
    summary: 'Choose the goal of this workspace or hide the setup checklist',
    description:
      'Changes the fields given and keeps the rest; an empty body changes nothing. goal is improve_rankings, research_idea, use_with_ai or null to clear it, and it orders the checklist. dismissed true hides the checklist for every member and keeps the time of the first dismissal when sent again; false shows it again. Answers the whole checklist. Answers 400 for an unknown goal or a body that is not these two fields, 402 when no plan is in force and 403 to a read scoped token.',
  })
  update(
    @Body() dto: UpdateWorkspaceChecklistDto,
  ): Promise<WorkspaceChecklist> {
    return this.checklist.update(dto);
  }
}
