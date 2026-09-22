import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { User } from '@prisma/client';
import {
  DELETION_CONFIRMATION,
  type WorkspaceDeletionStatus,
} from '@asobeast/shared';
import { reasonOf } from '../billing/stripe-errors';
import { StripeService } from '../billing/stripe.service';
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
    private readonly stripe: StripeService,
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
    const { count } = await this.prisma.workspace.updateMany({
      where: { id: workspaceId, erasureClaimedAt: null },
      data: {
        deletionRequestedAt: null,
        deletionRequestedBy: null,
        deletionDueAt: null,
      },
    });
    if (count === 0) {
      throw new ConflictException(
        'This workspace is already being erased, so its deletion can no longer be cancelled',
      );
    }
    this.logger.log(`workspace ${workspaceId} deletion cancelled`);
    return this.status();
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

  private async erase(workspaceId: string, now: Date): Promise<boolean> {
    const claimed = await this.claim(workspaceId, now);
    if (!claimed) {
      this.logger.log(`workspace ${workspaceId} was no longer due for erasure`);
      return false;
    }
    if (!(await this.releaseBilling(workspaceId, claimed.billingCustomerId))) {
      await this.prisma.workspace.update({
        where: { id: workspaceId },
        data: { erasureClaimedAt: null },
      });
      return false;
    }
    return this.finish(workspaceId, claimed.billingCustomerId);
  }

  private async claim(
    workspaceId: string,
    now: Date,
  ): Promise<{ billingCustomerId: string | null } | null> {
    const { count } = await this.prisma.workspace.updateMany({
      where: { id: workspaceId, deletionDueAt: { lte: now } },
      data: { erasureClaimedAt: now },
    });
    if (count === 0) return null;
    return this.prisma.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
      select: { billingCustomerId: true },
    });
  }

  private finish(
    workspaceId: string,
    releasedCustomerId: string | null,
  ): Promise<boolean> {
    return this.prisma.withTransaction(async (tx) => {
      const [claimed] = await tx.$queryRaw<
        { billingCustomerId: string | null }[]
      >`
        SELECT "billingCustomerId" FROM "Workspace"
        WHERE "id" = ${workspaceId} AND "erasureClaimedAt" IS NOT NULL
        FOR UPDATE
      `;
      if (!claimed) {
        this.logger.log(`workspace ${workspaceId} lost its erasure claim`);
        return false;
      }
      if (claimed.billingCustomerId !== releasedCustomerId) {
        this.logger.warn(
          `workspace ${workspaceId} took stripe customer ${claimed.billingCustomerId} while its erasure was under way; the next run releases it`,
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

  private async releaseBilling(
    workspaceId: string,
    customerId: string | null,
  ): Promise<boolean> {
    if (!customerId || !this.stripe.enabled) return true;

    try {
      await this.stripe.deleteCustomer(customerId);
      this.logger.warn(
        `stripe customer ${customerId} of workspace ${workspaceId} deleted, which cancels its subscriptions`,
      );
      return true;
    } catch (error) {
      this.logger.error(
        `workspace ${workspaceId} keeps its data until stripe customer ${customerId} can be deleted: ${reasonOf(error)}`,
      );
      return false;
    }
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
