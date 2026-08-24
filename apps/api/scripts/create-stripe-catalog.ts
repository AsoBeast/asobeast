import 'dotenv/config';
import Stripe from 'stripe';
import {
  BILLING_INTERVALS,
  PAID_PLAN_NAMES,
  PLANS,
  type BillingInterval,
  type PaidPlanName,
} from '@asobeast/shared';
import { STRIPE_API_VERSION } from '../src/billing/stripe.client';

const ENV_KEYS: Record<PaidPlanName, Record<BillingInterval, string>> = {
  indie: {
    month: 'STRIPE_PRICE_INDIE_MONTHLY',
    year: 'STRIPE_PRICE_INDIE_YEARLY',
  },
  ultimate: {
    month: 'STRIPE_PRICE_ULTIMATE_MONTHLY',
    year: 'STRIPE_PRICE_ULTIMATE_YEARLY',
  },
};

function amountCents(plan: PaidPlanName, interval: BillingInterval): number {
  const { monthlyUsd, annualUsd } = PLANS[plan].prices;
  const usd = interval === 'month' ? monthlyUsd : annualUsd;
  if (usd === null) throw new Error(`${plan} has no ${interval} price`);
  return usd * 100;
}

async function productFor(
  stripe: Stripe,
  plan: PaidPlanName,
): Promise<Stripe.Product> {
  const lookup = `asobeast_${plan}`;
  const existing = await stripe.products.search({
    query: `metadata['asobeast_plan']:'${plan}'`,
    limit: 1,
  });
  if (existing.data[0]) return existing.data[0];

  return stripe.products.create(
    {
      name: `asobeast ${PLANS[plan].displayName}`,
      metadata: { asobeast_plan: plan },
    },
    { idempotencyKey: `product_${lookup}` },
  );
}

async function priceFor(
  stripe: Stripe,
  product: Stripe.Product,
  plan: PaidPlanName,
  interval: BillingInterval,
): Promise<Stripe.Price> {
  const lookupKey = `asobeast_${plan}_${interval}`;
  const existing = await stripe.prices.list({
    lookup_keys: [lookupKey],
    limit: 1,
  });
  if (existing.data[0]) return existing.data[0];

  return stripe.prices.create(
    {
      product: product.id,
      currency: 'usd',
      unit_amount: amountCents(plan, interval),
      recurring: { interval },
      lookup_key: lookupKey,
      metadata: { asobeast_plan: plan },
    },
    { idempotencyKey: `price_${lookupKey}` },
  );
}

async function main(): Promise<void> {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) throw new Error('STRIPE_SECRET_KEY is not set');

  const stripe = new Stripe(secret, { apiVersion: STRIPE_API_VERSION });
  const lines: string[] = [];

  for (const plan of PAID_PLAN_NAMES) {
    const product = await productFor(stripe, plan);
    for (const interval of BILLING_INTERVALS) {
      const price = await priceFor(stripe, product, plan, interval);
      lines.push(`${ENV_KEYS[plan][interval]}=${price.id}`);
    }
  }

  process.stdout.write(`${lines.join('\n')}\n`);
}

main().catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
});
