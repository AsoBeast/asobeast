import { Injectable, Logger } from '@nestjs/common';
import { CrossTenantAccess } from '../../common/tenancy/cross-tenant-access';
import { PrismaService } from '../../prisma/prisma.service';

const OPERATOR_JUSTIFICATION =
  'suspending or restoring a workspace is an operator action taken from outside any workspace';

@Injectable()
export class WorkspaceSuspension {
  private readonly logger = new Logger(WorkspaceSuspension.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crossTenant: CrossTenantAccess,
  ) {}

  async suspend(
    workspaceId: string,
    reason: string,
    now = new Date(),
  ): Promise<void> {
    await this.write(workspaceId, {
      suspendedAt: now,
      suspendedReason: reason,
    });
    this.logger.warn(`workspace ${workspaceId} suspended: ${reason}`);
  }

  async restore(workspaceId: string): Promise<void> {
    await this.write(workspaceId, {
      suspendedAt: null,
      suspendedReason: null,
      abuseFlaggedAt: null,
    });
    this.logger.log(`workspace ${workspaceId} restored`);
  }

  private write(
    workspaceId: string,
    data: {
      suspendedAt: Date | null;
      suspendedReason: string | null;
      abuseFlaggedAt?: null;
    },
  ): Promise<unknown> {
    return this.crossTenant.becauseThisWorkIsNotOwnedByOneWorkspace(
      OPERATOR_JUSTIFICATION,
      () => this.prisma.workspace.update({ where: { id: workspaceId }, data }),
    );
  }
}
