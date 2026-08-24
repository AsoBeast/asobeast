import { Injectable, Logger } from '@nestjs/common';
import { WorkspaceContext } from '../common/tenancy/workspace-context';
import { PrismaService } from '../prisma/prisma.service';

export interface OverLimitState {
  since: Date | null;
  notifiedAt: Date | null;
}

@Injectable()
export class OverLimitRegistry {
  private readonly logger = new Logger(OverLimitRegistry.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly workspace: WorkspaceContext,
  ) {}

  async state(): Promise<OverLimitState> {
    const row = await this.prisma.workspace.findFirst({
      where: { id: this.currentId() },
      select: { overLimitSince: true, overLimitNotifiedAt: true },
    });
    return {
      since: row?.overLimitSince ?? null,
      notifiedAt: row?.overLimitNotifiedAt ?? null,
    };
  }

  async recordWithinLimit(state: OverLimitState): Promise<void> {
    if (!state.since && !state.notifiedAt) return;
    await this.prisma.workspace.update({
      where: { id: this.currentId() },
      data: { overLimitSince: null, overLimitNotifiedAt: null },
    });
  }

  async recordOverLimit(
    state: OverLimitState,
    detail: { used: number; limit: number; dropped: number },
    now: Date,
  ): Promise<void> {
    const workspaceId = this.currentId();
    await this.prisma.workspace.update({
      where: { id: workspaceId },
      data: {
        overLimitSince: state.since ?? now,
        overLimitNotifiedAt: state.notifiedAt ?? now,
      },
    });
    if (state.notifiedAt) return;
    this.logger.warn(
      `workspace ${workspaceId} is over its keyword limit: ${detail.used} tracked against ${detail.limit}, ${detail.dropped} not covered today`,
    );
  }

  private currentId(): string {
    return this.workspace.require('an over-limit check');
  }
}
