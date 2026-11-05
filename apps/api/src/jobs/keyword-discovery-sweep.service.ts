import { Injectable, Logger } from '@nestjs/common';
import {
  WorkspaceFanOut,
  workspaceFailure,
} from '../common/tenancy/workspace-fanout';
import { KeywordDiscoveryPlanner } from '../keyword-discovery/discovery-planner.service';
import { PrismaService } from '../prisma/prisma.service';
import { ActiveWorkspaces } from './active-workspaces';

const reason = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

@Injectable()
export class KeywordDiscoverySweep {
  private readonly logger = new Logger(KeywordDiscoverySweep.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly planner: KeywordDiscoveryPlanner,
    private readonly fanOut: WorkspaceFanOut,
    private readonly active: ActiveWorkspaces,
  ) {}

  async run(): Promise<number> {
    const { results, failures } = await this.fanOut.eachOf(
      await this.active.forDailyRun(),
      () => this.sweepWorkspace(),
    );
    const failure = workspaceFailure(
      failures,
      'failed its keyword discovery sweep',
    );
    if (failure) throw failure;
    return results.reduce((total, queued) => total + queued, 0);
  }

  private async sweepWorkspace(): Promise<number> {
    const apps = await this.prisma.app.findMany({
      where: { isCompetitor: false, delistedAt: null },
      select: { id: true },
    });
    let queued = 0;
    for (const { id } of apps) {
      try {
        queued += (await this.planner.plan(id)).queued;
      } catch (error: unknown) {
        this.logger.warn(
          `could not plan the keyword discoveries of ${id}, so they wait for the next sweep: ${reason(error)}`,
        );
      }
    }
    return queued;
  }
}
