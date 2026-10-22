import 'dotenv/config';
import type Stripe from 'stripe';
import type { PaidPlanName } from '@asobeast/shared';
import { lookupKeyOf } from '../src/billing/price-catalog';
import { createStripeClient } from '../src/billing/stripe.client';
import { WORKSPACE_METADATA_KEY } from '../src/billing/workspace-link';

const HOUR = 3_600;
const DAY = 24 * HOUR;
const TRIAL_DAYS = 7;
const CLOCK_READY_TIMEOUT_MS = 60_000;
const CLOCK_POLL_MS = 2_000;
const SANDBOX_KEY_PREFIX = 'sk_test_';
const CARD_THAT_PAYS = 'pm_card_visa';
const CARD_THAT_DECLINES = 'pm_card_chargeCustomerFail';
const TRIAL_CARD = 'pm_card_mastercard';

interface Step {
  seconds: number;
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
        seconds: 32 * DAY,
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
          seconds: 32 * DAY,
          before: () => declineNextCharge(stripe, started.customer),
          expected:
            'indie / past_due, one billing.payment_failed row in AlertDelivery',
        },
        {
          seconds: 14 * DAY,
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
          seconds: 25 * DAY,
          expected:
            'ultimate / active with pendingPlan indie, a billing.downgrade_warning row when the workspace is over the Indie limits',
        },
        { seconds: 8 * DAY, expected: 'indie / active' },
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
      steps: [{ seconds: 32 * DAY, expected: 'free / canceled' }],
    };
  },

  'trial-converts': async (stripe, workspaceId) => ({
    ...(await subscribe(stripe, workspaceId, 'indie', {
      card: TRIAL_CARD,
      trialDays: TRIAL_DAYS,
    })),
    expected:
      'indie / trialing, trialStartedAt and trialEndsAt set, trialClaimedAt set',
    steps: [
      {
        seconds: 4 * DAY,
        expected: 'customer.subscription.trial_will_end applied with no change',
      },
      {
        seconds: 3 * DAY,
        expected:
          'customer.subscription.updated trialing to active; the workspace is active and still unpaid',
      },
      {
        seconds: HOUR,
        expected: "invoice.paid; the workspace's firstPaidAt is set",
      },
    ],
  }),

  'trial-charge-fails': async (stripe, workspaceId) => ({
    ...(await subscribe(stripe, workspaceId, 'indie', {
      card: CARD_THAT_DECLINES,
      trialDays: TRIAL_DAYS,
    })),
    expected: 'indie / trialing',
    steps: [
      {
        seconds: TRIAL_DAYS * DAY,
        expected: 'indie / active, firstPaidAt still null',
      },
      {
        seconds: HOUR,
        expected:
          'invoice.payment_failed, then customer.subscription.updated to past_due; the workspace reads free and stalled, and the trialChargeFailed mail is sent',
      },
      {
        seconds: 14 * DAY,
        expected:
          'the end state the dashboard sets once Smart Retries give up, unpaid when configured as documented',
      },
    ],
  }),

  'trial-cancelled': async (stripe, workspaceId) => {
    const started = await subscribe(stripe, workspaceId, 'indie', {
      card: TRIAL_CARD,
      trialDays: TRIAL_DAYS,
    });
    await stripe.subscriptions.update(started.subscription.id, {
      cancel_at_period_end: true,
    });
    return {
      ...started,
      expected: 'indie / trialing with cancelAtPeriodEnd',
      steps: [
        {
          seconds: TRIAL_DAYS * DAY + HOUR,
          expected:
            'customer.subscription.deleted with nothing invoiced; free, trialEndsAt clamped to the end',
        },
      ],
    };
  },
};

interface Subscribing {
  card: string;
  trialDays?: number;
}

async function subscribe(
  stripe: Stripe,
  workspaceId: string,
  plan: PaidPlanName,
  { card, trialDays }: Subscribing = { card: CARD_THAT_PAYS },
): Promise<Omit<Simulation, 'expected' | 'steps'>> {
  const metadata = { [WORKSPACE_METADATA_KEY]: workspaceId };
  const clock = await stripe.testHelpers.testClocks.create({
    frozen_time: Math.floor(Date.now() / 1000),
    name: `asobeast ${plan} for ${workspaceId}`,
  });
  const customer = await stripe.customers.create({
    email: 'simulation@example.com',
    test_clock: clock.id,
    payment_method: card,
    invoice_settings: { default_payment_method: card },
    metadata,
  });
  const subscription = await stripe.subscriptions.create({
    customer: customer.id,
    items: [{ price: await monthlyPrice(stripe, plan) }],
    metadata,
    billing_mode: { type: 'flexible' },
    ...(trialDays ? { trial_period_days: trialDays } : {}),
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
  seconds: number,
): Promise<Stripe.TestHelpers.TestClock> {
  await stripe.testHelpers.testClocks.advance(clock.id, {
    frozen_time: clock.frozen_time + seconds,
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

function describeSpan(seconds: number): string {
  const days = Math.floor(seconds / DAY);
  const hours = Math.round((seconds % DAY) / HOUR);
  return [unitsOf(days, 'day'), unitsOf(hours, 'hour')]
    .filter(Boolean)
    .join(' ');
}

function unitsOf(count: number, unit: string): string {
  if (count === 0) return '';
  return `${count} ${unit}${count === 1 ? '' : 's'}`;
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
    clock = await advance(stripe, clock, step.seconds);
    say(`advanced ${describeSpan(step.seconds)}, expect: ${step.expected}`);
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
