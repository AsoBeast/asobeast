import type Stripe from 'stripe';
import type { PaidPlanName } from '@asobeast/shared';

export type PriceLookup = (priceId: string) => { plan: PaidPlanName } | null;

export function scheduleIdOf(subscription: Stripe.Subscription): string | null {
  const schedule = subscription.schedule;
  if (typeof schedule === 'string') return schedule;
  return schedule?.id ?? null;
}

export function nextPhasePlan(
  schedule: Stripe.SubscriptionSchedule,
  now: Date,
  lookup: PriceLookup,
): PaidPlanName | null {
  const seconds = Math.floor(now.getTime() / 1000);
  const upcoming = schedule.phases.find((phase) => phase.start_date > seconds);
  const priceId = priceIdOf(upcoming?.items[0]);
  return priceId ? (lookup(priceId)?.plan ?? null) : null;
}

function priceIdOf(
  item: Stripe.SubscriptionSchedule.Phase.Item | undefined,
): string | null {
  const price = item?.price;
  if (typeof price === 'string') return price;
  return price?.id ?? null;
}
