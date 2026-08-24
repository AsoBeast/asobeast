import { TEST_AUTH_SECRET } from './auth-env';

export const TEST_STRIPE_SECRET_KEY = 'sk_test_asobeast_e2e';
export const TEST_STRIPE_WEBHOOK_SECRET = 'whsec_asobeast_e2e_secret';

process.env.AUTH_SECRET = TEST_AUTH_SECRET;
process.env.AUTH_ALLOW_REGISTRATION = 'false';
process.env.BILLING_ENABLED = 'true';
process.env.TRIAL_DAYS = '7';
process.env.STRIPE_SECRET_KEY = TEST_STRIPE_SECRET_KEY;
process.env.STRIPE_WEBHOOK_SECRET = TEST_STRIPE_WEBHOOK_SECRET;
process.env.STRIPE_PRICE_INDIE_MONTHLY = 'price_TestIndieMonthly';
process.env.STRIPE_PRICE_INDIE_YEARLY = 'price_TestIndieYearly';
process.env.STRIPE_PRICE_ULTIMATE_MONTHLY = 'price_TestUltimateMonthly';
process.env.STRIPE_PRICE_ULTIMATE_YEARLY = 'price_TestUltimateYearly';
