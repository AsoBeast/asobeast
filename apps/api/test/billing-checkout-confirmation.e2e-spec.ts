import './helpers/enable-billing';
import './helpers/enable-stripe';
import type { ApiErrorEnvelope, AuthUser } from '@asobeast/shared';
import request from 'supertest';
import { CONFIRM_EMAIL_FIRST } from '../src/billing/billing.service';
import {
  recordingMailer,
  resetBillingState,
  startBillingHarness,
  stopBillingHarness,
  workspaceRow,
  type BillingHarness,
  type RecordingMailer,
} from './helpers/billing-harness';

const CHECKOUT = '/billing/checkout';
const INDIE_MONTHLY = 'price_TestIndieMonthly';
const NEVER_HELD = {
  trialEndsAt: null,
  trialStartedAt: null,
  planExpiresAt: null,
  subscriptionId: null,
};

describe('Billing checkout before the email is confirmed (e2e)', () => {
  jest.setTimeout(30_000);

  let harness: BillingHarness;
  let mailer: RecordingMailer;

  const checkout = () =>
    harness.owner.post(CHECKOUT).send({ priceId: INDIE_MONTHLY });

  const tokenOf = (text: string): string => {
    const token = /token=([0-9a-f]+)/.exec(text)?.[1];
    if (!token) throw new Error('no confirmation token in the mail');
    return token;
  };

  beforeAll(async () => {
    mailer = recordingMailer();
    harness = await startBillingHarness(true, () => undefined, mailer);
  }, 60_000);

  beforeEach(async () => {
    mailer.sent.length = 0;
    await resetBillingState(harness, NEVER_HELD);
    await harness.prisma.user.updateMany({ data: { emailVerifiedAt: null } });
  });

  afterAll(() => stopBillingHarness(harness));

  it('refuses an unconfirmed owner before the lease, the customer or any session', async () => {
    const me = await harness.owner.get('/auth/me').expect(200);
    expect((me.body as AuthUser).entryStep).toBe('confirm-email');

    const refused = await checkout().expect(403);

    expect((refused.body as ApiErrorEnvelope).message).toBe(
      CONFIRM_EMAIL_FIRST,
    );
    expect(harness.fake.checkoutSessions).toHaveLength(0);
    expect(harness.fake.createdCustomers).toHaveLength(0);
    await expect(workspaceRow(harness)).resolves.toMatchObject({
      checkoutClaimedAt: null,
      checkoutClaimToken: null,
      billingCustomerId: null,
    });
  });

  it('opens the checkout once the owner confirmed the address', async () => {
    await harness.owner.post('/auth/verify/resend').expect(204);
    const link = mailer.sent[mailer.sent.length - 1];
    await request(harness.app.getHttpServer())
      .post('/auth/verify')
      .send({ token: tokenOf(link.text) })
      .expect(200);

    const opened = await checkout().expect(200);

    expect(opened.body).toHaveProperty('url');
    expect(harness.fake.checkoutSessions).toHaveLength(1);
  });
});
