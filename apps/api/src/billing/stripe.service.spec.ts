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

  it('treats a customer stripe no longer has as already deleted', async () => {
    const del = jest.fn().mockRejectedValue(
      Object.assign(new Error('No such customer'), {
        code: 'resource_missing',
      }),
    );
    const service = new StripeService({
      customers: { del },
    } as unknown as Stripe);

    await expect(service.deleteCustomer('cus_gone')).resolves.toBeUndefined();
    expect(del).toHaveBeenCalledWith('cus_gone');
  });

  it('surfaces any other failure to delete a customer', async () => {
    const del = jest.fn().mockRejectedValue(new Error('stripe is down'));
    const service = new StripeService({
      customers: { del },
    } as unknown as Stripe);

    await expect(service.deleteCustomer('cus_1')).rejects.toThrow(
      'stripe is down',
    );
  });
});
