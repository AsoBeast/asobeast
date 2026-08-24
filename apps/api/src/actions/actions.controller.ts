import { InjectQueue } from '@nestjs/bullmq';
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
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Queue } from 'bullmq';
import {
  ActionAiStatus,
  ActionExplanation,
  ActionItem,
  ActionListResult,
  ActionRunResult,
  ActionSummary,
} from '@asobeast/shared';
import { WorkspaceContext } from '../common/tenancy/workspace-context';
import { actionsJobId, JOBS, QUEUES, utcDateKey } from '../jobs/jobs.types';
import { ActionsAiService } from './actions-ai.service';
import { ActionsService } from './actions.service';
import { ListActionsQueryDto } from './dto/list-actions-query.dto';
import { UpdateActionDto } from './dto/update-action.dto';

@ApiTags('actions')
@Controller('actions')
export class ActionsController {
  constructor(
    private readonly actions: ActionsService,
    private readonly ai: ActionsAiService,
    @InjectQueue(QUEUES.PIPELINE) private readonly pipeline: Queue,
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
  summary(): Promise<ActionSummary> {
    return this.actions.summary();
  }

  @Get('ai-status')
  @ApiOkResponse({ description: 'Whether the optional AI seam is configured' })
  @ApiOperation({ summary: 'Report AI explanation availability' })
  aiStatus(): ActionAiStatus {
    return this.ai.status();
  }

  @Patch(':id')
  @ApiOkResponse({ description: 'The updated action' })
  @ApiOperation({ summary: 'Change the state of one action' })
  update(
    @Param('id') id: string,
    @Body() body: UpdateActionDto,
  ): Promise<ActionItem> {
    return this.actions.update(id, body);
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
  async run(): Promise<ActionRunResult> {
    const scope = this.workspace.scopeFor('an action run');
    const jobId = actionsJobId(scope.workspaceId, utcDateKey());
    await this.pipeline.add(JOBS.ACTIONS, scope, { jobId });
    return { queued: true, jobId };
  }
}

@ApiTags('actions')
@Controller('apps/:id/actions')
export class AppActionsController {
  constructor(private readonly actions: ActionsService) {}

  @Get()
  @ApiOkResponse({ description: 'The action queue for one app' })
  @ApiOperation({ summary: 'List actions for one tracked app' })
  list(
    @Param('id') id: string,
    @Query() query: ListActionsQueryDto,
  ): Promise<ActionListResult> {
    return this.actions.list(query, id);
  }
}
