import { Injectable, Logger } from '@nestjs/common';
import type { User } from '@prisma/client';
import {
  SUPPORT_ACTIONS,
  SUPPORT_OUTCOMES,
  type SupportAccessEntry,
  type SupportAction,
  type SupportOutcome,
} from '@asobeast/shared';
import { CrossTenantAccess } from '../common/tenancy/cross-tenant-access';
import { PrismaService } from '../prisma/prisma.service';

const AUDIT_JUSTIFICATION =
  'the support audit trail records operator access to workspaces other than their own';

const RECENT_ACCESS = 20;

const MAX_DETAIL = 500;

export interface SupportAttempt<T> {
  actor: User;
  workspaceId: string;
  action: SupportAction;
  reason: string | null;
  work: () => Promise<T>;
  describe?: (result: T) => string;
}

@Injectable()
export class SupportAudit {
  private readonly logger = new Logger(SupportAudit.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crossTenant: CrossTenantAccess,
  ) {}

  async attempt<T>(attempt: SupportAttempt<T>): Promise<T> {
    const { actor, workspaceId, action, reason } = attempt;
    const id = await this.open(actor, workspaceId, action, reason);
    try {
      const result = await attempt.work();
      await this.settle(id, 'succeeded', attempt.describe?.(result) ?? null);
      return result;
    } catch (error) {
      await this.settle(id, 'failed', messageOf(error));
      throw error;
    }
  }

  private async open(
    actor: User,
    workspaceId: string,
    action: SupportAction,
    reason: string | null,
  ): Promise<string> {
    this.logger.log(
      `support ${action} on ${workspaceId} by ${actor.email}${reason ? `: ${reason}` : ''}`,
    );
    const row = await this.crossTenant.becauseThisWorkIsNotOwnedByOneWorkspace(
      AUDIT_JUSTIFICATION,
      () =>
        this.prisma.supportAccess.create({
          data: {
            actorUserId: actor.id,
            actorEmail: actor.email,
            workspaceId,
            action,
            outcome: 'attempted',
            reason,
          },
          select: { id: true },
        }),
    );
    return row.id;
  }

  private async settle(
    id: string,
    outcome: SupportOutcome,
    detail: string | null,
  ): Promise<void> {
    try {
      await this.crossTenant.becauseThisWorkIsNotOwnedByOneWorkspace(
        AUDIT_JUSTIFICATION,
        () =>
          this.prisma.supportAccess.update({
            where: { id },
            data: { outcome, detail: detail?.slice(0, MAX_DETAIL) ?? null },
          }),
      );
    } catch (error) {
      this.logger.error(
        `support audit ${id} could not record ${outcome}: ${messageOf(error)}`,
      );
    }
  }

  recent(workspaceId: string): Promise<SupportAccessEntry[]> {
    return this.crossTenant.becauseThisWorkIsNotOwnedByOneWorkspace(
      AUDIT_JUSTIFICATION,
      async () => {
        const rows = await this.prisma.supportAccess.findMany({
          where: { workspaceId },
          orderBy: { createdAt: 'desc' },
          take: RECENT_ACCESS,
          select: {
            actorEmail: true,
            action: true,
            outcome: true,
            detail: true,
            reason: true,
            createdAt: true,
          },
        });
        return rows.map((row) => ({
          actorEmail: row.actorEmail,
          action: supportActionOf(row.action),
          outcome: supportOutcomeOf(row.outcome),
          reason: row.reason,
          detail: row.detail,
          at: row.createdAt.toISOString(),
        }));
      },
    );
  }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function supportActionOf(action: string): SupportAction {
  return SUPPORT_ACTIONS.includes(action as SupportAction)
    ? (action as SupportAction)
    : 'view';
}

function supportOutcomeOf(outcome: string): SupportOutcome {
  return SUPPORT_OUTCOMES.includes(outcome as SupportOutcome)
    ? (outcome as SupportOutcome)
    : 'attempted';
}
