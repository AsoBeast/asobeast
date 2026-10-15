import { Controller, Get, Header, HttpCode, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  AppRunStatus,
  CapacityReport,
  DailyBudget,
  FirstRunStatus,
  RunDailyResult,
  StoreHealthReport,
  WorkspaceRunStatus,
} from '@asobeast/shared';
import type { User } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SpendsStoreCapacity } from '../auth/decorators/spends-store-capacity.decorator';
import { OnDemandLimiter } from '../auth/on-demand.limiter';
import { requirePlatformOperator } from '../auth/platform-operator';
import { AppRunStatusService } from './app-run-status.service';
import { CapacityService } from './capacity.service';
import { DailyBudgetService } from './daily-budget.service';
import { FirstRunStatusService } from './first-run-status.service';
import { PipelineService } from './pipeline.service';
import { RunStatusService } from './run-status.service';
import { StoreHealthService } from './store-health.service';
import { QueuesWork } from '../redis/queues-work.decorator';

@ApiTags('jobs')
@Controller('apps')
export class JobsController {
  constructor(
    private readonly pipeline: PipelineService,
    private readonly limiter: OnDemandLimiter,
    private readonly firstRunStatus: FirstRunStatusService,
    private readonly appRunStatus: AppRunStatusService,
  ) {}

  @Post(':id/run-daily')
  @QueuesWork()
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

  @Get(':id/run-status')
  @ApiOperation({
    summary: "Today's run of one app",
    description:
      'Counts, for one app, the listings captured for the app and its competitors in the home storefront and every tracked market, the active keywords whose position was checked and the category charts read against the charts the app sits in, since the daily trigger or since midnight UTC once the trigger has passed. state is running while counts are missing, complete when every count is in and delayed twenty hours after the trigger with counts still missing. Reads stored rows only and never touches the queue. Answers 404 for an unknown app.',
  })
  runStatus(@Param('id') id: string): Promise<AppRunStatus> {
    return this.appRunStatus.forApp(id);
  }
}

@ApiTags('jobs')
@Controller('jobs')
export class BudgetController {
  constructor(
    private readonly budget: DailyBudgetService,
    private readonly runStatus: RunStatusService,
    private readonly stores: StoreHealthService,
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

  @Get('store-health')
  @ApiOperation({ summary: 'Report whether each store still parses' })
  storeHealth(): Promise<StoreHealthReport> {
    return this.stores.report();
  }
}

@ApiTags('admin')
@Controller('admin/capacity')
export class CapacityController {
  constructor(private readonly capacity: CapacityService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Total daily demand against pool capacity' })
  report(@CurrentUser() user: User): Promise<CapacityReport> {
    requirePlatformOperator(user, 'Cannot GET /admin/capacity');
    return this.capacity.report();
  }
}
