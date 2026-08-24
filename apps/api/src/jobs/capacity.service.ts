import { Injectable } from '@nestjs/common';
import { CapacityReport, WorkspaceDemand } from '@asobeast/shared';
import { WorkspaceContext } from '../common/tenancy/workspace-context';
import { WorkspaceFanOut } from '../common/tenancy/workspace-fanout';
import { ActiveWorkspaces } from './active-workspaces';
import { DailyBudgetService } from './daily-budget.service';

const TOP_CONSUMERS = 10;

@Injectable()
export class CapacityService {
  constructor(
    private readonly fanOut: WorkspaceFanOut,
    private readonly workspace: WorkspaceContext,
    private readonly activeWorkspaces: ActiveWorkspaces,
    private readonly budget: DailyBudgetService,
  ) {}

  async report(): Promise<CapacityReport> {
    const { results } = await this.fanOut.eachOf(
      await this.activeWorkspaces.forDailyRun(),
      () => this.demandOf(),
    );

    const requestsPerDay = results.reduce(
      (total, row) => total + row.requests,
      0,
    );
    const capacityPerDay = results.reduce(
      (highest, row) => Math.max(highest, row.capacityPerDay),
      0,
    );

    return {
      requestsPerDay,
      capacityPerDay,
      utilization:
        capacityPerDay > 0
          ? Math.round((requestsPerDay / capacityPerDay) * 1000) / 1000
          : 0,
      workspaces: results
        .map(({ workspaceId, requests }) => ({ workspaceId, requests }))
        .sort((a, b) => b.requests - a.requests)
        .slice(0, TOP_CONSUMERS),
    };
  }

  private async demandOf(): Promise<
    WorkspaceDemand & { capacityPerDay: number }
  > {
    const budget = await this.budget.estimate();
    return {
      workspaceId: this.workspace.require('a capacity report'),
      requests: budget.total,
      capacityPerDay: budget.capacityPerDay,
    };
  }
}
