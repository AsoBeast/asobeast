import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import {
  ActionActivity,
  ActionAiStatus,
  ActionDetail,
  ActionExplanation,
  ActionItem,
  ActionListResult,
  ActionRunResult,
  ActionSummary,
  STORES,
} from '@asobeast/shared';
import type { User } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { WorkspaceContext } from '../common/tenancy/workspace-context';
import { ActionActivityService } from './action-activity.service';
import { ActionDetailService } from './action-detail.service';
import { ActionRunQueue } from './action-run.queue';
import { parseSummaryScope } from './action-summary-scope';
import { ActionsAiService } from './actions-ai.service';
import { ActionsService } from './actions.service';
import { ActionActivityQueryDto } from './dto/action-activity-query.dto';
import { ListActionsQueryDto } from './dto/list-actions-query.dto';
import { UpdateActionDto } from './dto/update-action.dto';

@ApiTags('actions')
@Controller('actions')
export class ActionsController {
  constructor(
    private readonly actions: ActionsService,
    private readonly details: ActionDetailService,
    private readonly activityReader: ActionActivityService,
    private readonly ai: ActionsAiService,
    private readonly actionRuns: ActionRunQueue,
    private readonly workspace: WorkspaceContext,
  ) {}

  @Get()
  @ApiOkResponse({ description: 'The prioritized action queue' })
  @ApiOperation({ summary: 'List actions across every tracked app' })
  list(@Query() query: ListActionsQueryDto): Promise<ActionListResult> {
    return this.actions.list(query);
  }

  @Get('summary')
  @ApiOkResponse({ description: 'Open and snoozed action counts' })
  @ApiOperation({ summary: 'Summarize the action queue' })
  @ApiQuery({ name: 'appId', required: false, type: String })
  @ApiQuery({ name: 'store', required: false, enum: STORES })
  @ApiQuery({ name: 'country', required: false, type: String, example: 'us' })
  summary(@Query() query: Record<string, unknown>): Promise<ActionSummary> {
    return this.actions.summary(parseSummaryScope(query));
  }

  @Get('ai-status')
  @ApiOkResponse({ description: 'Whether the optional AI seam is configured' })
  @ApiOperation({ summary: 'Report AI explanation availability' })
  aiStatus(): ActionAiStatus {
    return this.ai.status();
  }

  @Get('activity')
  @ApiOkResponse({ description: 'Actions opened and closed per UTC day' })
  @ApiOperation({ summary: 'Report daily action activity' })
  activity(@Query() query: ActionActivityQueryDto): Promise<ActionActivity> {
    return this.activityReader.read(query);
  }

  @Get(':id')
  @ApiOkResponse({
    description: 'One action with its history, trend and measured outcome',
  })
  @ApiNotFoundResponse({ description: 'No such action in this workspace' })
  @ApiOperation({ summary: 'Read one action' })
  detail(@Param('id') id: string): Promise<ActionDetail> {
    return this.details.get(id);
  }

  @Patch(':id')
  @ApiOkResponse({ description: 'The updated action' })
  @ApiOperation({ summary: 'Change the state of one action' })
  update(
    @Param('id') id: string,
    @Body() body: UpdateActionDto,
    @CurrentUser() user: User,
  ): Promise<ActionItem> {
    return this.actions.update(id, body, user.id);
  }

  @Post(':id/explain')
  @HttpCode(200)
  @ApiOkResponse({ description: 'A plain-language summary of the evidence' })
  @ApiOperation({
    summary: 'Summarize one action with the optional AI seam',
  })
  explain(@Param('id') id: string): Promise<ActionExplanation> {
    return this.ai.explain(id);
  }

  @Post('run')
  @HttpCode(202)
  @ApiAcceptedResponse({ description: 'Generation was queued' })
  @ApiOperation({ summary: 'Queue an action generation run' })
  run(): Promise<ActionRunResult> {
    return this.actionRuns.request(this.workspace.scopeFor('an action run'));
  }
}

@ApiTags('actions')
@Controller('apps/:id/actions')
export class AppActionsController {
  constructor(private readonly actions: ActionsService) {}

  @Get()
  @ApiOkResponse({ description: 'The action queue for one app' })
  @ApiNotFoundResponse({ description: 'No such app in this workspace' })
  @ApiOperation({ summary: 'List actions for one tracked app' })
  list(
    @Param('id') id: string,
    @Query() query: ListActionsQueryDto,
  ): Promise<ActionListResult> {
    return this.actions.list(query, id);
  }
}
