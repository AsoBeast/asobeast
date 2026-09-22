import 'dotenv/config';
import type Stripe from 'stripe';
import type { PaidPlanName } from '@asobeast/shared';
import { lookupKeyOf } from '../src/billing/price-catalog';
import { createStripeClient } from '../src/billing/stripe.client';
import { WORKSPACE_METADATA_KEY } from '../src/billing/workspace-link';

const DAY_SECONDS = 86_400;
const CLOCK_READY_TIMEOUT_MS = 60_000;
const CLOCK_POLL_MS = 2_000;
const SANDBOX_KEY_PREFIX = 'sk_test_';
const CARD_THAT_PAYS = 'pm_card_visa';
const CARD_THAT_DECLINES = 'pm_card_chargeCustomerFail';

interface Step {
  days: number;
  before?: () => Promise<unknown>;
  expected: string;
}

interface Simulation {
  clock: Stripe.TestHelpers.TestClock;
  customer: string;
  subscription: Stripe.Subscription;
  expected: string;
  steps: Step[];
}

type Scenario = (stripe: Stripe, workspaceId: string) => Promise<Simulation>;

const scenarios: Record<string, Scenario> = {
  'renewal-succeeds': async (stripe, workspaceId) => ({
    ...(await subscribe(stripe, workspaceId, 'indie')),
    expected: 'indie / active',
    steps: [
      {
        days: 32,
        expected: 'indie / active, planExpiresAt one month later',
      },
    ],
  }),

  'renewal-fails': async (stripe, workspaceId) => {
    const started = await subscribe(stripe, workspaceId, 'indie');
    return {
      ...started,
      expected: 'indie / active',
      steps: [
        {
          days: 32,
          before: () => declineNextCharge(stripe, started.customer),
          expected:
            'indie / past_due, one billing.payment_failed row in AlertDelivery',
        },
        {
          days: 14,
          expected:
            'the end state the dashboard sets for failed payments, unpaid when configured as documented',
        },
      ],
    };
  },

  'downgrade-scheduled': async (stripe, workspaceId) => {
    const started = await subscribe(stripe, workspaceId, 'ultimate');
    await scheduleDowngrade(stripe, started.subscription, 'indie');
    return {
      ...started,
      expected: 'ultimate / active with pendingPlan indie',
      steps: [
        {
          days: 25,
          expected:
            'ultimate / active with pendingPlan indie, a billing.downgrade_warning row when the workspace is over the Indie limits',
        },
        { days: 8, expected: 'indie / active' },
      ],
    };
  },

  'cancel-at-period-end': async (stripe, workspaceId) => {
    const started = await subscribe(stripe, workspaceId, 'indie');
    await stripe.subscriptions.update(started.subscription.id, {
      cancel_at_period_end: true,
    });
    return {
      ...started,
      expected: 'indie / active with cancelAtPeriodEnd',
      steps: [{ days: 32, expected: 'free / canceled' }],
    };
  },
};

async function subscribe(
  stripe: Stripe,
  workspaceId: string,
  plan: PaidPlanName,
): Promise<Omit<Simulation, 'expected' | 'steps'>> {
  const metadata = { [WORKSPACE_METADATA_KEY]: workspaceId };
  const clock = await stripe.testHelpers.testClocks.create({
    frozen_time: Math.floor(Date.now() / 1000),
    name: `asobeast ${plan} for ${workspaceId}`,
  });
  const customer = await stripe.customers.create({
    email: 'simulation@example.com',
    test_clock: clock.id,
    payment_method: CARD_THAT_PAYS,
    invoice_settings: { default_payment_method: CARD_THAT_PAYS },
    metadata,
  });
  const subscription = await stripe.subscriptions.create({
    customer: customer.id,
    items: [{ price: await monthlyPrice(stripe, plan) }],
    metadata,
    billing_mode: { type: 'flexible' },
  });
  return { clock, customer: customer.id, subscription };
}

