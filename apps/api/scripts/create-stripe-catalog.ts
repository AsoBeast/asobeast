import 'dotenv/config';
import type Stripe from 'stripe';
import {
  BILLING_INTERVALS,
  PAID_PLAN_NAMES,
  PLANS,
  type BillingInterval,
  type PaidPlanName,
} from '@asobeast/shared';
import {
  LEGAL_PRIVACY_URL,
  LEGAL_TERMS_URL,
  SAAS_TAX_CODE,
  configurationCovers,
  portalConfiguration,
  type PortalProduct,
} from '../src/billing/portal-configuration';
import {
  CATALOG_CURRENCY,
  PLAN_METADATA_KEY,
  amountFor,
  chargesListPrice,
  lookupKeyOf,
} from '../src/billing/price-catalog';
import { createStripeClient } from '../src/billing/stripe.client';

const PRICE_TAX_BEHAVIOR = 'exclusive';

const DASHBOARD_CHECKLIST = [
  'Settings, Checkout and Payment Links, Subscriptions: limit customers to one subscription, on',
  'Settings, Billing, Subscriptions and emails: Smart Retries on, then mark the subscription unpaid',
  'Settings, Billing, Subscriptions and emails: emails for failed payments, expiring cards and payments requiring authentication, on with the hosted invoice link',
  'Settings, Billing, Subscriptions and emails: trial end behaviour stays irrelevant, Checkout never starts a Stripe trial',
  'Settings, Payment methods: card, Link, Apple Pay and Google Pay on; SEPA Direct Debit and Cash App Pay off',
  'Settings, Checkout: adaptive pricing off',
  'Settings, Public details: legal name, support email hello@asobeast.dev, terms and privacy urls',
  'Radar: default rules',
  'Developers, Webhooks: one endpoint per environment with the ten handled events on the pinned api version',
];

type Say = (line: string) => void;

async function productFor(
  stripe: Stripe,
  plan: PaidPlanName,
): Promise<Stripe.Product> {
  const lookup = `asobeast_${plan}`;
  const existing = await stripe.products.search({
    query: `metadata['${PLAN_METADATA_KEY}']:'${plan}'`,
    limit: 1,
  });
  if (existing.data[0]) return existing.data[0];

  return stripe.products.create(
    {
      name: `asobeast ${PLANS[plan].displayName}`,
      tax_code: SAAS_TAX_CODE,
      metadata: { [PLAN_METADATA_KEY]: plan },
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
  const lookupKey = lookupKeyOf(plan, interval);
  const existing = await stripe.prices.list({
    lookup_keys: [lookupKey],
    active: true,
    limit: 1,
  });
  const found = existing.data[0];
  if (found && chargesListPrice(found, { plan, interval })) return found;
  if (found) {
    throw new Error(
      `price ${found.id} carries ${lookupKey} but not its list price; archive it or move the lookup key before running this again`,
    );
  }

  return stripe.prices.create(
    {
      product: product.id,
      currency: CATALOG_CURRENCY,
      unit_amount: amountFor(plan, interval) * 100,
      recurring: { interval },
      lookup_key: lookupKey,
      tax_behavior: PRICE_TAX_BEHAVIOR,
      metadata: { [PLAN_METADATA_KEY]: plan },
    },
    { idempotencyKey: `price_${lookupKey}` },
  );
}

async function ensureTaxBehaviour(
  stripe: Stripe,
  price: Stripe.Price,
  say: Say,
): Promise<void> {
  if (price.tax_behavior !== 'unspecified') return;
  await stripe.prices.update(price.id, { tax_behavior: PRICE_TAX_BEHAVIOR });
  say(`updated price ${price.id} to ${PRICE_TAX_BEHAVIOR} tax behaviour`);
}

async function ensureTaxCode(
  stripe: Stripe,
  product: Stripe.Product,
  say: Say,
): Promise<void> {
  const current =
    typeof product.tax_code === 'string'
      ? product.tax_code
      : product.tax_code?.id;
  if (current === SAAS_TAX_CODE) return;
  await stripe.products.update(product.id, { tax_code: SAAS_TAX_CODE });
  say(`updated product ${product.id} to tax code ${SAAS_TAX_CODE}`);
}

async function ensurePortal(
  stripe: Stripe,
  products: PortalProduct[],
  webUrl: string | undefined,
  say: Say,
): Promise<string> {
  if (!webUrl) {
    say('WEB_PUBLIC_URL is empty, so the portal keeps no default return url');
  }
  const desired = portalConfiguration({
    products,
    termsUrl: LEGAL_TERMS_URL,
    privacyUrl: LEGAL_PRIVACY_URL,
    returnUrl: webUrl ? `${webUrl}/settings` : undefined,
  });
  const found = await stripe.billingPortal.configurations.list({
    is_default: true,
    limit: 1,
  });
  const current = found.data[0];
  if (current && configurationCovers(current, desired)) return current.id;

  if (current) {
    await stripe.billingPortal.configurations.update(current.id, desired);
    say(`updated portal configuration ${current.id}`);
    return current.id;
  }
  const created = await stripe.billingPortal.configurations.create(desired);
  say(`created portal configuration ${created.id}`);
  if (!created.is_default) {
    say(`mark portal configuration ${created.id} as default in the dashboard`);
  }
  return created.id;
}

async function main(): Promise<void> {
  const stripe = createStripeClient(process.env.STRIPE_SECRET_KEY);
  if (!stripe) throw new Error('STRIPE_SECRET_KEY is not set');
  const say: Say = (line) => process.stdout.write(`${line}\n`);
  const lines: string[] = [];
  const products: PortalProduct[] = [];

  for (const plan of PAID_PLAN_NAMES) {
    const product = await productFor(stripe, plan);
    await ensureTaxCode(stripe, product, say);
    const prices: string[] = [];
    for (const interval of BILLING_INTERVALS) {
      const price = await priceFor(stripe, product, plan, interval);
      await ensureTaxBehaviour(stripe, price, say);
      prices.push(price.id);
      lines.push(`${lookupKeyOf(plan, interval)} ${price.id}`);
    }
    products.push({ id: product.id, prices });
  }

  const portal = await ensurePortal(
    stripe,
    products,
    process.env.WEB_PUBLIC_URL,
    say,
  );
  say(lines.join('\n'));
  say(`portal configuration ${portal}`);
  say(
    'the api resolves these prices by lookup key; setting STRIPE_PRICE_* replaces the whole catalog with the four ids it names',
  );
  say('\nset these in the dashboard, which the api cannot reach:');
  for (const item of DASHBOARD_CHECKLIST) say(`  [ ] ${item}`);
}

main().catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
});
