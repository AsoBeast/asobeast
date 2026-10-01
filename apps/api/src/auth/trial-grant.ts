import { TRIAL_PLAN } from '@asobeast/shared';
import { isEntitled, type WorkspaceEntitlement } from './entitlement';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface TrialGrant {
  plan: string;
  trialStartedAt: Date;
  trialEndsAt: Date;
}

export interface TrialHistory {
  trialStartedAt: Date | null;
}

export function grantTrial(days: number, now = new Date()): TrialGrant {
  return {
    plan: TRIAL_PLAN,
    trialStartedAt: now,
    trialEndsAt: new Date(now.getTime() + days * DAY_MS),
  };
}

export function alreadyTrialed(history: TrialHistory): boolean {
  return history.trialStartedAt !== null;
}

export interface TrialWorkspace extends TrialHistory, WorkspaceEntitlement {
  subscriptionId: string | null;
}

export function canStartTrial(workspace: TrialWorkspace, now: Date): boolean {
  return (
    !alreadyTrialed(workspace) &&
    workspace.subscriptionId === null &&
    !isEntitled(workspace, now)
  );
}

export function trialStillOpen(workspace: { id: string; plan: string }) {
  return {
    id: workspace.id,
    plan: workspace.plan,
    trialStartedAt: null,
    subscriptionId: null,
  };
}

export interface TrialCandidate {
  emailVerifiedAt: Date | null;
  workspace: TrialHistory & WorkspaceEntitlement;
}

export function trialAwaitsConfirmation(
  account: TrialCandidate,
  now: Date,
): boolean {
  return (
    account.emailVerifiedAt === null &&
    !alreadyTrialed(account.workspace) &&
    !isEntitled(account.workspace, now)
  );
}
