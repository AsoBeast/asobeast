import type Stripe from 'stripe';
import { FREE_PLAN, isPaidPlan, type PlanName } from '@asobeast/shared';
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

export interface SubscriptionProjection {
  plan: PlanName;
  planExpiresAt: Date | null;
  subscriptionId: string;
  subscriptionStatus: SubscriptionStatus;
  cancelAtPeriodEnd: boolean;
  overLimitSince?: null;
  overLimitNotifiedAt?: null;
}

export function projectionOf(state: SubscriptionState): SubscriptionProjection {
  return {
    plan: state.plan,
    planExpiresAt: state.planExpiresAt,
    subscriptionId: state.subscriptionId,
    subscriptionStatus: state.status,
    cancelAtPeriodEnd: state.cancelAtPeriodEnd,
    ...reopenedCapacity(state.plan),
  };
}

function reopenedCapacity(
  plan: PlanName,
): Pick<SubscriptionProjection, 'overLimitSince' | 'overLimitNotifiedAt'> {
  if (!isPaidPlan(plan)) return {};
  return { overLimitSince: null, overLimitNotifiedAt: null };
}
