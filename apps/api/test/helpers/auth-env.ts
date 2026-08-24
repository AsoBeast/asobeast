export const TEST_AUTH_SECRET =
  'test-secret-test-secret-test-secret-0123456789';

const AUTH_ENV_KEYS = [
  'AUTH_SECRET',
  'AUTH_ALLOW_REGISTRATION',
  'AUTH_REGISTRATION_WORKSPACE',
  'AUTH_COOKIE_SECURE',
  'BILLING_ENABLED',
  'TRIAL_DAYS',
  'AUTH_SESSION_DAYS',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'STRIPE_PRICE_INDIE_MONTHLY',
  'STRIPE_PRICE_INDIE_YEARLY',
  'STRIPE_PRICE_ULTIMATE_MONTHLY',
  'STRIPE_PRICE_ULTIMATE_YEARLY',
] as const;

const saved = new Map(AUTH_ENV_KEYS.map((key) => [key, process.env[key]]));

export function restoreAuthEnv(): void {
  for (const key of AUTH_ENV_KEYS) {
    const value = saved.get(key);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}
