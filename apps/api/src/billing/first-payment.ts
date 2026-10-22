import { Injectable } from '@nestjs/common';
import type Stripe from 'stripe';
import { PrismaService } from '../prisma/prisma.service';
import { isMissingResource } from './stripe-errors';
import { StripeService } from './stripe.service';

const AFTER_A_CHARGE = new Set<Stripe.Subscription.Status>([
  'active',
  'past_due',
  'unpaid',
  'paused',
]);

export interface PaymentHistory {
  id: string;
  firstPaidAt: Date | null;
}

@Injectable()
export class FirstPayment {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stripe: StripeService,
  ) {}

  async record(
    workspace: PaymentHistory,
    subscription: Stripe.Subscription,
  ): Promise<Date | null> {
    if (workspace.firstPaidAt) return workspace.firstPaidAt;
    if (!AFTER_A_CHARGE.has(subscription.status)) return null;
    const invoice = await this.latestInvoice(subscription);
    if (invoice?.status !== 'paid' || invoice.amount_paid <= 0) return null;

    const paidAt = paidAtOf(invoice);
    await this.prisma.workspace.updateMany({
      where: { id: workspace.id, firstPaidAt: null },
      data: { firstPaidAt: paidAt },
    });
    return paidAt;
  }

  private latestInvoice(
    subscription: Stripe.Subscription,
  ): Promise<Stripe.Invoice | null> {
    const invoice = subscription.latest_invoice;
    if (!invoice) return Promise.resolve(null);
    if (typeof invoice !== 'string') return Promise.resolve(invoice);
    return this.stripe.retrieveInvoice(invoice).catch((error: unknown) => {
      if (isMissingResource(error)) return null;
      throw error;
    });
  }
}

function paidAtOf(invoice: Stripe.Invoice): Date {
  const seconds = invoice.status_transitions?.paid_at;
  return seconds ? new Date(seconds * 1000) : new Date();
}
