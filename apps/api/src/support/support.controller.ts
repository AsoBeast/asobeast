import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { User } from '@prisma/client';
import {
  ALL_WORKSPACES,
  type SupportAction,
  type SupportActionResult,
  type SupportWorkspaceDetail,
  type SupportWorkspaceSummary,
} from '@asobeast/shared';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { WorkspaceSuspension } from '../auth/abuse/workspace-suspension.service';
import { SUPPORT_NOT_FOUND } from '../auth/admin-access';
import { requirePlatformOperator } from '../auth/platform-operator';
import { BillingReconciler } from '../billing/billing-reconciler.service';
import { BillingWebhookService } from '../billing/billing-webhook.service';
import { PipelineService } from '../jobs/pipeline.service';
import { SupportAudit } from './support-audit.service';
import { SupportActionDto } from './dto/support-action.dto';
import { SupportService } from './support.service';

@ApiTags('admin')
@Controller('admin/support')
export class SupportController {
  constructor(
    private readonly support: SupportService,
    private readonly audit: SupportAudit,
    private readonly suspension: WorkspaceSuspension,
    private readonly reconciler: BillingReconciler,
    private readonly webhook: BillingWebhookService,
    private readonly pipeline: PipelineService,
  ) {}

  @Get('workspaces')
  @ApiOperation({ summary: 'List every workspace with its operational state' })
  list(@CurrentUser() user: User): Promise<SupportWorkspaceSummary[]> {
    requirePlatformOperator(user, SUPPORT_NOT_FOUND);
    return this.audit.attempt({
      actor: user,
      workspaceId: ALL_WORKSPACES,
      action: 'list',
      reason: null,
      work: () => this.support.list(),
      describe: (workspaces) => `listed ${workspaces.length} workspaces`,
    });
  }

  @Get('workspaces/:workspaceId')
  @ApiOperation({ summary: 'Operational detail for one workspace' })
  detail(
    @CurrentUser() user: User,
    @Param('workspaceId') workspaceId: string,
  ): Promise<SupportWorkspaceDetail> {
    requirePlatformOperator(user, SUPPORT_NOT_FOUND);
    return this.audit.attempt({
      actor: user,
      workspaceId,
      action: 'view',
      reason: null,
      work: () => this.support.detail(workspaceId),
    });
  }

  @Post('workspaces/:workspaceId/reconcile')
  @ApiOperation({
    summary: 'Reconcile one workspace against the billing provider',
  })
  reconcile(
    @CurrentUser() user: User,
    @Param('workspaceId') workspaceId: string,
    @Body() dto: SupportActionDto,
  ): Promise<SupportActionResult> {
    return this.apply(user, workspaceId, 'reconcile', dto, async () => {
      const report = await this.reconciler.reconcileOne(workspaceId);
      return `checked ${report.checked}, corrected ${report.corrected}`;
    });
  }

  @Post('workspaces/:workspaceId/billing-events/:eventId/replay')
  @ApiOperation({
    summary: 'Replay a stored billing event for this workspace',
  })
  replayBillingEvent(
    @CurrentUser() user: User,
    @Param('workspaceId') workspaceId: string,
    @Param('eventId') eventId: string,
    @Body() dto: SupportActionDto,
  ): Promise<SupportActionResult> {
    return this.apply(user, workspaceId, 'replay', dto, async () => {
      await this.webhook.replay(eventId, workspaceId);
      return `event ${eventId} queued again`;
    });
  }

  @Post('workspaces/:workspaceId/suspend')
  @ApiOperation({ summary: 'Suspend a workspace' })
  suspend(
    @CurrentUser() user: User,
    @Param('workspaceId') workspaceId: string,
    @Body() dto: SupportActionDto,
  ): Promise<SupportActionResult> {
    return this.apply(user, workspaceId, 'suspend', dto, async () => {
      await this.suspension.suspend(workspaceId, dto.reason);
      return 'every write and on-demand action is now refused';
    });
  }

  @Post('workspaces/:workspaceId/restore')
  @ApiOperation({ summary: 'Restore a suspended workspace' })
  restore(
    @CurrentUser() user: User,
    @Param('workspaceId') workspaceId: string,
    @Body() dto: SupportActionDto,
  ): Promise<SupportActionResult> {
    return this.apply(user, workspaceId, 'restore', dto, async () => {
      await this.suspension.restore(workspaceId);
      return 'the workspace may write again';
    });
  }

  @Post('workspaces/:workspaceId/run-daily')
  @ApiOperation({ summary: 'Queue the daily run for one workspace' })
  runDaily(
    @CurrentUser() user: User,
    @Param('workspaceId') workspaceId: string,
    @Body() dto: SupportActionDto,
  ): Promise<SupportActionResult> {
    return this.apply(user, workspaceId, 'run-daily', dto, async () => {
      const summary = await this.pipeline.fanOutWorkspaceDaily(workspaceId);
      return `queued ${summary.apps} apps, ${summary.keywords} keywords, ${summary.categories} categories, ${summary.reviews} reviews`;
    });
  }

  private async apply(
    user: User,
    workspaceId: string,
    action: SupportAction,
    dto: SupportActionDto,
    work: () => Promise<string>,
  ): Promise<SupportActionResult> {
    requirePlatformOperator(user, SUPPORT_NOT_FOUND);
    const detail = await this.audit.attempt({
      actor: user,
      workspaceId,
      action,
      reason: dto.reason,
      work,
      describe: (summary) => summary,
    });
    return { action, workspaceId, detail };
  }
}
