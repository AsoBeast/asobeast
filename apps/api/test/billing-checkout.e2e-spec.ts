import './helpers/enable-billing';
import './helpers/enable-stripe';
import type {
  AccountPlan,
  ApiErrorEnvelope,
  AuthUser,
  BillingCatalog,
  BillingSession,
} from '@asobeast/shared';
import request from 'supertest';
import type Stripe from 'stripe';
import {
  ALREADY_SUBSCRIBED,
  CHECKOUT_IN_FLIGHT,
  PAYMENT_PENDING,
  SUBSCRIPTION_NEEDS_ATTENTION,
} from '../src/billing/billing.service';
import { trialSubmitMessage } from '../src/billing/checkout-session';
import { WORKSPACE_METADATA_KEY } from '../src/billing/workspace-link';
import {
  anonymously,
  asMember,
  resetBillingState,
  startBillingHarness,
  stopBillingHarness,
  workspaceRow,
  WORKSPACE,
  type BillingHarness,
} from './helpers/billing-harness';
import { checkoutSession, subscriptionFrom } from './helpers/fake-stripe';
import { OWNER } from './helpers/session';
import { trialClaimKey } from './helpers/trial-claim-key';

const CHECKOUT = '/billing/checkout';
const INDIE_MONTHLY = 'price_TestIndieMonthly';
const ULTIMATE_YEARLY = 'price_TestUltimateYearly';
const STORED_CUSTOMER = 'cus_test_stored';
const WEB = 'https://app.example.test';

