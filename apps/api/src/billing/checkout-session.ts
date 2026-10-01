import type Stripe from 'stripe';
import { WORKSPACE_METADATA_KEY } from './workspace-link';

export interface CheckoutSessionInput {
  customerId: string;
  priceId: string;
  workspaceId: string;
  successUrl: string;
  cancelUrl: string;
  automaticTax: boolean;
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
    },
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    allow_promotion_codes: true,
    billing_address_collection: 'required',
    tax_id_collection: { enabled: true },
    customer_update: { address: 'auto', name: 'auto' },
    automatic_tax: { enabled: input.automaticTax },
  };
}
