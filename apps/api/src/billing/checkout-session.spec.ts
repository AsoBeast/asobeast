import {
  checkoutSessionParams,
  taxCollectionOf,
  trialSubmitMessage,
  type CheckoutSessionInput,
} from './checkout-session';
import { WORKSPACE_METADATA_KEY } from './workspace-link';

const INPUT: CheckoutSessionInput = {
  customerId: 'cus_1',
  priceId: 'price_indie_month',
  workspaceId: 'ws_1',
  returnUrl: 'https://app.example.com/settings?checkout=complete',
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
  success_url: INPUT.returnUrl,
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

describe('a trial checkout', () => {
  const TRIAL = {
    payment_method_collection: 'always',
    custom_text: { submit: { message: trialSubmitMessage(7) } },
  };
  const TRIAL_SUBSCRIPTION = {
    ...COMMON.subscription_data,
    trial_period_days: 7,
    trial_settings: { end_behavior: { missing_payment_method: 'cancel' } },
  };

  it('asks stripe for a trial on a collected card', () => {
    expect(checkoutSessionParams({ ...INPUT, trial: { days: 7 } })).toEqual({
      ...COMMON,
      ...TRIAL,
      subscription_data: TRIAL_SUBSCRIPTION,
      tax_id_collection: { enabled: true },
      customer_update: { address: 'auto', name: 'auto' },
      automatic_tax: { enabled: false },
    });
  });

  it('keeps managed payments clean with a trial', () => {
    const params = checkoutSessionParams({
      ...INPUT,
      taxCollection: 'managed_payments',
      trial: { days: 7 },
    });

    expect(params).toEqual({
      ...COMMON,
      ...TRIAL,
      subscription_data: TRIAL_SUBSCRIPTION,
      managed_payments: { enabled: true },
    });
    for (const key of STRIPE_CONTROLS_UNDER_MANAGED_PAYMENTS) {
      expect(params).not.toHaveProperty(key);
    }
  });

  it('names the days in the submit message', () => {
    expect(trialSubmitMessage(7)).toBe(
      '$0 today. Your 7 day trial ends on the date shown above, then the plan price is charged. Cancel any time from Settings, Billing.',
    );
  });
});

describe('an embedded checkout', () => {
  const embedded = (over: Partial<CheckoutSessionInput>) =>
    checkoutSessionParams({ ...INPUT, ui: 'embedded', ...over });
  const hosted = (over: Partial<CheckoutSessionInput>) =>
    checkoutSessionParams({ ...INPUT, ...over });

  it.each([
    ['the seller', {}],
    ['managed payments', { taxCollection: 'managed_payments' as const }],
    ['a trial', { trial: { days: 7 } }],
  ])('builds an embedded session with a return url for %s', (_label, over) => {
    const params = embedded(over);
    const { success_url, cancel_url, ...rest } = hosted(over);

    expect(success_url).toBe(INPUT.returnUrl);
    expect(cancel_url).toBe(INPUT.cancelUrl);
    expect(params).toEqual({
      ...rest,
      ui_mode: 'embedded_page',
      return_url: INPUT.returnUrl,
    });
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
