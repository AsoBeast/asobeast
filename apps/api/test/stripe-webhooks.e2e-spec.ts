import {
  TEST_STRIPE_SECRET_KEY,
  TEST_STRIPE_WEBHOOK_SECRET,
} from './helpers/enable-stripe';
import { execSync } from 'child_process';
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { PrismaClient } from '@prisma/client';
import { Queue } from 'bullmq';
import Stripe from 'stripe';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { BillingReconciler } from '../src/billing/billing-reconciler.service';
import { BillingWebhookService } from '../src/billing/billing-webhook.service';
import { HANDLED_EVENTS } from '../src/billing/webhook-events';
import { WORKSPACE_METADATA_KEY } from '../src/billing/workspace-link';
import {
  STRIPE_API_VERSION,
  STRIPE_CLIENT,
} from '../src/billing/stripe.client';
import type { AuthUser } from '@asobeast/shared';
import { isEntitled } from '../src/auth/entitlement';
import { sha256 } from '../src/auth/password-hash';
import { QUEUES } from '../src/jobs/jobs.types';
import { restoreAuthEnv } from './helpers/auth-env';
import {
  fakeStripe,
  fixtureInvoice,
  paymentMethod,
  type FakeStripe,
} from './helpers/fake-stripe';
import { cardClaimKey, trialClaimKey } from './helpers/trial-claim-key';
import { testDb } from './helpers/test-db';
import { obliterateQueues, pauseQueues } from './obliterate-queues';

const WORKSPACE = 'ws_stripe_fixture';
const CUSTOMER = 'cus_TestWorkspace1';
const SUBSCRIPTION = 'sub_TestIndieMonthly';
const PERIOD_END = new Date(1_802_678_400 * 1000);
const BEFORE_PERIOD_END = new Date(PERIOD_END.getTime() - 60_000);

const fixtures = join(__dirname, 'fixtures', 'stripe');

const PERSONAL_DATA =
  /"line1":\s*"|"client_secret":\s*"|_secret_[A-Za-z0-9]|invoice\.stripe\.com/;

const UNSCRUBBED_ID =
  /\b(?!sub_sched_Test)(cus|sub|in|price|prod|pi|ch|pm|cs|evt|si|il|bps|acct)_(?:(?:test|live)_)?(?!Test)[A-Za-z0-9]{14,}\b/;

function fixture(name: string): Stripe.Event {
  return JSON.parse(
    readFileSync(join(fixtures, `${name}.json`), 'utf8'),
  ) as Stripe.Event;
}

