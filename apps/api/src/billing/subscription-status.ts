import type Stripe from 'stripe';

export type SubscriptionStatus = Stripe.Subscription.Status;

const ENTITLED_STATUSES: Record<SubscriptionStatus, boolean> = {
  trialing: true,
  active: true,
  past_due: true,
  unpaid: false,
  canceled: false,
  incomplete: false,
  incomplete_expired: false,
  paused: false,
};

export function entitledBy(status: SubscriptionStatus): boolean {
  return ENTITLED_STATUSES[status] ?? false;
}

const LIVE_STATUSES: Record<SubscriptionStatus, boolean> = {
  trialing: true,
  active: true,
  past_due: true,
  unpaid: true,
  paused: true,
  incomplete: false,
  incomplete_expired: false,
  canceled: false,
};

export function holdsSubscription(workspace: {
  subscriptionId: string | null;
  subscriptionStatus: string | null;
}): boolean {
  if (!workspace.subscriptionId) return false;
  if (workspace.subscriptionStatus === null) return true;
  return LIVE_STATUSES[workspace.subscriptionStatus] ?? false;
}
