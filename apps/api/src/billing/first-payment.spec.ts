import type Stripe from 'stripe';
import { PrismaService } from '../prisma/prisma.service';
import { FirstPayment } from './first-payment';
import { StripeService } from './stripe.service';

const PAID_AT = 1_800_000_150;

const invoiceOf = (over: Partial<Stripe.Invoice> = {}) =>
  ({
    id: 'in_1',
    status: 'paid',
    amount_paid: 1000,
    status_transitions: { paid_at: PAID_AT },
    ...over,
  }) as Stripe.Invoice;

const subscriptionOf = (
  latest_invoice: Stripe.Subscription['latest_invoice'] = 'in_1',
  status: Stripe.Subscription.Status = 'active',
) => ({ id: 'sub_1', latest_invoice, status }) as Stripe.Subscription;

describe('FirstPayment', () => {
  const retrieveInvoice = jest.fn<Promise<Stripe.Invoice>, [string]>();
  const updateMany = jest.fn().mockResolvedValue({ count: 1 });
  const payment = () =>
    new FirstPayment(
      { workspace: { updateMany } } as unknown as PrismaService,
      { retrieveInvoice } as unknown as StripeService,
    );
  const unpaid = { id: 'ws_1', firstPaidAt: null };

  beforeEach(() => {
    retrieveInvoice.mockReset().mockResolvedValue(invoiceOf());
    updateMany.mockClear();
  });

  it('reads nothing once the first payment is known', async () => {
    const known = new Date('2026-09-01T00:00:00.000Z');

    await expect(
      payment().record({ id: 'ws_1', firstPaidAt: known }, subscriptionOf()),
    ).resolves.toBe(known);
    expect(retrieveInvoice).not.toHaveBeenCalled();
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('reads nothing for a subscription without an invoice', async () => {
    await expect(payment().record(unpaid, subscriptionOf(null))).resolves.toBe(
      null,
    );
    expect(retrieveInvoice).not.toHaveBeenCalled();
  });

  it.each([
    'trialing',
    'canceled',
    'incomplete',
    'incomplete_expired',
  ] as const)(
    'reads nothing for a %s subscription, which cannot follow a real charge',
    async (status) => {
      await expect(
        payment().record(unpaid, subscriptionOf('in_1', status)),
      ).resolves.toBeNull();
      expect(retrieveInvoice).not.toHaveBeenCalled();
    },
  );

  it('records when a paid invoice above zero was paid', async () => {
    await expect(payment().record(unpaid, subscriptionOf())).resolves.toEqual(
      new Date(PAID_AT * 1000),
    );
    expect(retrieveInvoice).toHaveBeenCalledWith('in_1');
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: 'ws_1', firstPaidAt: null },
      data: { firstPaidAt: new Date(PAID_AT * 1000) },
    });
  });

  it('reads an expanded invoice without fetching it', async () => {
    await payment().record(unpaid, subscriptionOf(invoiceOf()));

    expect(retrieveInvoice).not.toHaveBeenCalled();
    expect(updateMany).toHaveBeenCalled();
  });

  it.each([
    ['the zero trial invoice', { amount_paid: 0 }],
    ['an open invoice', { status: 'open' as const }],
  ])('records nothing for %s', async (_label, over) => {
    retrieveInvoice.mockResolvedValue(invoiceOf(over));

    await expect(payment().record(unpaid, subscriptionOf())).resolves.toBe(
      null,
    );
    expect(updateMany).not.toHaveBeenCalled();
  });
});
