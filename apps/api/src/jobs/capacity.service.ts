import { Injectable } from '@nestjs/common';
import {
  CapacityReport,
  STORES,
  StoreDailyBudget,
  StoreDemand,
  WorkspaceDemand,
} from '@asobeast/shared';
import { WorkspaceContext } from '../common/tenancy/workspace-context';
import { WorkspaceFanOut } from '../common/tenancy/workspace-fanout';
import { ActiveWorkspaces } from './active-workspaces';
import { DailyBudgetService } from './daily-budget.service';

const TOP_CONSUMERS = 10;

interface Demand extends WorkspaceDemand {
  capacityPerDay: number;
  stores: StoreDailyBudget[];
}

const utilizationOf = (requests: number, capacity: number) =>
  capacity > 0 ? Math.round((requests / capacity) * 1000) / 1000 : 0;

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
      utilization: utilizationOf(requestsPerDay, capacityPerDay),
      workspaces: topConsumers(results),
      stores: results.length > 0 ? storeDemand(results) : undefined,
    };
  }

  private async demandOf(): Promise<Demand> {
    const budget = await this.budget.estimate();
    return {
      workspaceId: this.workspace.require('a capacity report'),
      requests: budget.total,
      capacityPerDay: budget.capacityPerDay,
      stores: budget.stores,
    };
  }
}

function topConsumers(results: Demand[]): WorkspaceDemand[] {
  return results
    .map(({ workspaceId, requests }) => ({ workspaceId, requests }))
    .sort((a, b) => b.requests - a.requests)
    .slice(0, TOP_CONSUMERS);
}

function storeDemand(results: Demand[]): StoreDemand[] {
  const budgets = results.flatMap((row) => row.stores);
  return STORES.flatMap((store) => {
    const reported = budgets.filter((budget) => budget.store === store);
    if (reported.length === 0) return [];
    const requestsPerDay = reported.reduce(
      (total, budget) => total + budget.total,
      0,
    );
    const capacityPerDay = Math.max(
      ...reported.map((budget) => budget.capacityPerDay),
    );
    return [
      {
        store,
        requestsPerDay,
        capacityPerDay,
        utilization: utilizationOf(requestsPerDay, capacityPerDay),
      },
    ];
  });
}
