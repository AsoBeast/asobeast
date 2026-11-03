import { isEntitled, type WorkspaceEntitlement } from './entitlement';

export interface TrialDecline {
  trialDeclinedAt: Date;
}

export interface TrialHistory {
  trialStartedAt: Date | null;
}

export function declineTrial(now = new Date()): TrialDecline {
  return { trialDeclinedAt: now };
}

export function alreadyTrialed(history: TrialHistory): boolean {
  return history.trialStartedAt !== null;
}

export interface TrialWorkspace extends TrialHistory, WorkspaceEntitlement {
  trialDeclinedAt: Date | null;
  subscriptionId: string | null;
}

export function canStartTrial(workspace: TrialWorkspace, now: Date): boolean {
  return (
    !alreadyTrialed(workspace) &&
    workspace.trialDeclinedAt === null &&
    workspace.subscriptionId === null &&
    !isEntitled(workspace, now)
  );
}

export function trialStillOpen(workspace: { id: string; plan: string }) {
  return {
    id: workspace.id,
    plan: workspace.plan,
    trialStartedAt: null,
    trialDeclinedAt: null,
    subscriptionId: null,
  };
}

export interface TrialCandidate {
  emailVerifiedAt: Date | null;
  workspace: TrialWorkspace;
}

export function trialAwaitsConfirmation(
  account: TrialCandidate,
  now: Date,
): boolean {
  return (
    account.emailVerifiedAt === null && canStartTrial(account.workspace, now)
  );
}
