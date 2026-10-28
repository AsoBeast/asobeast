import type { EntryStep } from '@asobeast/shared';

export interface EntryCandidate {
  billing: boolean;
  verificationRequired: boolean;
  emailVerified: boolean;
  role: string;
  entitled: boolean;
  heldPlan: boolean;
}

export interface HeldPlanSource {
  subscriptionId: string | null;
  trialStartedAt: Date | null;
  trialEndsAt: Date | null;
  planExpiresAt: Date | null;
}

export function heldPlanOf(workspace: HeldPlanSource): boolean {
  return (
    workspace.subscriptionId !== null ||
    workspace.trialStartedAt !== null ||
    workspace.trialEndsAt !== null ||
    workspace.planExpiresAt !== null
  );
}

export function entryStepOf(account: EntryCandidate): EntryStep | undefined {
  if (!account.billing || account.entitled || account.role !== 'owner') {
    return undefined;
  }
  if (account.heldPlan) return undefined;
  if (account.verificationRequired && !account.emailVerified) {
    return 'confirm-email';
  }
  return 'choose-plan';
}
