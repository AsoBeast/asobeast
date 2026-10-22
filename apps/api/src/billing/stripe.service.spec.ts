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

  describe('customerExists', () => {
    const serviceWith = (retrieve: jest.Mock) =>
      new StripeService({ customers: { retrieve } } as unknown as Stripe);

    it('is true for a customer stripe returns', async () => {
      const service = serviceWith(
        jest.fn().mockResolvedValue({ id: 'cus_1', object: 'customer' }),
      );

      await expect(service.customerExists('cus_1')).resolves.toBe(true);
    });

    it('is false for a deleted customer', async () => {
      const service = serviceWith(
        jest.fn().mockResolvedValue({
          id: 'cus_1',
          object: 'customer',
          deleted: true,
        }),
      );

      await expect(service.customerExists('cus_1')).resolves.toBe(false);
    });

    it('is false for a customer stripe has no record of', async () => {
      const service = serviceWith(
        jest.fn().mockRejectedValue(
          Object.assign(new Error('No such customer'), {
            code: 'resource_missing',
            statusCode: 404,
          }),
        ),
      );

      await expect(service.customerExists('cus_1')).resolves.toBe(false);
    });

    it('rethrows any other failure', async () => {
      const down = Object.assign(new Error('connection'), {
        type: 'StripeConnectionError',
      });
      const service = serviceWith(jest.fn().mockRejectedValue(down));

      await expect(service.customerExists('cus_1')).rejects.toBe(down);
    });
  });

  describe('trial calls', () => {
    it('ends a trial now under an idempotency key named after the subscription', async () => {
      const update = jest.fn().mockResolvedValue({ id: 'sub_1' });
      const service = new StripeService({
        subscriptions: { update },
      } as unknown as Stripe);

      await service.endTrialNow('sub_1');

      expect(update).toHaveBeenCalledWith(
        'sub_1',
        { trial_end: 'now' },
        { idempotencyKey: 'trial-end:sub_1' },
      );
    });

    it('reads a payment method by its id', async () => {
      const retrieve = jest.fn().mockResolvedValue({ id: 'pm_1' });
      const service = new StripeService({
        paymentMethods: { retrieve },
      } as unknown as Stripe);

      await expect(service.retrievePaymentMethod('pm_1')).resolves.toEqual({
        id: 'pm_1',
      });
      expect(retrieve).toHaveBeenCalledWith('pm_1');
    });

    it('cancels a subscription at its period end under an idempotency key', async () => {
      const update = jest.fn().mockResolvedValue({ id: 'sub_1' });
      const service = new StripeService({
        subscriptions: { update },
      } as unknown as Stripe);

      await service.cancelAtPeriodEnd('sub_1');

      expect(update).toHaveBeenCalledWith(
        'sub_1',
        { cancel_at_period_end: true },
        { idempotencyKey: 'cancel-at-end:sub_1' },
      );
    });

    it('reads an invoice by its id', async () => {
      const retrieve = jest.fn().mockResolvedValue({ id: 'in_1' });
      const service = new StripeService({
        invoices: { retrieve },
      } as unknown as Stripe);

      await expect(service.retrieveInvoice('in_1')).resolves.toEqual({
        id: 'in_1',
      });
      expect(retrieve).toHaveBeenCalledWith('in_1');
    });

    it('refuses both while billing is not configured', () => {
      const service = new StripeService(createStripeClient(undefined));

      expect(() => service.endTrialNow('sub_1')).toThrow(
        ServiceUnavailableException,
      );
      expect(() => service.retrievePaymentMethod('pm_1')).toThrow(
        ServiceUnavailableException,
      );
    });
  });
});
