import type Stripe from 'stripe';
import { FREE_PLAN, type PlanName } from '@asobeast/shared';
import { entitledBy, type SubscriptionStatus } from './subscription-status';

export interface SubscriptionState {
  subscriptionId: string;
  status: SubscriptionStatus;
  plan: PlanName;
  planExpiresAt: Date | null;
  cancelAtPeriodEnd: boolean;
}

export function periodEndOf(subscription: Stripe.Subscription): Date | null {
  const seconds = subscription.items.data.reduce<number | null>(
    (latest, item) =>
      item.current_period_end > (latest ?? 0)
        ? item.current_period_end
        : latest,
    null,
  );
  return seconds === null ? null : new Date(seconds * 1000);
}

export function stateOf(
  subscription: Stripe.Subscription,
  plan: PlanName,
): SubscriptionState {
  const status = subscription.status;
  return {
    subscriptionId: subscription.id,
    status,
    plan: entitledBy(status) ? plan : FREE_PLAN,
    planExpiresAt: periodEndOf(subscription),
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
  };
}
