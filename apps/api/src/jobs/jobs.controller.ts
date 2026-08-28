import {
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CapacityReport,
  DailyBudget,
  FirstRunStatus,
  RunDailyResult,
  WorkspaceRunStatus,
} from '@asobeast/shared';
import type { User } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SpendsStoreCapacity } from '../auth/decorators/spends-store-capacity.decorator';
import { OnDemandLimiter } from '../auth/on-demand.limiter';
import { isPlatformOperator } from '../auth/platform-operator';
import { CapacityService } from './capacity.service';
import { DailyBudgetService } from './daily-budget.service';
import { FirstRunStatusService } from './first-run-status.service';
import { PipelineService } from './pipeline.service';
import { RunStatusService } from './run-status.service';

@ApiTags('jobs')
@Controller('apps')
export class JobsController {
  constructor(
    private readonly pipeline: PipelineService,
    private readonly limiter: OnDemandLimiter,
    private readonly firstRunStatus: FirstRunStatusService,
  ) {}

  @Post(':id/run-daily')
  @SpendsStoreCapacity()
  @HttpCode(202)
  @ApiOperation({ summary: 'Manually run the daily pipeline for one app' })
  async runDaily(@Param('id') id: string): Promise<RunDailyResult> {
    await this.limiter.consume('runDaily');
    return { enqueued: await this.pipeline.fanOutApp(id) };
  }

  @Get(':id/first-run')
  @ApiOperation({
    summary: 'Report what a newly imported app is still waiting for',
  })
  firstRun(@Param('id') id: string): Promise<FirstRunStatus> {
    return this.firstRunStatus.forApp(id);
  }
}

@ApiTags('jobs')
@Controller('jobs')
export class BudgetController {
  constructor(
    private readonly budget: DailyBudgetService,
    private readonly runStatus: RunStatusService,
  ) {}

  @Get('budget')
  @ApiOperation({ summary: 'Estimate the daily store request budget' })
  estimate(): Promise<DailyBudget> {
    return this.budget.estimate();
  }

  @Get('run-status')
  @ApiOperation({
    summary: "Progress of this workspace's own daily run",
  })
  status(): Promise<WorkspaceRunStatus> {
    return this.runStatus.forWorkspace();
  }
}

@ApiTags('admin')
@Controller('admin/capacity')
export class CapacityController {
  constructor(private readonly capacity: CapacityService) {}

  @Get()
  @ApiOperation({ summary: 'Total daily demand against pool capacity' })
  report(@CurrentUser() user: User): Promise<CapacityReport> {
    if (!isPlatformOperator(user)) {
      throw new NotFoundException('Cannot GET /admin/capacity');
    }
    return this.capacity.report();
  }
}
