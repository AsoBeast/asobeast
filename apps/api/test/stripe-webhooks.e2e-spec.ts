import {
  TEST_STRIPE_SECRET_KEY,
  TEST_STRIPE_WEBHOOK_SECRET,
} from './helpers/enable-stripe';
import { execSync } from 'child_process';
import { readFileSync } from 'fs';
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
import { BillingWebhookService } from '../src/billing/billing-webhook.service';
import {
  STRIPE_API_VERSION,
  STRIPE_CLIENT,
} from '../src/billing/stripe.client';
import { isEntitled } from '../src/auth/entitlement';
import { QUEUES } from '../src/jobs/jobs.types';
import { restoreAuthEnv } from './helpers/auth-env';
import { testDb } from './helpers/test-db';
import { obliterateQueues, pauseQueues } from './obliterate-queues';

const WORKSPACE = 'ws_stripe_fixture';
const CUSTOMER = 'cus_TestWorkspace1';
const SUBSCRIPTION = 'sub_TestIndieMonthly';
const PERIOD_END = new Date(1_802_678_400 * 1000);

const fixtures = join(__dirname, 'fixtures', 'stripe');

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
    subscriptions = new Map();
    const stub = new Stripe(TEST_STRIPE_SECRET_KEY, {
      apiVersion: STRIPE_API_VERSION,
    });
    stub.subscriptions.retrieve = ((id: string) => {
      const found = subscriptions.get(id);
      if (!found) throw new Error(`No such subscription: ${id}`);
      return Promise.resolve(found);
    }) as unknown as typeof stub.subscriptions.retrieve;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(STRIPE_CLIENT)
      .useValue(stub)
      .compile();
    app = moduleFixture.createNestApplication<App>({ rawBody: true });
    await app.init();
    await pauseQueues(app);
    webhook = app.get(BillingWebhookService);

    prisma = testDb();
  }, 60_000);

  beforeEach(async () => {
    await prisma.billingEvent.deleteMany({});
    await prisma.workspace.deleteMany({ where: { id: WORKSPACE } });
    await prisma.workspace.create({
      data: {
        id: WORKSPACE,
        name: 'Stripe fixture',
        plan: 'free',
        billingCustomerId: CUSTOMER,
      },
    });
    subscriptions.clear();
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
    expect(isEntitled(pending, new Date())).toBe(true);
    expect(pending.cancelAtPeriodEnd).toBe(true);

    subscriptions.set(
      SUBSCRIPTION,
      fixture('customer.subscription.deleted').data
        .object as Stripe.Subscription,
    );
    await deliver('customer.subscription.deleted');

    const ended = await workspaceRow();
    expect(isEntitled(ended, new Date())).toBe(false);
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

  it('links a checkout session back to the workspace it references', async () => {
    await deliver('checkout.session.completed');

    await expect(workspaceRow()).resolves.toMatchObject({
      plan: 'indie',
      subscriptionId: SUBSCRIPTION,
    });
  });
});
