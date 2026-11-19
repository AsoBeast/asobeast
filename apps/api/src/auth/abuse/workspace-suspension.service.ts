import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { CrossTenantAccess } from '../../common/tenancy/cross-tenant-access';
import { PrismaService } from '../../prisma/prisma.service';
import { isOperatorWorkspace } from '../platform-operator';

const OPERATOR_JUSTIFICATION =
  'suspending or restoring a workspace is an operator action taken from outside any workspace';

export const OPERATOR_WORKSPACE_NOT_SUSPENDABLE =
  'The operator workspace cannot be suspended, because the operator would lose the surfaces that restore it';

export const WORKSPACE_ALREADY_SUSPENDED =
  'The workspace is already suspended. Restore it first to suspend it with another reason';

export const WORKSPACE_NOT_SUSPENDED = 'The workspace is not suspended';

export const WORKSPACE_NOT_FOUND = 'Workspace not found';

interface Transition {
  from: Prisma.WorkspaceWhereInput;
  data: Prisma.WorkspaceUpdateManyMutationInput;
  refusal: string;
}

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
    if (isOperatorWorkspace(workspaceId)) {
      throw new ConflictException(OPERATOR_WORKSPACE_NOT_SUSPENDABLE);
    }
    await this.transition(workspaceId, {
      from: { suspendedAt: null },
      data: { suspendedAt: now, suspendedReason: reason },
      refusal: WORKSPACE_ALREADY_SUSPENDED,
    });
    this.logger.warn(`workspace ${workspaceId} suspended: ${reason}`);
  }

  async restore(workspaceId: string): Promise<void> {
    await this.transition(workspaceId, {
      from: { suspendedAt: { not: null } },
      data: { suspendedAt: null, suspendedReason: null, abuseFlaggedAt: null },
      refusal: WORKSPACE_NOT_SUSPENDED,
    });
    this.logger.log(`workspace ${workspaceId} restored`);
  }

  private transition(
    workspaceId: string,
    { from, data, refusal }: Transition,
  ): Promise<void> {
    return this.crossTenant.becauseThisWorkIsNotOwnedByOneWorkspace(
      OPERATOR_JUSTIFICATION,
      async () => {
        const { count } = await this.prisma.workspace.updateMany({
          where: { id: workspaceId, ...from },
          data,
        });
        if (count > 0) return;
        const exists = await this.prisma.workspace.count({
          where: { id: workspaceId },
        });
        throw exists > 0
          ? new ConflictException(refusal)
          : new NotFoundException(WORKSPACE_NOT_FOUND);
      },
    );
  }
}
