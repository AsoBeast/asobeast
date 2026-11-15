import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Prisma } from '@prisma/client';
import {
  DELETION_REASONS,
  PLAN_NAMES,
  type DeletionReason,
  type PlanName,
  type WorkspaceStage,
} from '@asobeast/shared';
import { countWorkspaceKeywordMarkets } from '../auth/keyword-markets';
import { planScopeOf } from '../auth/plan-limits';
import { isOperatorWorkspace } from '../auth/platform-operator';
import {
  WORKSPACE_STAGE_SELECT,
  isWorkspaceStage,
  workspaceStageOf,
  type WorkspaceStageSource,
} from '../billing/workspace-stage';
import { Env } from '../config/env';
import type { PrismaService } from '../prisma/prisma.service';

type Client = Prisma.TransactionClient | PrismaService;

export interface DepartingWorkspace extends WorkspaceStageSource {
  createdAt: Date;
  deletionRequestedAt: Date | null;
  deletionReason: string | null;
  deletionStage: string | null;
  deletionPlan: string | null;
}

export interface DepartureSizes {
  apps: number;
  keywordMarkets: number;
  members: number;
}

export interface DepartureStanding {
  stage: WorkspaceStage;
  plan: PlanName;
}

const utcDay = (moment: Date) => new Date(moment.toISOString().slice(0, 10));

export const isPlanName = (value: string | null): value is PlanName =>
  PLAN_NAMES.some((plan) => plan === value);

function standingAtRequest(
  workspace: DepartingWorkspace,
): DepartureStanding | null {
  const { deletionStage: stage, deletionPlan: plan } = workspace;
  return isWorkspaceStage(stage) && isPlanName(plan) ? { stage, plan } : null;
}

export const deletionReasonOf = (
  value: string | null | undefined,
): DeletionReason | null =>
  DELETION_REASONS.find((reason) => reason === value) ?? null;

export function departureOf(
  workspace: DepartingWorkspace,
  sizes: DepartureSizes,
  standingNow: DepartureStanding,
  now: Date,
): Prisma.WorkspaceDepartureCreateInput {
  const standing = standingAtRequest(workspace) ?? standingNow;
  return {
    erasedOn: utcDay(now),
    createdOn: utcDay(workspace.createdAt),
    requestedOn: utcDay(workspace.deletionRequestedAt ?? now),
    stage: standing.stage,
    plan: standing.plan,
    everPaid: workspace.firstPaidAt !== null,
    ...sizes,
    reason: deletionReasonOf(workspace.deletionReason),
  };
}

@Injectable()
export class WorkspaceDepartures {
  constructor(private readonly config: ConfigService<Env, true>) {}

  async standing(
    db: Client,
    workspaceId: string,
    now: Date,
  ): Promise<DepartureStanding> {
    const row = await db.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
      select: WORKSPACE_STAGE_SELECT,
    });
    return this.standingOf(row, now);
  }

  async record(
    tx: Prisma.TransactionClient,
    workspaceId: string,
    now: Date,
  ): Promise<void> {
    if (isOperatorWorkspace(workspaceId)) return;
    const [workspace, members, apps, keywordMarkets] = await Promise.all([
      tx.workspace.findUniqueOrThrow({
        where: { id: workspaceId },
        select: {
          ...WORKSPACE_STAGE_SELECT,
          createdAt: true,
          deletionRequestedAt: true,
          deletionReason: true,
          deletionStage: true,
          deletionPlan: true,
        },
      }),
      tx.user.count({ where: { workspaceId } }),
      tx.app.count({ where: { workspaceId, isCompetitor: false } }),
      countWorkspaceKeywordMarkets(tx, workspaceId),
    ]);
    await tx.workspaceDeparture.create({
      data: departureOf(
        workspace,
        { apps, keywordMarkets, members },
        this.standingOf(workspace, now),
        now,
      ),
    });
  }

  private standingOf(row: WorkspaceStageSource, now: Date): DepartureStanding {
    const billing = this.config.get('BILLING_ENABLED', { infer: true });
    return {
      stage: workspaceStageOf(billing, row, now),
      plan: planScopeOf(billing, row, now).plan,
    };
  }
}
