import { randomBytes } from 'node:crypto';
import {
  assertStoreConnectConfiguration,
  STORE_CONNECT_KEY_VARIABLES,
  storeConnectEnabled,
} from './store-connect-config';

const key = () => randomBytes(32).toString('base64');

const keys = (
  current: string | undefined,
  previous: string | undefined = undefined,
) => ({
  STORE_CONNECT_ENCRYPTION_KEY: current,
  STORE_CONNECT_ENCRYPTION_KEY_PREVIOUS: previous,
});

describe('store connect configuration', () => {
  it('is off with no key, and that boots', () => {
    expect(storeConnectEnabled(keys(undefined))).toBe(false);
    expect(() =>
      assertStoreConnectConfiguration(keys(undefined)),
    ).not.toThrow();
  });

  it('is on with a 32 byte key', () => {
    expect(storeConnectEnabled(keys(key()))).toBe(true);
    expect(() => assertStoreConnectConfiguration(keys(key()))).not.toThrow();
  });

  it('accepts a previous key beside the current one', () => {
    expect(() =>
      assertStoreConnectConfiguration(keys(key(), key())),
    ).not.toThrow();
  });

  it.each(STORE_CONNECT_KEY_VARIABLES)(
    'refuses a %s that is not 32 bytes',
    (name) => {
      const env = {
        ...keys(key(), key()),
        [name]: randomBytes(16).toString('base64'),
      };

      expect(() => assertStoreConnectConfiguration(env)).toThrow(
        `${name} must be 32 random bytes encoded as base64, this one decodes to 16. Generate one with: openssl rand -base64 32`,
      );
    },
  );

  it('refuses a previous key without a current one', () => {
    expect(() =>
      assertStoreConnectConfiguration(keys(undefined, key())),
    ).toThrow(
      'STORE_CONNECT_ENCRYPTION_KEY_PREVIOUS is set without STORE_CONNECT_ENCRYPTION_KEY',
    );
  });

  it('does not echo the key it refuses', () => {
    const bad = randomBytes(8).toString('base64');
    let message = '';
    try {
      assertStoreConnectConfiguration(keys(bad));
    } catch (error) {
      message = String(error);
    }

    expect(message).toContain('must be 32 random bytes');
    expect(message).not.toContain(bad);
  });
});