async function monthlyPrice(
  stripe: Stripe,
  plan: PaidPlanName,
): Promise<string> {
  const lookupKey = lookupKeyOf(plan, 'month');
  const found = await stripe.prices.list({
    lookup_keys: [lookupKey],
    active: true,
    limit: 1,
  });
  const price = found.data[0];
  if (!price) {
    throw new Error(
      `no active price with lookup key ${lookupKey}; run pnpm --filter api stripe:catalog first`,
    );
  }
  return price.id;
}

async function declineNextCharge(
  stripe: Stripe,
  customer: string,
): Promise<void> {
  const card = await stripe.paymentMethods.attach(CARD_THAT_DECLINES, {
    customer,
  });
  await stripe.customers.update(customer, {
    invoice_settings: { default_payment_method: card.id },
  });
}

async function scheduleDowngrade(
  stripe: Stripe,
  subscription: Stripe.Subscription,
  plan: PaidPlanName,
): Promise<void> {
  const schedule = await stripe.subscriptionSchedules.create({
    from_subscription: subscription.id,
  });
  const [current] = schedule.phases;
  await stripe.subscriptionSchedules.update(schedule.id, {
    end_behavior: 'release',
    phases: [
      {
        items: current.items.map((item) => ({
          price: typeof item.price === 'string' ? item.price : item.price.id,
          quantity: item.quantity ?? 1,
        })),
        start_date: current.start_date,
        end_date: current.end_date,
      },
      {
        items: [{ price: await monthlyPrice(stripe, plan), quantity: 1 }],
        duration: { interval: 'month', interval_count: 1 },
      },
    ],
  });
}

async function advance(
  stripe: Stripe,
  clock: Stripe.TestHelpers.TestClock,
  days: number,
): Promise<Stripe.TestHelpers.TestClock> {
  await stripe.testHelpers.testClocks.advance(clock.id, {
    frozen_time: clock.frozen_time + days * DAY_SECONDS,
  });
  const deadline = Date.now() + CLOCK_READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const current = await stripe.testHelpers.testClocks.retrieve(clock.id);
    if (current.status === 'ready') return current;
    await new Promise((resolve) => setTimeout(resolve, CLOCK_POLL_MS));
  }
  throw new Error(
    `test clock ${clock.id} did not settle within ${CLOCK_READY_TIMEOUT_MS / 1000} seconds`,
  );
}

function sandboxClient(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key?.startsWith(SANDBOX_KEY_PREFIX)) {
    throw new Error(
      `stripe:simulate only runs against a sandbox key starting with ${SANDBOX_KEY_PREFIX}`,
    );
  }
  const stripe = createStripeClient(key);
  if (!stripe) throw new Error('STRIPE_SECRET_KEY is not set');
  return stripe;
}

function say(line: string): void {
  process.stdout.write(`${line}\n`);
}

async function run(): Promise<void> {
  const [name, workspaceId] = process.argv.slice(2);
  const cleanup = process.argv.includes('--cleanup');
  const scenario = scenarios[name ?? ''];
  if (!scenario || !workspaceId) {
    throw new Error(
      `usage: stripe:simulate <${Object.keys(scenarios).join('|')}> <workspaceId> [--cleanup]`,
    );
  }

  const stripe = sandboxClient();
  const simulation = await scenario(stripe, workspaceId);
  say(`clock ${simulation.clock.id}`);
  say(`customer ${simulation.customer}`);
  say(`subscription ${simulation.subscription.id}`);
  say(`expect now: ${simulation.expected}`);

  let clock = simulation.clock;
  for (const step of simulation.steps) {
    await step.before?.();
    clock = await advance(stripe, clock, step.days);
    say(`advanced ${step.days} days, expect: ${step.expected}`);
  }

  if (cleanup) {
    await stripe.testHelpers.testClocks.del(clock.id);
    say(`deleted clock ${clock.id} with its customer and subscription`);
    return;
  }
  say(
    `left behind: clock ${clock.id}, customer ${simulation.customer}, subscription ${simulation.subscription.id}; rerun with --cleanup or delete the clock in the dashboard`,
  );
}

run().catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
});
