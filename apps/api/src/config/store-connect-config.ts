import { SECRET_KEY_BYTES } from '../common/crypto/secret-box';
import type { Env } from './env';

export const STORE_CONNECT_KEY_VARIABLES = [
  'STORE_CONNECT_ENCRYPTION_KEY',
  'STORE_CONNECT_ENCRYPTION_KEY_PREVIOUS',
] as const;

export const GOOGLE_PLAY_OAUTH_VARIABLES = [
  'GOOGLE_PLAY_OAUTH_CLIENT_ID',
  'GOOGLE_PLAY_OAUTH_CLIENT_SECRET',
] as const;

type StoreConnectKeys = Pick<
  Env,
  | (typeof STORE_CONNECT_KEY_VARIABLES)[number]
  | (typeof GOOGLE_PLAY_OAUTH_VARIABLES)[number]
>;

export function storeConnectEnabled(
  env: Pick<Env, 'STORE_CONNECT_ENCRYPTION_KEY'>,
): boolean {
  return Boolean(env.STORE_CONNECT_ENCRYPTION_KEY);
}

export function assertStoreConnectConfiguration(env: StoreConnectKeys): void {
  if (
    !env.STORE_CONNECT_ENCRYPTION_KEY &&
    env.STORE_CONNECT_ENCRYPTION_KEY_PREVIOUS
  ) {
    throw new Error(
      'STORE_CONNECT_ENCRYPTION_KEY_PREVIOUS is set without STORE_CONNECT_ENCRYPTION_KEY. Set the new key too, or remove the previous one.',
    );
  }
  const missing = GOOGLE_PLAY_OAUTH_VARIABLES.filter((name) => !env[name]);
  if (
    missing.length > 0 &&
    missing.length < GOOGLE_PLAY_OAUTH_VARIABLES.length
  ) {
    throw new Error(
      `Sign in with Google is partly configured. Set ${missing.join(', ')} or remove every GOOGLE_PLAY_OAUTH_ variable.`,
    );
  }
  for (const name of STORE_CONNECT_KEY_VARIABLES) {
    const value = env[name];
    if (!value) continue;
    const length = Buffer.from(value, 'base64').length;
    if (length !== SECRET_KEY_BYTES) {
      throw new Error(
        `${name} must be ${SECRET_KEY_BYTES} random bytes encoded as base64, this one decodes to ${length}. Generate one with: openssl rand -base64 32`,
      );
    }
  }
}
