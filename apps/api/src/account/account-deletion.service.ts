import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { User } from '@prisma/client';
import {
  DELETION_CONFIRMATION,
  type WorkspaceDeletionStatus,
} from '@asobeast/shared';
import { CrossTenantAccess } from '../common/tenancy/cross-tenant-access';
import { WorkspaceContext } from '../common/tenancy/workspace-context';
import { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';

const DELETION_JUSTIFICATION =
  'erasing a workspace removes the very scope the query would otherwise run inside';

const DAY_MS = 24 * 60 * 60_000;

@Injectable()
export class AccountDeletionService {
  private readonly logger = new Logger(AccountDeletionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly workspace: WorkspaceContext,
    private readonly crossTenant: CrossTenantAccess,
    private readonly config: ConfigService<Env, true>,
  ) {}

  get graceDays(): number {
    return this.config.get('ACCOUNT_DELETION_GRACE_DAYS', { infer: true });
  }

  async status(): Promise<WorkspaceDeletionStatus> {
    const workspace = await this.prisma.workspace.findUniqueOrThrow({
      where: { id: this.workspace.require('the deletion status') },
      select: {
        deletionRequestedAt: true,
        deletionRequestedBy: true,
        deletionDueAt: true,
      },
    });
    return this.toStatus(workspace);
  }

  async request(
    actor: User,
    confirmation: string,
    now = new Date(),
  ): Promise<WorkspaceDeletionStatus> {
    if (confirmation !== DELETION_CONFIRMATION) {
      throw new BadRequestException(
        `Deleting a workspace needs the literal confirmation ${DELETION_CONFIRMATION}`,
      );
    }
    const workspaceId = this.workspace.require('a deletion request');
    const dueAt = new Date(now.getTime() + this.graceDays * DAY_MS);
    const workspace = await this.prisma.workspace.update({
      where: { id: workspaceId },
      data: {
        deletionRequestedAt: now,
        deletionRequestedBy: actor.email,
        deletionDueAt: dueAt,
      },
      select: {
        deletionRequestedAt: true,
        deletionRequestedBy: true,
        deletionDueAt: true,
      },
    });
    this.logger.warn(
      `workspace ${workspaceId} deletion requested by ${actor.email}, due ${dueAt.toISOString()}`,
    );
    return this.toStatus(workspace);
  }

  async cancel(): Promise<WorkspaceDeletionStatus> {
    const workspaceId = this.workspace.require('a deletion cancellation');
    const workspace = await this.prisma.workspace.update({
      where: { id: workspaceId },
      data: {
        deletionRequestedAt: null,
        deletionRequestedBy: null,
        deletionDueAt: null,
      },
      select: {
        deletionRequestedAt: true,
        deletionRequestedBy: true,
        deletionDueAt: true,
      },
    });
    this.logger.log(`workspace ${workspaceId} deletion cancelled`);
    return this.toStatus(workspace);
  }

  eraseDue(now = new Date()): Promise<string[]> {
    return this.crossTenant.becauseThisWorkIsNotOwnedByOneWorkspace(
      DELETION_JUSTIFICATION,
      async () => {
        const due = await this.prisma.workspace.findMany({
          where: { deletionDueAt: { lte: now } },
          select: { id: true },
        });
        const erased: string[] = [];
        for (const workspace of due) {
          if (await this.erase(workspace.id, now)) erased.push(workspace.id);
        }
        return erased;
      },
    );
  }

  private erase(workspaceId: string, now: Date): Promise<boolean> {
    return this.prisma.withTransaction(async (tx) => {
      const [claimed] = await tx.$queryRaw<{ id: string }[]>`
        SELECT "id" FROM "Workspace"
        WHERE "id" = ${workspaceId} AND "deletionDueAt" <= ${now}
        FOR UPDATE
      `;
      if (!claimed) {
        this.logger.log(
          `workspace ${workspaceId} was no longer due for erasure`,
        );
        return false;
      }
      await tx.billingEvent.updateMany({
        where: { workspaceId },
        data: { workspaceId: null },
      });
      await tx.workspace.delete({ where: { id: workspaceId } });
      this.logger.warn(`workspace ${workspaceId} erased`);
      return true;
    });
  }

  private toStatus(workspace: {
    deletionRequestedAt: Date | null;
    deletionRequestedBy: string | null;
    deletionDueAt: Date | null;
  }): WorkspaceDeletionStatus {
    return {
      scheduled: workspace.deletionDueAt !== null,
      requestedAt: workspace.deletionRequestedAt?.toISOString() ?? null,
      requestedBy: workspace.deletionRequestedBy,
      dueAt: workspace.deletionDueAt?.toISOString() ?? null,
      graceDays: this.graceDays,
    };
  }
}
