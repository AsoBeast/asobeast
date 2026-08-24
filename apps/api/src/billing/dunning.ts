import type { SubscriptionStatus } from './subscription-status';

export interface DunningState {
  dunningNotifiedAt: Date | null;
}

export function entersDunning(
  state: DunningState,
  status: SubscriptionStatus,
): boolean {
  return status === 'past_due' && state.dunningNotifiedAt === null;
}

export function leavesDunning(
  state: DunningState,
  status: SubscriptionStatus,
): boolean {
  if (state.dunningNotifiedAt === null) return false;
  return status === 'active' || status === 'trialing';
}
