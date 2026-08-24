import { ServiceUnavailableException } from '@nestjs/common';
import type Stripe from 'stripe';
import { createStripeClient } from './stripe.client';
import { StripeService } from './stripe.service';

describe('StripeService', () => {
  it('stays inert when no secret key is configured', () => {
    const service = new StripeService(createStripeClient(undefined));

    expect(service.enabled).toBe(false);
    expect(() =>
      service.createCustomer({ email: 'owner@example.com' }, 'key'),
    ).toThrow(ServiceUnavailableException);
  });

  it('constructs a client once a secret key is configured', () => {
    const service = new StripeService(createStripeClient('sk_test_key'));

    expect(service.enabled).toBe(true);
  });

  it('carries an idempotency key on every mutation it makes', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'cus_1' });
    const checkout = jest.fn().mockResolvedValue({ url: 'https://checkout' });
    const portal = jest.fn().mockResolvedValue({ url: 'https://portal' });
    const service = new StripeService({
      customers: { create },
      checkout: { sessions: { create: checkout } },
      billingPortal: { sessions: { create: portal } },
    } as unknown as Stripe);

    await service.createCustomer(
      { email: 'owner@example.com' },
      'customer-key',
    );
    await service.createCheckoutSession(
      { mode: 'subscription' },
      'checkout-key',
    );
    await service.createPortalSession({ customer: 'cus_1' }, 'portal-key');

    expect(create).toHaveBeenCalledWith(expect.anything(), {
      idempotencyKey: 'customer-key',
    });
    expect(checkout).toHaveBeenCalledWith(expect.anything(), {
      idempotencyKey: 'checkout-key',
    });
    expect(portal).toHaveBeenCalledWith(expect.anything(), {
      idempotencyKey: 'portal-key',
    });
  });
});
