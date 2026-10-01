import {
  checkoutSessionParams,
  taxCollectionOf,
  type CheckoutSessionInput,
} from './checkout-session';
import { WORKSPACE_METADATA_KEY } from './workspace-link';

const INPUT: CheckoutSessionInput = {
  customerId: 'cus_1',
  priceId: 'price_indie_month',
  workspaceId: 'ws_1',
  successUrl: 'https://app.example.com/settings?checkout=complete',
  cancelUrl: 'https://app.example.com/upgrade',
  taxCollection: 'none',
};

const COMMON = {
  mode: 'subscription',
  customer: 'cus_1',
  line_items: [{ price: 'price_indie_month', quantity: 1 }],
  client_reference_id: 'ws_1',
  subscription_data: {
    metadata: { [WORKSPACE_METADATA_KEY]: 'ws_1' },
    billing_mode: { type: 'flexible' },
  },
  success_url: INPUT.successUrl,
  cancel_url: INPUT.cancelUrl,
  allow_promotion_codes: true,
  billing_address_collection: 'required',
};

const STRIPE_CONTROLS_UNDER_MANAGED_PAYMENTS = [
  'automatic_tax',
  'tax_id_collection',
  'customer_update',
  'adaptive_pricing',
  'payment_method_types',
  'payment_method_configuration',
  'invoice_creation',
  'shipping_address_collection',
  'shipping_options',
];

describe('checkoutSessionParams', () => {
  it('collects the address and tax id but no tax when this business sells without stripe tax', () => {
    expect(checkoutSessionParams(INPUT)).toEqual({
      ...COMMON,
      tax_id_collection: { enabled: true },
      customer_update: { address: 'auto', name: 'auto' },
      automatic_tax: { enabled: false },
    });
  });

  it('adds automatic tax when this business sells through stripe tax', () => {
    expect(
      checkoutSessionParams({ ...INPUT, taxCollection: 'stripe_tax' }),
    ).toEqual({
      ...COMMON,
      tax_id_collection: { enabled: true },
      customer_update: { address: 'auto', name: 'auto' },
      automatic_tax: { enabled: true },
    });
  });

  it('hands tax, tax ids and the customer details to stripe under managed payments', () => {
    const params = checkoutSessionParams({
      ...INPUT,
      taxCollection: 'managed_payments',
    });

    expect(params).toEqual({ ...COMMON, managed_payments: { enabled: true } });
    for (const key of STRIPE_CONTROLS_UNDER_MANAGED_PAYMENTS) {
      expect(params).not.toHaveProperty(key);
    }
    expect(params.subscription_data).not.toHaveProperty('invoice_settings');
    expect(params.subscription_data).not.toHaveProperty('default_tax_rates');
  });
});

describe('taxCollectionOf', () => {
  it.each([
    [false, false, 'none'],
    [true, false, 'stripe_tax'],
    [false, true, 'managed_payments'],
  ] as const)(
    'stripe tax %s and managed payments %s collect %s',
    (stripeTax, managed, expected) => {
      expect(
        taxCollectionOf({
          STRIPE_TAX_ENABLED: stripeTax,
          STRIPE_MANAGED_PAYMENTS: managed,
        }),
      ).toBe(expected);
    },
  );
});
