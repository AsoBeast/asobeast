import type Stripe from 'stripe';
import {
  FREE_PLAN,
  type BillingInterval,
  type PaidPlanName,
  type PlanName,
} from '@asobeast/shared';
import {
  effectOf,
  entitledBy,
  type SubscriptionStatus,
} from './subscription-status';
import { belongsToWorkspace } from './workspace-link';

export interface SubscriptionState {
  subscriptionId: string;
  status: SubscriptionStatus;
  plan: PlanName;
  planExpiresAt: Date | null;
  cancelAtPeriodEnd: boolean;
  trialStartedAt: Date | null;
  trialEndsAt: Date | null;
  endedAt: Date | null;
  billingInterval: BillingInterval | null;
}

function dateOf(seconds: number | null | undefined): Date | null {
  return seconds ? new Date(seconds * 1000) : null;
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
  interval: BillingInterval | null,
): SubscriptionState {
  const status = subscription.status;
  const entitled = entitledBy(status);
  return {
    subscriptionId: subscription.id,
    status,
    plan: entitled ? plan : FREE_PLAN,
    planExpiresAt: periodEndOf(subscription),
    cancelAtPeriodEnd:
      subscription.cancel_at_period_end || Boolean(subscription.cancel_at),
    trialStartedAt: dateOf(subscription.trial_start),
    trialEndsAt: dateOf(subscription.trial_end),
    endedAt: dateOf(subscription.ended_at),
    billingInterval: entitled ? interval : null,
  };
}

export interface PlanResolver {
  planOf(subscription: Stripe.Subscription): PaidPlanName;
  intervalOf(subscription: Stripe.Subscription): BillingInterval;
}

export function stateFrom(
  subscription: Stripe.Subscription,
  prices: PlanResolver,
): SubscriptionState {
  if (!entitledBy(subscription.status)) {
    return stateOf(subscription, FREE_PLAN, null);
  }
  return stateOf(
    subscription,
    prices.planOf(subscription),
    prices.intervalOf(subscription),
  );
}

export interface TrialDates {
  trialStartedAt: Date | null;
  trialEndsAt: Date | null;
}

export interface SubscriptionProjection extends Partial<TrialDates> {
  plan: PlanName;
  planExpiresAt: Date | null;
  subscriptionId: string;
  subscriptionStatus: SubscriptionStatus;
  cancelAtPeriodEnd: boolean;
  billingInterval: BillingInterval | null;
}

export function projectionOf(
  state: SubscriptionState,
  held: TrialDates,
  now: Date,
): SubscriptionProjection {
  return {
    plan: state.plan,
    planExpiresAt: state.planExpiresAt,
    subscriptionId: state.subscriptionId,
    subscriptionStatus: state.status,
    cancelAtPeriodEnd: state.cancelAtPeriodEnd,
    billingInterval: state.billingInterval,
    ...(held.trialStartedAt === null && state.trialStartedAt
      ? { trialStartedAt: state.trialStartedAt }
      : {}),
    ...trialEndOf(state, held, now),
  };
}

function trialEndOf(
  state: SubscriptionState,
  held: TrialDates,
  now: Date,
): Pick<TrialDates, 'trialEndsAt'> | Record<string, never> {
  if (effectOf(state.status) !== 'gone') {
    return state.trialEndsAt ? { trialEndsAt: state.trialEndsAt } : {};
  }
  const ended = state.endedAt && state.endedAt < now ? state.endedAt : now;
  return held.trialEndsAt && held.trialEndsAt > ended
    ? { trialEndsAt: ended }
    : {};
}

export function heldSubscription(
  subscriptions: Stripe.Subscription[],
): Stripe.Subscription | undefined {
  const held = subscriptions.filter(
    (subscription) => effectOf(subscription.status) !== 'gone',
  );
  return (
    held.find((subscription) => entitledBy(subscription.status)) ?? held.at(0)
  );
}

export function heldForWorkspace(
  subscriptions: Stripe.Subscription[],
  workspaceId: string,
): Stripe.Subscription | undefined {
  return heldSubscription(
    subscriptions.filter((subscription) =>
      belongsToWorkspace(subscription, workspaceId),
    ),
  );
}

export function subscriptionIdOfSession(
  session: Stripe.Checkout.Session,
): string | null {
  const subscription = session.subscription;
  if (typeof subscription === 'string') return subscription;
  return subscription?.id ?? null;
}
