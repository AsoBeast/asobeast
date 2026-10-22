import type Stripe from 'stripe';
import type { TrialOffer } from '@asobeast/shared';
import type { Env } from '../config/env';
import { WORKSPACE_METADATA_KEY } from './workspace-link';

export type TaxCollection = 'none' | 'stripe_tax' | 'managed_payments';

type TaxSwitches = Pick<Env, 'STRIPE_TAX_ENABLED' | 'STRIPE_MANAGED_PAYMENTS'>;

export interface CheckoutSessionInput {
  customerId: string;
  priceId: string;
  workspaceId: string;
  successUrl: string;
  cancelUrl: string;
  taxCollection: TaxCollection;
  trial?: TrialOffer;
}

export function taxCollectionOf(switches: TaxSwitches): TaxCollection {
  if (switches.STRIPE_MANAGED_PAYMENTS) return 'managed_payments';
  return switches.STRIPE_TAX_ENABLED ? 'stripe_tax' : 'none';
}

function taxParams(
  taxCollection: TaxCollection,
): Partial<Stripe.Checkout.SessionCreateParams> {
  if (taxCollection === 'managed_payments') {
    return { managed_payments: { enabled: true } };
  }
  return {
    tax_id_collection: { enabled: true },
    customer_update: { address: 'auto', name: 'auto' },
    automatic_tax: { enabled: taxCollection === 'stripe_tax' },
  };
}

export function trialSubmitMessage(days: number): string {
  return `$0 today. Your ${days} day trial ends on the date shown above, then the plan price is charged. Cancel any time from Settings, Billing.`;
}

function trialParams(
  trial: TrialOffer | undefined,
): Partial<Stripe.Checkout.SessionCreateParams> {
  if (!trial) return {};
  return {
    payment_method_collection: 'always',
    custom_text: { submit: { message: trialSubmitMessage(trial.days) } },
  };
}

function trialSubscriptionData(
  trial: TrialOffer | undefined,
): Partial<Stripe.Checkout.SessionCreateParams.SubscriptionData> {
  if (!trial) return {};
  return {
    trial_period_days: trial.days,
    trial_settings: { end_behavior: { missing_payment_method: 'cancel' } },
  };
}

export function checkoutSessionParams(
  input: CheckoutSessionInput,
): Stripe.Checkout.SessionCreateParams {
  return {
    mode: 'subscription',
    customer: input.customerId,
    line_items: [{ price: input.priceId, quantity: 1 }],
    client_reference_id: input.workspaceId,
    subscription_data: {
      metadata: { [WORKSPACE_METADATA_KEY]: input.workspaceId },
      billing_mode: { type: 'flexible' },
      ...trialSubscriptionData(input.trial),
    },
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    allow_promotion_codes: true,
    billing_address_collection: 'required',
    ...taxParams(input.taxCollection),
    ...trialParams(input.trial),
  };
}