describe('Billing checkout (e2e)', () => {
  jest.setTimeout(30_000);

  let harness: BillingHarness;

  const checkout = (priceId: unknown = INDIE_MONTHLY) =>
    harness.owner.post(CHECKOUT).send({ priceId });

  const storeSubscription = async (status: Stripe.Subscription.Status) => {
    await resetBillingState(harness, {
      billingCustomerId: STORED_CUSTOMER,
      subscriptionId: 'sub_live',
      subscriptionStatus: status,
      plan: status === 'active' ? 'indie' : 'free',
    });
    harness.fake.subscriptionStore.set(
      'sub_live',
      subscriptionFrom({
        id: 'sub_live',
        status,
        customer: STORED_CUSTOMER,
        metadata: { [WORKSPACE_METADATA_KEY]: WORKSPACE },
      }),
    );
  };

  beforeAll(async () => {
    harness = await startBillingHarness();
  }, 60_000);

  beforeEach(() => resetBillingState(harness));

  afterAll(() => stopBillingHarness(harness));

  it('opens a subscription checkout that names the workspace everywhere stripe can carry it', async () => {
    const response = await checkout().expect(200);

    const [customer] = harness.fake.createdCustomers;
    const [recorded] = harness.fake.checkoutSessions;
    expect(harness.fake.checkoutSessions).toHaveLength(1);
    expect((response.body as BillingSession).url).toBe(
      `https://checkout.stripe.test/cs_test_2`,
    );
    expect(recorded.params).toMatchObject({
      mode: 'subscription',
      customer: 'cus_test_1',
      line_items: [{ price: INDIE_MONTHLY, quantity: 1 }],
      client_reference_id: WORKSPACE,
      allow_promotion_codes: true,
      subscription_data: {
        metadata: { [WORKSPACE_METADATA_KEY]: WORKSPACE },
      },
    });
    expect(customer.params.metadata).toEqual({
      [WORKSPACE_METADATA_KEY]: WORKSPACE,
    });
    expect(recorded.params).toMatchObject({
      billing_address_collection: 'required',
      tax_id_collection: { enabled: true },
      customer_update: { address: 'auto', name: 'auto' },
      automatic_tax: { enabled: false },
    });
    expect(new URL(recorded.params.success_url ?? '').origin).toBe(WEB);
    expect(new URL(recorded.params.cancel_url ?? '').origin).toBe(WEB);
    expect(recorded.idempotencyKey).toMatch(/^checkout:[^:]+:[0-9a-f-]{36}$/);
    await expect(workspaceRow(harness)).resolves.toMatchObject({
      billingCustomerId: 'cus_test_1',
      checkoutSessionId: 'cs_test_2',
      checkoutClaimedAt: null,
      checkoutClaimToken: null,
    });
  });

  describe('the embedded wall', () => {
    const MARKER = 'checkout=complete&session_id={CHECKOUT_SESSION_ID}';

    it('opens an embedded session for the wall', async () => {
      await resetBillingState(harness, { trialEndsAt: null });
      harness.fake.nextClientSecret = 'cs_test_wall_secret';

      const response = await harness.owner
        .post(CHECKOUT)
        .send({ priceId: INDIE_MONTHLY, ui: 'embedded' })
        .expect(200);

      const [recorded] = harness.fake.checkoutSessions;
      expect(recorded.params).toMatchObject({
        ui_mode: 'embedded_page',
        return_url: `${WEB}/?${MARKER}`,
        subscription_data: { trial_period_days: 7 },
      });
      expect(recorded.params).not.toHaveProperty('success_url');
      expect(recorded.params).not.toHaveProperty('cancel_url');
      expect(response.body as BillingSession).toEqual({
        url: `${WEB}/?${MARKER}`,
        clientSecret: 'cs_test_wall_secret',
      });
    });

    it('keeps the hosted session without ui', async () => {
      const response = await checkout().expect(200);

      expect(harness.fake.checkoutSessions[0].params).not.toHaveProperty(
        'ui_mode',
      );
      expect(response.body as BillingSession).toEqual({
        url: 'https://checkout.stripe.test/cs_test_2',
      });
    });

    it('refuses an unknown ui with 400', async () => {
      await harness.owner
        .post(CHECKOUT)
        .send({ priceId: INDIE_MONTHLY, ui: 'popup' })
        .expect(400);
      expect(harness.fake.checkoutSessions).toHaveLength(0);
    });

    it('names the publishable key on the catalog', async () => {
      const catalog = await harness.owner.get('/billing/catalog').expect(200);

      expect((catalog.body as BillingCatalog).publishableKey).toBe(
        'pk_test_asobeast_e2e',
      );
    });
  });

  describe('the trial offer', () => {
    const TRIAL_KEYS = {
      payment_method_collection: 'always',
      subscription_data: {
        trial_period_days: 7,
        trial_settings: { end_behavior: { missing_payment_method: 'cancel' } },
      },
      custom_text: { submit: { message: trialSubmitMessage(7) } },
    };

    const recordedSession = () => harness.fake.checkoutSessions[0].params;

    it('opens a trial checkout for a fresh owner whose address is unconfirmed', async () => {
      await resetBillingState(harness, { trialEndsAt: null });
      const me = await harness.owner.get('/auth/me').expect(200);
      expect((me.body as AuthUser).emailVerified).toBe(false);

      await checkout().expect(200);

      expect(recordedSession()).toMatchObject(TRIAL_KEYS);
      expect(recordedSession().success_url).toBe(
        `${WEB}/?checkout=complete&session_id={CHECKOUT_SESSION_ID}`,
      );
    });

    it('opens checkout for an unconfirmed owner when the instance sends no confirmation mail', async () => {
      await resetBillingState(harness, { trialEndsAt: null });
      const me = await harness.owner.get('/auth/me').expect(200);
      expect(me.body as AuthUser).toMatchObject({
        emailVerified: false,
        entryStep: 'choose-plan',
      });

      await checkout().expect(200);

      expect(harness.fake.checkoutSessions).toHaveLength(1);
    });

    it('sells at full price and returns to settings without an offer', async () => {
      await checkout().expect(200);

      expect(recordedSession()).not.toHaveProperty('payment_method_collection');
      expect(recordedSession().subscription_data).not.toHaveProperty(
        'trial_period_days',
      );
      expect(recordedSession().success_url).toBe(
        `${WEB}/settings?checkout=complete&session_id={CHECKOUT_SESSION_ID}`,
      );
    });

    it('sells at full price after a trial', async () => {
      await resetBillingState(harness, {
        trialEndsAt: null,
        trialStartedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      });

      await checkout().expect(200);

      expect(recordedSession().subscription_data).not.toHaveProperty(
        'trial_period_days',
      );
    });

    it('sells at full price to a claimed mailbox', async () => {
      await resetBillingState(harness, { trialEndsAt: null });
      await harness.prisma.trialClaim.create({
        data: { key: trialClaimKey(OWNER.email) },
      });

      await checkout().expect(200);

      expect(recordedSession().subscription_data).not.toHaveProperty(
        'trial_period_days',
      );
    });

    it('reports the offer on the plan and the user', async () => {
      await resetBillingState(harness, { trialEndsAt: null });
      const offerOf = async () => ({
        plan: (await harness.owner.get('/auth/plan').expect(200))
          .body as AccountPlan,
        me: (await harness.owner.get('/auth/me').expect(200)).body as AuthUser,
      });

      const offered = await offerOf();
      expect(offered.plan.trialOffer).toEqual({ days: 7 });
      expect(offered.me.trialAwaitsCheckout).toBe(true);

      await resetBillingState(harness, {
        trialEndsAt: null,
        trialStartedAt: new Date(),
      });
      const spent = await offerOf();
      expect(spent.plan.trialOffer).toBeNull();
      expect(spent.me.trialAwaitsCheckout).toBe(false);
    });

    it('offers nothing to a member', async () => {
      await resetBillingState(harness, { trialEndsAt: null });

      const me = await request(harness.app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${harness.memberToken}`)
        .expect(200);

      expect((me.body as AuthUser).trialAwaitsCheckout).toBe(false);
    });
  });

  it('sells a catalogued price of either tier and nothing else', async () => {
    await checkout(ULTIMATE_YEARLY).expect(200);

    const refused = await checkout('price_NotInCatalog').expect(400);
    expect((refused.body as ApiErrorEnvelope).message).toBe(
      'That plan is not for sale on this instance',
    );
    await checkout('').expect(400);
    await checkout(42).expect(400);
    await harness.owner.post(CHECKOUT).send({}).expect(400);
    expect(harness.fake.checkoutSessions).toHaveLength(1);
  });

  it('lets only an owner open checkout, even after the trial has lapsed', async () => {
    await asMember(harness, CHECKOUT)
      .send({ priceId: INDIE_MONTHLY })
      .expect(403);
    await anonymously(harness, CHECKOUT)
      .send({ priceId: INDIE_MONTHLY })
      .expect(401);

    await resetBillingState(harness, {
      trialEndsAt: new Date(Date.now() - 60_000),
    });
    await checkout().expect(200);
  });

  it('throttles an owner to ten checkouts a minute', async () => {
    await resetBillingState(harness, { billingCustomerId: STORED_CUSTOMER });
    for (let attempt = 1; attempt <= 10; attempt += 1) {
      await checkout().expect(200);
    }

    const throttled = await checkout().expect(429);
    expect(throttled.headers['retry-after']).toBeDefined();
  });

  it('sends a workspace that already pays to the portal', async () => {
    await storeSubscription('active');

    const refused = await checkout().expect(409);

    expect(refused.body as ApiErrorEnvelope).toMatchObject({
      message: ALREADY_SUBSCRIBED,
      billing: { reason: 'subscription_exists', recovery: 'portal' },
    });
    expect(harness.fake.checkoutSessions).toHaveLength(0);
  });

  it('sells to a workspace whose customer and subscription belong to another stripe account', async () => {
    await resetBillingState(harness, {
      plan: 'indie',
      billingCustomerId: 'cus_from_another_account',
      subscriptionId: 'sub_from_another_account',
      subscriptionStatus: 'active',
    });
    harness.fake.unknownCustomers.add('cus_from_another_account');

    await checkout().expect(200);

    const [customer] = harness.fake.createdCustomers;
    expect(customer.idempotencyKey).toBe(
      `customer:${WORKSPACE}:replaces:cus_from_another_account`,
    );
    expect(harness.fake.checkoutSessions[0].params.customer).toBe('cus_test_1');
    await expect(workspaceRow(harness)).resolves.toMatchObject({
      billingCustomerId: 'cus_test_1',
      plan: 'free',
      subscriptionId: null,
    });
  });

  it('sends a workspace whose subscription stopped collecting to the portal', async () => {
    await storeSubscription('unpaid');

    const refused = await checkout().expect(409);

    expect(refused.body as ApiErrorEnvelope).toMatchObject({
      message: SUBSCRIPTION_NEEDS_ATTENTION,
      billing: { reason: 'subscription_exists', recovery: 'portal' },
    });
  });

  it('holds a checkout while the first payment is still confirming', async () => {
    await storeSubscription('incomplete');

    const refused = await checkout().expect(409);

    expect(refused.body as ApiErrorEnvelope).toMatchObject({
      message: PAYMENT_PENDING,
      billing: { reason: 'checkout_in_flight', recovery: 'retry' },
    });
    expect(harness.fake.checkoutSessions).toHaveLength(0);
  });

  it('opens one session when two checkouts race', async () => {
    await resetBillingState(harness, { billingCustomerId: STORED_CUSTOMER });
    harness.fake.delayMs = 300;

    const responses = await Promise.all([checkout(), checkout()]);

    expect(responses.map((response) => response.status).sort()).toEqual([
      200, 409,
    ]);
    const refused = responses.find((response) => response.status === 409);
    expect(refused?.body as ApiErrorEnvelope).toMatchObject({
      message: CHECKOUT_IN_FLIGHT,
      billing: { reason: 'checkout_in_flight', recovery: 'retry' },
    });
    expect(harness.fake.checkoutSessions).toHaveLength(1);
  });

  it('ignores a claim older than two minutes', async () => {
    await resetBillingState(harness, {
      checkoutClaimedAt: new Date(Date.now() - 121_000),
      checkoutClaimToken: 'abandoned',
    });

    await checkout().expect(200);
  });

  it('expires an open earlier session before opening another', async () => {
    await resetBillingState(harness, { checkoutSessionId: 'cs_test_open' });
    harness.fake.sessions.set(
      'cs_test_open',
      checkoutSession({ id: 'cs_test_open', status: 'open' }),
    );

    await checkout().expect(200);

    expect(harness.fake.expired).toEqual(['cs_test_open']);
  });

  it('leaves a completed earlier session alone', async () => {
    await resetBillingState(harness, { checkoutSessionId: 'cs_test_done' });
    harness.fake.sessions.set(
      'cs_test_done',
      checkoutSession({ id: 'cs_test_done', status: 'complete' }),
    );

    await checkout().expect(200);

    expect(harness.fake.expired).toEqual([]);
  });

  it('forgets an earlier session stripe no longer knows', async () => {
    await resetBillingState(harness, { checkoutSessionId: 'cs_test_gone' });

    await checkout().expect(200);

    expect(harness.fake.expired).toEqual([]);
    await expect(workspaceRow(harness)).resolves.toMatchObject({
      checkoutSessionId: 'cs_test_2',
    });
  });

  it('releases the claim when stripe fails to open the session', async () => {
    harness.fake.failNext = new Error('stripe is down');

    const failed = await checkout();

    expect(failed.status).toBeGreaterThanOrEqual(500);
    await expect(workspaceRow(harness)).resolves.toMatchObject({
      checkoutClaimedAt: null,
      checkoutClaimToken: null,
    });
    await checkout().expect(200);
  });

  it('releases the claim when stripe answers a session with no url', async () => {
    harness.fake.nextSessionUrl = null;

    await checkout().expect(500);

    await expect(workspaceRow(harness)).resolves.toMatchObject({
      checkoutSessionId: null,
      checkoutClaimedAt: null,
      checkoutClaimToken: null,
    });
  });
});
