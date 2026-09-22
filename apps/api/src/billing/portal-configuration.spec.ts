import {
  LEGAL_PRIVACY_URL,
  LEGAL_TERMS_URL,
  PORTAL_CANCELLATION_REASONS,
  portalConfiguration,
} from './portal-configuration';

describe('portalConfiguration', () => {
  const params = portalConfiguration({
    products: [
      { id: 'prod_indie', prices: ['price_im', 'price_iy'] },
      { id: 'prod_ultimate', prices: ['price_um', 'price_uy'] },
    ],
    termsUrl: 'https://docs.example.test/legal/terms',
    privacyUrl: 'https://docs.example.test/legal/privacy',
    returnUrl: 'https://app.example.test/settings',
  });

  it('cancels at the period end and asks why', () => {
    expect(params.features.subscription_cancel).toEqual({
      enabled: true,
      mode: 'at_period_end',
      proration_behavior: 'none',
      cancellation_reason: {
        enabled: true,
        options: [...PORTAL_CANCELLATION_REASONS],
      },
    });
  });

  it('charges an upgrade now and schedules a downgrade at the period end', () => {
    expect(params.features.subscription_update).toEqual({
      enabled: true,
      default_allowed_updates: ['price'],
      proration_behavior: 'always_invoice',
      products: [
        { product: 'prod_indie', prices: ['price_im', 'price_iy'] },
        { product: 'prod_ultimate', prices: ['price_um', 'price_uy'] },
      ],
      schedule_at_period_end: {
        conditions: [
          { type: 'decreasing_item_amount' },
          { type: 'shortening_interval' },
        ],
      },
    });
  });

  it('lets the customer keep the details an invoice prints up to date', () => {
    expect(params.features.customer_update).toEqual({
      enabled: true,
      allowed_updates: ['name', 'email', 'address', 'phone', 'tax_id'],
    });
    expect(params.features.payment_method_update).toEqual({ enabled: true });
    expect(params.features.invoice_history).toEqual({ enabled: true });
  });

  it('offers no pause, since paused is reserved for a trial without a card', () => {
    expect(params.features).not.toHaveProperty('subscription_pause');
  });

  it('prints the legal links, returns to settings and has no public login page', () => {
    expect(params.business_profile).toEqual({
      headline: 'asobeast',
      terms_of_service_url: 'https://docs.example.test/legal/terms',
      privacy_policy_url: 'https://docs.example.test/legal/privacy',
    });
    expect(params.default_return_url).toBe('https://app.example.test/settings');
    expect(params.login_page).toEqual({ enabled: false });
  });

  it('leaves the return url out when the instance has no public address', () => {
    expect(
      portalConfiguration({
        products: [],
        termsUrl: LEGAL_TERMS_URL,
        privacyUrl: LEGAL_PRIVACY_URL,
      }),
    ).not.toHaveProperty('default_return_url');
  });

  it('points at the published legal pages', () => {
    expect(LEGAL_TERMS_URL).toBe('https://docs.asobeast.com/legal/terms');
    expect(LEGAL_PRIVACY_URL).toBe('https://docs.asobeast.com/legal/privacy');
  });
});
