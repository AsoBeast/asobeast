import './enable-stripe';

for (const key of [
  'STRIPE_PRICE_INDIE_MONTHLY',
  'STRIPE_PRICE_INDIE_YEARLY',
  'STRIPE_PRICE_ULTIMATE_MONTHLY',
  'STRIPE_PRICE_ULTIMATE_YEARLY',
]) {
  delete process.env[key];
}
