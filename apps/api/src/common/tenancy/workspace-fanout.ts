import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CrossTenantAccess } from './cross-tenant-access';
import { WorkspaceContext } from './workspace-context';

export interface WorkspaceFailure {
  workspaceId: string;
  error: unknown;
}

export interface FanOutOutcome<T> {
  results: T[];
  failures: WorkspaceFailure[];
}

export function workspaceFailure(
  failures: WorkspaceFailure[],
  summary: string,
): Error | null {
  if (failures.length === 0) return null;
  const errors = failures.map(({ workspaceId, error }) => {
    const detail = error instanceof Error ? error.message : String(error);
    return new Error(`workspace ${workspaceId} ${summary}: ${detail}`, {
      cause: error,
    });
  });
  return errors.length === 1
    ? errors[0]
    : new AggregateError(errors, `multiple workspaces ${summary}`);
}

@Injectable()
export class WorkspaceFanOut {
  private readonly logger = new Logger(WorkspaceFanOut.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly workspace: WorkspaceContext,
    private readonly crossTenant: CrossTenantAccess,
  ) {}

  async each<T>(
    justification: string,
    work: () => Promise<T>,
  ): Promise<FanOutOutcome<T>> {
    const workspaceIds =
      await this.crossTenant.becauseThisWorkIsNotOwnedByOneWorkspace(
        justification,
        () => this.everyWorkspaceId(),
      );
    return this.eachOf(workspaceIds, work);
  }

  async eachOf<T>(
    workspaceIds: string[],
    work: () => Promise<T>,
  ): Promise<FanOutOutcome<T>> {
    const results: T[] = [];
    const failures: WorkspaceFailure[] = [];
    for (const workspaceId of workspaceIds) {
      try {
        results.push(
          await this.workspace.run(workspaceId, async () => {
            const value = await work();
            return value;
          }),
        );
      } catch (error) {
        this.logger.error(`workspace ${workspaceId} failed`, error);
        failures.push({ workspaceId, error });
      }
    }
    return { results, failures };
  }

  private async everyWorkspaceId(): Promise<string[]> {
    const rows = await this.prisma.workspace.findMany({
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    return rows.map((row) => row.id);
  }
}
