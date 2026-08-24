import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { User } from '@prisma/client';
import {
  type SupportAction,
  type SupportActionResult,
  type SupportWorkspaceDetail,
  type SupportWorkspaceSummary,
} from '@asobeast/shared';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { WorkspaceSuspension } from '../auth/abuse/workspace-suspension.service';
import { SUPPORT_ROUTE } from '../auth/admin-access';
import { isPlatformOperator } from '../auth/platform-operator';
import { BillingReconciler } from '../billing/billing-reconciler.service';
import { PipelineService } from '../jobs/pipeline.service';
import { SupportAudit } from './support-audit.service';
import { SupportActionDto } from './dto/support-action.dto';
import { SupportService } from './support.service';

const ALL_WORKSPACES = 'all';

@ApiTags('admin')
@Controller('admin/support')
export class SupportController {
  constructor(
    private readonly support: SupportService,
    private readonly audit: SupportAudit,
    private readonly suspension: WorkspaceSuspension,
    private readonly reconciler: BillingReconciler,
    private readonly pipeline: PipelineService,
  ) {}

  @Get('workspaces')
  @ApiOperation({ summary: 'List every workspace with its operational state' })
  list(@CurrentUser() user: User): Promise<SupportWorkspaceSummary[]> {
    this.requireOperator(user);
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
    this.requireOperator(user);
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
    this.requireOperator(user);
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

  private requireOperator(user: User): void {
    if (!isPlatformOperator(user)) {
      throw new NotFoundException(`Cannot reach ${SUPPORT_ROUTE}`);
    }
  }
}
