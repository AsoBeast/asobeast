import type { Env } from './env';

export const SECRET_ENV_KEYS = [
  'AUTH_SECRET',
  'OPENAI_API_KEY',
  'SMTP_PASSWORD',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'PROXY_API_KEY',
  'PROXY_PASSWORD',
  'PROXY_RESIDENTIAL_PASSWORD',
] as const satisfies readonly (keyof Env)[];

export type SecretEnvKey = (typeof SECRET_ENV_KEYS)[number];

export function secretLiteralsFrom(
  read: (key: SecretEnvKey) => unknown,
): string[] {
  return SECRET_ENV_KEYS.map(read).filter(
    (value): value is string => typeof value === 'string' && value.length > 0,
  );
}
