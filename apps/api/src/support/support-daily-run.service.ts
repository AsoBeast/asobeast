import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { FanOutSummary } from '@asobeast/shared';
import { WORKSPACE_NOT_FOUND } from '../auth/abuse/workspace-suspension.service';
import { CrossTenantAccess } from '../common/tenancy/cross-tenant-access';
import { PipelineService } from '../jobs/pipeline.service';
import { PrismaService } from '../prisma/prisma.service';

const RUN_JUSTIFICATION =
  'a support daily run checks the state of a workspace other than the operator own';

export const SUSPENDED_WORKSPACE_NOT_RUN =
  'A suspended workspace is not run. Restore it first';

@Injectable()
export class SupportDailyRun {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crossTenant: CrossTenantAccess,
    private readonly pipeline: PipelineService,
  ) {}

  async run(workspaceId: string): Promise<FanOutSummary> {
    const workspace =
      await this.crossTenant.becauseThisWorkIsNotOwnedByOneWorkspace(
        RUN_JUSTIFICATION,
        () =>
          this.prisma.workspace.findUnique({
            where: { id: workspaceId },
            select: { suspendedAt: true },
          }),
      );
    if (!workspace) throw new NotFoundException(WORKSPACE_NOT_FOUND);
    if (workspace.suspendedAt) {
      throw new ConflictException(SUSPENDED_WORKSPACE_NOT_RUN);
    }
    return this.pipeline.fanOutWorkspaceDaily(workspaceId);
  }
}