describe('Stripe webhooks', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let signer: Stripe;
  let webhook: BillingWebhookService;
  let fake: FakeStripe;
  let subscriptions: Map<string, Stripe.Subscription>;

  const send = (event: Stripe.Event, signature?: string) => {
    const payload = JSON.stringify(event);
    return request(app.getHttpServer())
      .post('/billing/webhook')
      .set(
        'stripe-signature',
        signature ??
          signer.webhooks.generateTestHeaderString({
            payload,
            secret: TEST_STRIPE_WEBHOOK_SECRET,
          }),
      )
      .set('Content-Type', 'application/json')
      .send(payload);
  };

  const deliver = async (name: string) => {
    const event = fixture(name);
    const response = await send(event).expect(200);
    await webhook.process(event.id);
    return response;
  };

  const workspaceRow = () =>
    prisma.workspace.findUniqueOrThrow({ where: { id: WORKSPACE } });

  beforeAll(async () => {
    execSync('pnpm prisma migrate deploy', {
      cwd: join(__dirname, '..'),
      env: process.env,
      stdio: 'ignore',
    });

    signer = new Stripe(TEST_STRIPE_SECRET_KEY, {
      apiVersion: STRIPE_API_VERSION,
    });
    fake = fakeStripe();
    subscriptions = fake.subscriptionStore;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(STRIPE_CLIENT)
      .useValue(fake)
      .compile();
    app = moduleFixture.createNestApplication<App>({ rawBody: true });
    await app.init();
    await pauseQueues(app);
    webhook = app.get(BillingWebhookService);

    prisma = testDb();
  }, 60_000);

  beforeEach(async () => {
    await prisma.billingEvent.deleteMany({});
    await prisma.user.deleteMany({ where: { workspaceId: WORKSPACE } });
    await prisma.workspace.deleteMany({ where: { id: WORKSPACE } });
    await prisma.workspace.create({
      data: {
        id: WORKSPACE,
        name: 'Stripe fixture',
        plan: 'free',
        billingCustomerId: CUSTOMER,
        firstPaidAt: new Date('2026-09-01T00:00:00.000Z'),
      },
    });
    fake.reset();
    subscriptions.set(
      SUBSCRIPTION,
      fixture('customer.subscription.created').data
        .object as Stripe.Subscription,
    );
  });

  afterAll(async () => {
    await prisma.billingEvent.deleteMany({});
    await prisma.workspace.deleteMany({ where: { id: WORKSPACE } });
    await obliterateQueues(app);
    await app.close();
    restoreAuthEnv();
    await prisma.$disconnect();
  });

  it('refuses a payload whose signature does not verify', async () => {
    await send(
      fixture('customer.subscription.created'),
      't=1,v1=forged',
    ).expect(400);

    await expect(prisma.billingEvent.count()).resolves.toBe(0);
  });

  it('refuses a delivery with no signature header at all', async () => {
    const event = fixture('customer.subscription.created');
    await request(app.getHttpServer())
      .post('/billing/webhook')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify(event))
      .expect(400);
  });

  it('provisions the plan a verified subscription names', async () => {
    await deliver('customer.subscription.created');

    await expect(workspaceRow()).resolves.toMatchObject({
      plan: 'indie',
      subscriptionId: SUBSCRIPTION,
      subscriptionStatus: 'active',
      planExpiresAt: PERIOD_END,
      billingCustomerId: CUSTOMER,
      cancelAtPeriodEnd: false,
    });
  });

  it('records every delivery it accepts exactly once', async () => {
    const event = fixture('customer.subscription.created');
    await send(event).expect(200);
    await send(event).expect(200);

    await expect(
      prisma.billingEvent.count({ where: { id: event.id } }),
    ).resolves.toBe(1);
  });

  it('queues the first delivery for processing and never the replay', async () => {
    const queue = app.get<Queue>(getQueueToken(QUEUES.BILLING), {
      strict: false,
    });
    await queue.drain(true);
    const event = fixture('customer.subscription.created');

    await send(event).expect(200);
    await send(event).expect(200);

    const queued = await queue.getJobs(['waiting', 'delayed', 'paused']);
    expect(
      queued.filter((job) => job.id === `billing~${event.id}`),
    ).toHaveLength(1);
  });

  it('queues the replay when the first delivery was recorded but never scheduled', async () => {
    const queue = app.get<Queue>(getQueueToken(QUEUES.BILLING), {
      strict: false,
    });
    await queue.drain(true);
    const event = fixture('customer.subscription.created');
    const add = jest
      .spyOn(queue, 'add')
      .mockRejectedValueOnce(new Error('redis is unreachable'));

    const scheduled = async () =>
      (await queue.getJobs(['waiting', 'delayed', 'paused'])).filter(
        (job) => job.id === `billing~${event.id}`,
      );

    await send(event).expect(500);
    await expect(
      prisma.billingEvent.count({ where: { id: event.id } }),
    ).resolves.toBe(1);
    await expect(scheduled()).resolves.toHaveLength(0);

    await send(event).expect(200);

    await expect(scheduled()).resolves.toHaveLength(1);
    add.mockRestore();
  });

  it('applies a replayed delivery only once', async () => {
    await deliver('customer.subscription.created');
    await prisma.workspace.update({
      where: { id: WORKSPACE },
      data: { plan: 'ultimate' },
    });

    await deliver('customer.subscription.created');

    await expect(workspaceRow()).resolves.toMatchObject({ plan: 'ultimate' });
  });

  it('upgrades the plan when the subscription moves to a larger price', async () => {
    await deliver('customer.subscription.created');
    subscriptions.set(
      SUBSCRIPTION,
      fixture('customer.subscription.updated').data
        .object as Stripe.Subscription,
    );

    await deliver('customer.subscription.updated');

    await expect(workspaceRow()).resolves.toMatchObject({ plan: 'ultimate' });
  });

  it('ignores an event that arrives after a newer one already applied', async () => {
    subscriptions.set(
      SUBSCRIPTION,
      fixture('customer.subscription.updated').data
        .object as Stripe.Subscription,
    );
    await deliver('customer.subscription.updated');

    subscriptions.set(
      SUBSCRIPTION,
      fixture('customer.subscription.created').data
        .object as Stripe.Subscription,
    );
    await deliver('customer.subscription.created');

    await expect(workspaceRow()).resolves.toMatchObject({ plan: 'ultimate' });
  });

  it('keeps a past_due subscription entitled through dunning', async () => {
    subscriptions.set(
      SUBSCRIPTION,
      fixture('customer.subscription.past_due').data
        .object as Stripe.Subscription,
    );

    await deliver('customer.subscription.past_due');

    await expect(workspaceRow()).resolves.toMatchObject({
      plan: 'indie',
      subscriptionStatus: 'past_due',
    });
  });

  it('keeps access to the period end when a cancellation is pending', async () => {
    subscriptions.set(
      SUBSCRIPTION,
      fixture('customer.subscription.cancel_pending').data
        .object as Stripe.Subscription,
    );

    await deliver('customer.subscription.cancel_pending');

    await expect(workspaceRow()).resolves.toMatchObject({
      plan: 'indie',
      cancelAtPeriodEnd: true,
      planExpiresAt: PERIOD_END,
    });
  });

  it('revokes the plan once the subscription is deleted', async () => {
    await deliver('customer.subscription.created');
    subscriptions.set(
      SUBSCRIPTION,
      fixture('customer.subscription.deleted').data
        .object as Stripe.Subscription,
    );

    await deliver('customer.subscription.deleted');

    await expect(workspaceRow()).resolves.toMatchObject({
      plan: 'free',
      subscriptionStatus: 'canceled',
    });
  });

  it('provisions from an invoice that names its subscription through the parent', async () => {
    await deliver('invoice.paid');

    await expect(workspaceRow()).resolves.toMatchObject({
      plan: 'indie',
      planExpiresAt: PERIOD_END,
    });
  });

  it('leaves a failed payment entitled rather than revoking on the first decline', async () => {
    await deliver('customer.subscription.created');
    subscriptions.set(
      SUBSCRIPTION,
      fixture('customer.subscription.past_due').data
        .object as Stripe.Subscription,
    );

    await deliver('invoice.payment_failed');

    await expect(workspaceRow()).resolves.toMatchObject({
      plan: 'indie',
      subscriptionStatus: 'past_due',
    });
  });

  it('records the dunning warning once and clears it on recovery', async () => {
    subscriptions.set(
      SUBSCRIPTION,
      fixture('customer.subscription.past_due').data
        .object as Stripe.Subscription,
    );
    await deliver('customer.subscription.past_due');

    const warned = await workspaceRow();
    expect(warned.dunningNotifiedAt).not.toBeNull();
    expect(warned.plan).toBe('indie');

    subscriptions.set(
      SUBSCRIPTION,
      fixture('customer.subscription.created').data
        .object as Stripe.Subscription,
    );
    await deliver('invoice.paid');

    await expect(workspaceRow()).resolves.toMatchObject({
      dunningNotifiedAt: null,
      subscriptionStatus: 'active',
    });
  });

  it('acknowledges an event type it does not act on and changes nothing', async () => {
    const response = await deliver('customer.discount.created');

    expect(response.body).toEqual({ received: true });
    await expect(workspaceRow()).resolves.toMatchObject({ plan: 'free' });
    await expect(
      prisma.billingEvent.findUniqueOrThrow({
        where: { id: 'evt_TestDiscountCreated' },
      }),
    ).resolves.toMatchObject({ failure: null });
  });

  it('converts a trial to paid without granting a second trial', async () => {
    const trialEndsAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    await prisma.workspace.update({
      where: { id: WORKSPACE },
      data: {
        plan: 'trial',
        trialStartedAt: new Date(),
        trialEndsAt,
        overLimitSince: new Date(),
        overLimitNotifiedAt: new Date(),
      },
    });

    await deliver('customer.subscription.created');

    await expect(workspaceRow()).resolves.toMatchObject({
      plan: 'indie',
      trialEndsAt,
      overLimitSince: null,
      overLimitNotifiedAt: null,
    });
  });

  it('keeps a cancelled customer entitled until the period actually ends', async () => {
    subscriptions.set(
      SUBSCRIPTION,
      fixture('customer.subscription.cancel_pending').data
        .object as Stripe.Subscription,
    );
    await deliver('customer.subscription.cancel_pending');

    const pending = await workspaceRow();
    expect(isEntitled(pending, BEFORE_PERIOD_END)).toBe(true);
    expect(pending.cancelAtPeriodEnd).toBe(true);

    subscriptions.set(
      SUBSCRIPTION,
      fixture('customer.subscription.deleted').data
        .object as Stripe.Subscription,
    );
    await deliver('customer.subscription.deleted');

    const ended = await workspaceRow();
    expect(isEntitled(ended, BEFORE_PERIOD_END)).toBe(false);
    expect(ended.trialStartedAt).toBeNull();
  });

  it('restores a returning customer without handing out a second trial', async () => {
    await prisma.workspace.update({
      where: { id: WORKSPACE },
      data: {
        plan: 'free',
        trialStartedAt: new Date('2026-01-01T00:00:00.000Z'),
        trialEndsAt: new Date('2026-01-08T00:00:00.000Z'),
        subscriptionStatus: 'canceled',
      },
    });

    await deliver('customer.subscription.created');

    const restored = await workspaceRow();
    expect(restored.plan).toBe('indie');
    expect(restored.trialStartedAt).toEqual(
      new Date('2026-01-01T00:00:00.000Z'),
    );
    expect(restored.trialEndsAt).toEqual(new Date('2026-01-08T00:00:00.000Z'));
  });

  describe('a card trial', () => {
    const TRIAL_START = new Date(1_800_000_150 * 1000);
    const TRIAL_END = new Date(1_800_604_950 * 1000);
    const OWNER_TOKEN = `asob_${'trialowner'.padEnd(48, '5')}`;

    const subscriptionOf = (name: string) =>
      fixture(name).data.object as Stripe.Subscription;

    const project = async (name: string) => {
      subscriptions.set(SUBSCRIPTION, subscriptionOf(name));
      await deliver(name);
    };

    const me = async () => {
      const response = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${OWNER_TOKEN}`)
        .expect(200);
      return response.body as AuthUser;
    };

    const OWNER_MAILBOX = trialClaimKey('trial-owner@example.com');
    const CARD = cardClaimKey('fp_TestCard');

    const claimKeys = async () =>
      (await prisma.trialClaim.findMany({ select: { key: true } }))
        .map(({ key }) => key)
        .sort();

    beforeEach(async () => {
      await prisma.$executeRawUnsafe('TRUNCATE TABLE "TrialClaim"');
      await prisma.workspace.update({
        where: { id: WORKSPACE },
        data: { firstPaidAt: null },
      });
      fake.invoiceStore.set('in_TestTrial', fixtureInvoice('invoice.trial'));
      fake.paymentMethodStore.set(
        'pm_TestCard',
        paymentMethod({
          card: { fingerprint: 'fp_TestCard' } as Stripe.PaymentMethod.Card,
        }),
      );
      const owner = await prisma.user.create({
        data: {
          workspaceId: WORKSPACE,
          email: 'trial-owner@example.com',
          passwordHash: 'password-login-unused',
          role: 'owner',
        },
      });
      await prisma.apiToken.create({
        data: {
          userId: owner.id,
          name: 'trial e2e',
          tokenHash: sha256(OWNER_TOKEN),
          prefix: OWNER_TOKEN.slice(0, 12),
        },
      });
    });

    it('projects the trial dates, the interval and the trialing state', async () => {
      await project('customer.subscription.trialing');

      await expect(workspaceRow()).resolves.toMatchObject({
        plan: 'indie',
        subscriptionStatus: 'trialing',
        planExpiresAt: TRIAL_END,
        trialStartedAt: TRIAL_START,
        trialEndsAt: TRIAL_END,
        billingInterval: 'month',
      });
      await expect(me()).resolves.toMatchObject({
        entitled: true,
        trialing: true,
        trialAwaitsCheckout: false,
      });
    });

    it('claims the mailbox and the card of the first trial', async () => {
      await project('customer.subscription.trialing');

      await expect(claimKeys()).resolves.toEqual([OWNER_MAILBOX, CARD].sort());
      expect((await workspaceRow()).trialClaimedAt).not.toBeNull();
      expect(fake.subscriptionUpdates).toEqual([]);
    });

    it.each([
      ['mailbox', OWNER_MAILBOX],
      ['card', CARD],
    ])('ends a second trial of the same %s at stripe', async (_claim, key) => {
      await prisma.trialClaim.create({ data: { key } });

      await project('customer.subscription.trialing');

      expect(fake.subscriptionUpdates).toEqual([
        {
          params: { id: SUBSCRIPTION, trial_end: 'now' },
          idempotencyKey: `trial-end:${SUBSCRIPTION}`,
        },
      ]);
      expect((await workspaceRow()).trialClaimedAt).not.toBeNull();
      expect(subscriptions.get(SUBSCRIPTION)?.status).toBe('active');
    });

    it('settles the claims once when the reconcile lands before the webhook', async () => {
      subscriptions.set(
        SUBSCRIPTION,
        subscriptionOf('customer.subscription.trialing'),
      );

      await app.get(BillingReconciler).reconcileOne(WORKSPACE);
      const settledAt = (await workspaceRow()).trialClaimedAt;
      await deliver('customer.subscription.trialing');

      expect(settledAt).not.toBeNull();
      expect((await workspaceRow()).trialClaimedAt).toEqual(settledAt);
      await expect(claimKeys()).resolves.toEqual([OWNER_MAILBOX, CARD].sort());
      expect(fake.subscriptionUpdates).toEqual([]);
    });

    it('settles the claims once when the reconcile and the webhook race', async () => {
      const event = fixture('customer.subscription.trialing');
      subscriptions.set(
        SUBSCRIPTION,
        subscriptionOf('customer.subscription.trialing'),
      );
      await send(event).expect(200);

      await Promise.all([
        app.get(BillingReconciler).reconcileOne(WORKSPACE),
        webhook.process(event.id),
      ]);

      await expect(claimKeys()).resolves.toEqual([OWNER_MAILBOX, CARD].sort());
      expect((await workspaceRow()).trialClaimedAt).not.toBeNull();
      expect(fake.subscriptionUpdates).toEqual([]);
    });

    it('records no payment for the zero trial invoice', async () => {
      await project('customer.subscription.trialing');

      expect((await workspaceRow()).firstPaidAt).toBeNull();
    });

    it('pauses a trial whose first charge failed until a charge goes through', async () => {
      const declinedMail = () =>
        prisma.alertDelivery.count({
          where: { event: 'billing.trial_charge_failed' },
        });
      const mailedBefore = await declinedMail();
      await project('customer.subscription.trialing');
      fake.invoiceStore.set(
        'in_TestDeclined',
        fixtureInvoice('invoice.paid', {
          id: 'in_TestDeclined',
          status: 'open',
          amount_paid: 0,
        }),
      );
      const trial = subscriptionOf('customer.subscription.trialing');
      subscriptions.set(SUBSCRIPTION, {
        ...subscriptionOf('customer.subscription.past_due'),
        trial_start: trial.trial_start,
        trial_end: trial.trial_end,
        latest_invoice: 'in_TestDeclined',
      });
      await deliver('customer.subscription.past_due');

      await expect(workspaceRow()).resolves.toMatchObject({
        plan: 'free',
        subscriptionStatus: 'past_due',
        firstPaidAt: null,
      });
      const plan = await request(app.getHttpServer())
        .get('/auth/plan')
        .set('Authorization', `Bearer ${OWNER_TOKEN}`)
        .expect(200);
      expect(plan.body).toMatchObject({
        entitled: false,
        subscriptionStalled: true,
      });
      await request(app.getHttpServer())
        .post('/apps')
        .set('Authorization', `Bearer ${OWNER_TOKEN}`)
        .send({ url: 'https://apps.apple.com/us/app/new/id999' })
        .expect(402);
      await expect(declinedMail()).resolves.toBe(mailedBefore + 1);

      fake.invoiceStore.set(
        'in_TestDeclined',
        fixtureInvoice('invoice.paid', {
          id: 'in_TestDeclined',
          status: 'paid',
          amount_paid: 1000,
        }),
      );
      subscriptions.set(SUBSCRIPTION, {
        ...subscriptionOf('customer.subscription.created'),
        latest_invoice: 'in_TestDeclined',
      });
      await deliver('invoice.paid');

      const recovered = await workspaceRow();
      expect(recovered.plan).toBe('indie');
      expect(recovered.firstPaidAt).not.toBeNull();
      expect(recovered.dunningNotifiedAt).toBeNull();
    });

    it('records a payment from an event older than the state', async () => {
      await prisma.workspace.update({
        where: { id: WORKSPACE },
        data: { subscriptionEventAt: new Date(1_900_000_000 * 1000) },
      });
      fake.invoiceStore.set('in_Test1', fixtureInvoice('invoice.paid'));
      subscriptions.set(
        SUBSCRIPTION,
        subscriptionOf('customer.subscription.created'),
      );

      const event = fixture('invoice.paid');
      await send(event).expect(200);
      await webhook.process(event.id);

      await expect(
        prisma.billingEvent.findUniqueOrThrow({ where: { id: event.id } }),
      ).resolves.toMatchObject({ outcome: 'ignored' });
      expect((await workspaceRow()).firstPaidAt).not.toBeNull();
    });

    it('keeps the trial dates when the trial converts', async () => {
      await project('customer.subscription.trialing');

      await project('customer.subscription.updated');

      const converted = await workspaceRow();
      expect(converted).toMatchObject({
        subscriptionStatus: 'active',
        trialStartedAt: TRIAL_START,
        trialEndsAt: TRIAL_END,
      });
      expect(converted.planExpiresAt).not.toEqual(TRIAL_END);
      await expect(me()).resolves.toMatchObject({ trialing: false });
    });

    it('clamps a cancelled trial so the legacy trial never revives it', async () => {
      await project('customer.subscription.trialing');

      await project('customer.subscription.trial_canceled');

      const cancelled = await workspaceRow();
      expect(cancelled.plan).toBe('free');
      expect(cancelled.trialEndsAt!.getTime()).toBeLessThanOrEqual(Date.now());
      expect(cancelled.trialStartedAt).toEqual(TRIAL_START);
      await expect(me()).resolves.toMatchObject({ entitled: false });
    });
  });

  it('links a checkout session back to the workspace it references', async () => {
    await deliver('checkout.session.completed');

    await expect(workspaceRow()).resolves.toMatchObject({
      plan: 'indie',
      subscriptionId: SUBSCRIPTION,
    });
  });

  it('settles a delivery for a workspace this instance never had', async () => {
    const event = fixture('customer.subscription.created');
    const subscription = event.data.object as Stripe.Subscription;
    subscription.metadata = { [WORKSPACE_METADATA_KEY]: 'ws_nobody' };
    subscriptions.set(SUBSCRIPTION, subscription);

    await send(event).expect(200);
    await expect(webhook.process(event.id)).resolves.toBeUndefined();

    const stored = await prisma.billingEvent.findUniqueOrThrow({
      where: { id: event.id },
    });
    expect(stored.outcome).toBe('orphaned');
    expect(stored.processedAt).not.toBeNull();
    expect(stored.failure).toBeNull();
    expect((await workspaceRow()).plan).toBe('free');
  });

  it('keeps every fixture on the pinned version, in the sandbox and scrubbed', () => {
    const files = readdirSync(fixtures).filter((file) =>
      file.endsWith('.json'),
    );
    const types = new Set<string>();

    for (const file of files) {
      const text = readFileSync(join(fixtures, file), 'utf8');
      const event = JSON.parse(text) as Stripe.Event;
      types.add(event.type);
      expect({ file, version: event.api_version }).toEqual({
        file,
        version: STRIPE_API_VERSION,
      });
      expect({ file, livemode: event.livemode }).toEqual({
        file,
        livemode: false,
      });
      expect({ file, unscrubbed: UNSCRUBBED_ID.exec(text)?.[0] }).toEqual({
        file,
        unscrubbed: undefined,
      });
      expect({ file, personal: PERSONAL_DATA.exec(text)?.[0] }).toEqual({
        file,
        personal: undefined,
      });
    }
    expect(HANDLED_EVENTS.filter((type) => !types.has(type))).toEqual([]);
  });

  it('renames sandbox ids and keeps field names that share their prefix', () => {
    const captured = {
      id: 'evt_1QaBcDeFgHiJkLmNoPqRsTu',
      livemode: false,
      data: {
        object: {
          id: 'in_1QaBcDeFgHiJkLmNoPqRsTu',
          pricing: {
            type: 'price_details',
            price_details: {
              price: 'price_1QaBcDeFgHiJkLmNoPqRsTu',
              product: 'prod_QaBcDeFgHiJkLm',
            },
          },
        },
      },
    };

    const scrubbed = execSync(`node ${join(fixtures, 'scrub.mjs')}`, {
      input: JSON.stringify(captured),
    }).toString();

    expect(JSON.parse(scrubbed)).toEqual({
      id: 'evt_Test1',
      livemode: false,
      data: {
        object: {
          id: 'in_Test1',
          pricing: {
            type: 'price_details',
            price_details: { price: 'price_Test1', product: 'prod_Test1' },
          },
        },
      },
    });
    expect(UNSCRUBBED_ID.exec(scrubbed)?.[0]).toBeUndefined();
  });
});
