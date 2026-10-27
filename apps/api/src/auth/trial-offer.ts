import type { TrialOffer } from '@asobeast/shared';
import { canStartTrial, type TrialWorkspace } from './trial-grant';

export interface TrialOfferInput {
  workspace: TrialWorkspace;
  mailboxClaimed: boolean;
  days: number;
}

export function trialOfferFor(
  input: TrialOfferInput,
  now: Date,
): TrialOffer | null {
  if (input.mailboxClaimed || !canStartTrial(input.workspace, now)) {
    return null;
  }
  return { days: input.days };
}
