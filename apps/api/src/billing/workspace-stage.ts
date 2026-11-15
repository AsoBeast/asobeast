import {
  TRIAL_PLAN,
  WORKSPACE_STAGES,
  effectivePlan,
  paidPlanOf,
  type PlanEntitlement,
  type WorkspaceStage,
} from '@asobeast/shared';
import { holdsSubscription, stalledBy } from './subscription-status';

export const WORKSPACE_STAGE_SELECT = {
  plan: true,
  trialEndsAt: true,
  planExpiresAt: true,
  subscriptionId: true,
  subscriptionStatus: true,
  trialStartedAt: true,
  firstPaidAt: true,
} as const;

export interface WorkspaceStageSource extends PlanEntitlement {
  subscriptionId: string | null;
  subscriptionStatus: string | null;
  trialStartedAt: Date | null;
  firstPaidAt: Date | null;
}

export interface WorkspaceFlagSource extends WorkspaceStageSource {
  cancelAtPeriodEnd: boolean;
}

const CANCELABLE_STAGES: ReadonlySet<WorkspaceStage> = new Set([
  'trialing',
  'paying',
  'payment-failed',
]);

function paymentFailed(workspace: WorkspaceStageSource): boolean {
  if (workspace.subscriptionId === null) return false;
  return (
    workspace.subscriptionStatus === 'past_due' ||
    stalledBy(workspace.subscriptionStatus, workspace.firstPaidAt !== null)
  );
}

function paidStageOf(workspace: WorkspaceStageSource): WorkspaceStage {
  const everPaid = workspace.firstPaidAt !== null;
  if (workspace.subscriptionStatus === 'trialing') return 'trialing';
  if (holdsSubscription(workspace) && !everPaid) return 'trialing';
  if (everPaid) return 'paying';
  return 'comped';
}

export const isWorkspaceStage = (
  value: string | null,
): value is WorkspaceStage => WORKSPACE_STAGES.some((stage) => stage === value);

export function startedTrial(workspace: WorkspaceStageSource): boolean {
  return workspace.trialStartedAt !== null || workspace.trialEndsAt !== null;
}

function freeStageOf(workspace: WorkspaceStageSource): WorkspaceStage {
  if (workspace.firstPaidAt !== null) return 'churned';
  if (startedTrial(workspace)) return 'trial-ended';
  return 'no-plan';
}

export function workspaceStageOf(
  billing: boolean,
  workspace: WorkspaceStageSource,
  now: Date,
): WorkspaceStage {
  if (!billing) return 'self-hosted';
  if (paymentFailed(workspace)) return 'payment-failed';
  const plan = effectivePlan(workspace, now);
  if (plan === TRIAL_PLAN) return 'trialing';
  if (paidPlanOf(plan) !== null) return paidStageOf(workspace);
  return freeStageOf(workspace);
}

export function cancelingOf(
  stage: WorkspaceStage,
  workspace: WorkspaceFlagSource,
): boolean {
  return workspace.cancelAtPeriodEnd && CANCELABLE_STAGES.has(stage);
}
