import { Injectable } from '@nestjs/common';
import {
  CapacityReport,
  STORES,
  StoreDailyBudget,
  StoreDemand,
  WorkspaceDemand,
} from '@asobeast/shared';
import { CrossTenantAccess } from '../common/tenancy/cross-tenant-access';
import { WorkspaceContext } from '../common/tenancy/workspace-context';
import { WorkspaceFanOut } from '../common/tenancy/workspace-fanout';
import { PrismaService } from '../prisma/prisma.service';
import { ActiveWorkspaces } from './active-workspaces';
import { DailyBudgetService } from './daily-budget.service';

const TOP_CONSUMERS = 10;

const NAMES_JUSTIFICATION =
  'the capacity report names the workspaces that consume the most';

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
    private readonly prisma: PrismaService,
    private readonly crossTenant: CrossTenantAccess,
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
      workspaces: await this.topConsumers(results),
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

  private async topConsumers(results: Demand[]): Promise<WorkspaceDemand[]> {
    const top = results
      .map(({ workspaceId, requests }) => ({ workspaceId, requests }))
      .sort((a, b) => b.requests - a.requests)
      .slice(0, TOP_CONSUMERS);
    if (top.length === 0) return top;
    const names = await this.namesOf(top.map((row) => row.workspaceId));
    return top.map(({ workspaceId, requests }) => ({
      workspaceId,
      name: names.get(workspaceId),
      requests,
    }));
  }

  private async namesOf(ids: string[]): Promise<Map<string, string>> {
    const rows = await this.crossTenant.becauseThisWorkIsNotOwnedByOneWorkspace(
      NAMES_JUSTIFICATION,
      () =>
        this.prisma.workspace.findMany({
          where: { id: { in: ids } },
          select: { id: true, name: true },
        }),
    );
    return new Map(rows.map((row) => [row.id, row.name]));
  }
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
