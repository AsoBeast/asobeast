import {
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import Stripe from 'stripe';
import { STRIPE_CLIENT, type StripeClient } from './stripe.client';

@Injectable()
export class StripeService {
  constructor(@Inject(STRIPE_CLIENT) private readonly client: StripeClient) {}

  get enabled(): boolean {
    return this.client !== null;
  }

  private get stripe(): Stripe {
    if (!this.client) {
      throw new ServiceUnavailableException('Billing is not configured');
    }
    return this.client;
  }

  createCustomer(
    params: Stripe.CustomerCreateParams,
    idempotencyKey: string,
  ): Promise<Stripe.Customer> {
    return this.stripe.customers.create(params, { idempotencyKey });
  }

  createCheckoutSession(
    params: Stripe.Checkout.SessionCreateParams,
    idempotencyKey: string,
  ): Promise<Stripe.Checkout.Session> {
    return this.stripe.checkout.sessions.create(params, { idempotencyKey });
  }

  retrieveCheckoutSession(id: string): Promise<Stripe.Checkout.Session> {
    return this.stripe.checkout.sessions.retrieve(id);
  }

  expireCheckoutSession(id: string): Promise<Stripe.Checkout.Session> {
    return this.stripe.checkout.sessions.expire(id);
  }

  listCustomerSubscriptions(customer: string): Promise<Stripe.Subscription[]> {
    return this.stripe.subscriptions
      .list({ customer, status: 'all', limit: 100 })
      .then((page) => page.data);
  }

  createPortalSession(
    params: Stripe.BillingPortal.SessionCreateParams,
    idempotencyKey: string,
  ): Promise<Stripe.BillingPortal.Session> {
    return this.stripe.billingPortal.sessions.create(params, {
      idempotencyKey,
    });
  }

  retrieveSchedule(id: string): Promise<Stripe.SubscriptionSchedule> {
    return this.stripe.subscriptionSchedules.retrieve(id);
  }

  retrieveSubscription(id: string): Promise<Stripe.Subscription> {
    return this.stripe.subscriptions.retrieve(id);
  }

  listActiveSubscriptions(): AsyncIterable<Stripe.Subscription> {
    return this.stripe.subscriptions.list({ status: 'all', limit: 100 });
  }

  constructEvent(
    payload: Buffer,
    signature: string,
    secret: string,
  ): Stripe.Event {
    return this.stripe.webhooks.constructEvent(payload, signature, secret);
  }
}
