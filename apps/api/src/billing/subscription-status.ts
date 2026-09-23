import type Stripe from 'stripe';

export type SubscriptionStatus = Stripe.Subscription.Status;

export type SubscriptionEffect =
  'entitles' | 'recoverable' | 'pending' | 'gone';

const STATUS_EFFECT: Record<SubscriptionStatus, SubscriptionEffect> = {
  trialing: 'entitles',
  active: 'entitles',
  past_due: 'entitles',
  unpaid: 'recoverable',
  paused: 'recoverable',
  incomplete: 'pending',
  incomplete_expired: 'gone',
  canceled: 'gone',
};

const EFFECT_BY_STATUS = new Map<string, SubscriptionEffect>(
  Object.entries(STATUS_EFFECT),
);

const UNREAD_STATUS: SubscriptionEffect = 'recoverable';

const UNKNOWN_STATUS: SubscriptionEffect = 'gone';

export function effectOf(status: string | null): SubscriptionEffect {
  if (status === null) return UNREAD_STATUS;
  return EFFECT_BY_STATUS.get(status) ?? UNKNOWN_STATUS;
}

export function entitledBy(status: SubscriptionStatus): boolean {
  return effectOf(status) === 'entitles';
}

export interface WorkspaceSubscription {
  subscriptionId: string | null;
  subscriptionStatus: string | null;
}

export function holdsSubscription(workspace: WorkspaceSubscription): boolean {
  if (!workspace.subscriptionId) return false;
  return effectOf(workspace.subscriptionStatus) !== 'gone';
}

export function stalledBy(status: string | null): boolean {
  return status !== null && effectOf(status) === 'recoverable';
}

export function pendingBy(status: string | null): boolean {
  return status !== null && effectOf(status) === 'pending';
}
